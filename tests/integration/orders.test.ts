import { beforeEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { addToCart } from "@/services/cart";
import { placeOrder } from "@/services/checkout";
import { adjustStock } from "@/services/inventory";
import {
  cancelOrderAsCustomer,
  changeOrderStatus,
  processRefund,
  requestReturn,
  syncStripeCheckoutSession,
  updatePaymentStatus,
} from "@/services/orders";
import { login } from "@/services/auth";
import { checkoutInput, createCustomer, createProduct, createShipping, resetDb } from "./helpers";

async function placedOrder(opts: { stock?: number; qty?: number; signIn?: boolean } = {}) {
  const { dhaka } = await createShipping();
  const p = await createProduct({ price: 1000, stock: opts.stock ?? 5 });
  let userId: string | null = null;
  if (opts.signIn) {
    const c = await createCustomer();
    await login(c.user.email, c.password);
    userId = c.user.id;
  }
  await addToCart(p.id, undefined, opts.qty ?? 2);
  const user = userId ? { id: userId, email: "buyer@example.com" } : null;
  const res = await placeOrder(checkoutInput(dhaka.methods[0].id) as never, user as never);
  return { orderId: res.orderId, product: p, userId };
}

const stockOf = async (variantId: string) => (await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).quantity;

describe("order lifecycle", () => {
  beforeEach(resetDb);

  it("moves forward, records history and rejects invalid transitions", async () => {
    const { orderId } = await placedOrder();
    await changeOrderStatus({ orderId, to: "CONFIRMED", note: "Called customer" }, null);
    await changeOrderStatus({ orderId, to: "SHIPPED", trackingNumber: "PTH123", courier: "Pathao" }, null);
    await expect(changeOrderStatus({ orderId, to: "PROCESSING" }, null)).rejects.toThrow(/cannot move/);
    await expect(changeOrderStatus({ orderId, to: "CANCELLED" }, null)).rejects.toThrow(/cannot move/);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { statusHistory: { orderBy: { createdAt: "asc" } } } });
    expect(order.status).toBe("SHIPPED");
    expect(order.trackingNumber).toBe("PTH123");
    expect(order.shippedAt).not.toBeNull();
    expect(order.statusHistory.map((h) => h.toStatus)).toEqual(["PENDING", "CONFIRMED", "SHIPPED"]);
  });

  it("collects COD payment automatically on delivery", async () => {
    const { orderId } = await placedOrder();
    await changeOrderStatus({ orderId, to: "DELIVERED" }, null);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: { include: { transactions: true } } } });
    expect(order.paymentStatus).toBe("PAID");
    expect(order.payments[0].status).toBe("PAID");
    expect(order.payments[0].transactions[0].type).toBe("COD_COLLECTION");
  });

  it("restores stock exactly once when an order is cancelled", async () => {
    const { orderId, product } = await placedOrder({ stock: 5, qty: 2 });
    const variantId = product.variants[0].id;
    expect(await stockOf(variantId)).toBe(3);
    await changeOrderStatus({ orderId, to: "CANCELLED" }, null);
    expect(await stockOf(variantId)).toBe(5);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.stockRestored).toBe(true);
    expect(order.paymentStatus).toBe("CANCELLED");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).soldCount).toBe(0);
    expect(await prisma.stockMovement.count({ where: { orderId, type: "CANCELLATION" } })).toBe(1);
  });

  it("lets customers cancel only their own early orders", async () => {
    const { orderId, userId } = await placedOrder({ signIn: true });
    const stranger = await createCustomer();
    await expect(cancelOrderAsCustomer(orderId, stranger.user.id)).rejects.toThrow(/not found/);
    await changeOrderStatus({ orderId, to: "PROCESSING" }, null);
    await expect(cancelOrderAsCustomer(orderId, userId!)).rejects.toThrow(/being prepared/);
  });

  it("refunds a paid COD order (full refund marks the order refunded)", async () => {
    const { orderId } = await placedOrder({ qty: 1 });
    await changeOrderStatus({ orderId, to: "DELIVERED" }, null);
    const admin = await createCustomer("admin-actor@example.com");
    await expect(processRefund(orderId, { amount: 999999, reason: "too much", restock: false }, admin.user)).rejects.toThrow(/at most/);
    const partial = await processRefund(orderId, { amount: 100, reason: "Scratch", restock: false }, admin.user);
    expect(partial.fullyRefunded).toBe(false);
    let order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("PARTIALLY_REFUNDED");
    const rest = order.grandTotal.minus(100).toNumber();
    const full = await processRefund(orderId, { amount: rest, reason: "Return", restock: true }, admin.user);
    expect(full.fullyRefunded).toBe(true);
    order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("REFUNDED");
    expect(order.paymentStatus).toBe("REFUNDED");
  });

  it("does not allow marking online payments as paid manually", async () => {
    const { orderId } = await placedOrder();
    await prisma.order.update({ where: { id: orderId }, data: { paymentMethod: "STRIPE" } });
    const admin = await createCustomer("x-admin@example.com");
    await expect(updatePaymentStatus(orderId, "PAID", admin.user)).rejects.toThrow(/confirmed automatically/);
  });

  it("accepts return requests only for delivered orders within the window", async () => {
    const { orderId, userId } = await placedOrder({ signIn: true });
    await expect(requestReturn(userId!, { orderId, reason: "Changed my mind", quantity: 1 })).rejects.toThrow(/once your order has been delivered/);
    await changeOrderStatus({ orderId, to: "DELIVERED" }, null);
    await requestReturn(userId!, { orderId, reason: "Changed my mind", quantity: 1 });
    await expect(requestReturn(userId!, { orderId, reason: "Changed my mind", quantity: 1 })).rejects.toThrow(/already in progress/);
    await prisma.order.update({ where: { id: orderId }, data: { deliveredAt: new Date(Date.now() - 60 * 86_400_000) } });
    await prisma.returnRequest.deleteMany();
    await expect(requestReturn(userId!, { orderId, reason: "Changed my mind", quantity: 1 })).rejects.toThrow(/window/);
  });
});

describe("inventory adjustments", () => {
  beforeEach(resetDb);

  it("adjusts stock with an audit trail and never below zero", async () => {
    const p = await createProduct({ price: 100, stock: 4 });
    const staff = await createCustomer("inv@example.com");
    const variantId = p.variants[0].id;
    await adjustStock({ variantId, mode: "add", quantity: 6, reason: "Delivery from supplier" }, staff.user.id);
    expect(await stockOf(variantId)).toBe(10);
    await adjustStock({ variantId, mode: "set", quantity: 7, reason: "Stock count" }, staff.user.id);
    expect(await stockOf(variantId)).toBe(7);
    await expect(adjustStock({ variantId, mode: "add", quantity: -8, reason: "Damage" }, staff.user.id)).rejects.toThrow(/below zero/);
    const moves = await prisma.stockMovement.findMany({ where: { inventory: { variantId } }, orderBy: { createdAt: "asc" } });
    expect(moves.map((m) => [m.type, m.quantityChange, m.quantityAfter])).toEqual([
      ["RESTOCK", 6, 10],
      ["ADJUSTMENT", -3, 7],
    ]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stockQuantity).toBe(7);
  });
});

describe("payment verification (Stripe sync)", () => {
  beforeEach(resetDb);

  async function stripeOrder() {
    const { orderId, product } = await placedOrder();
    await prisma.order.update({ where: { id: orderId }, data: { paymentMethod: "STRIPE", paymentStatus: "PENDING" } });
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId } });
    await prisma.payment.update({ where: { id: payment.id }, data: { method: "STRIPE", status: "PENDING", providerReference: "cs_test_123" } });
    return { orderId, product };
  }
  const session = (over: Partial<Stripe.Checkout.Session>) =>
    ({ id: "cs_test_123", payment_status: "unpaid", status: "open", payment_intent: "pi_123", amount_total: 207000, ...over }) as Stripe.Checkout.Session;

  it("does not mark an unpaid session as paid", async () => {
    const { orderId } = await stripeOrder();
    await syncStripeCheckoutSession(session({}), "evt_1");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus).toBe("PENDING");
  });

  it("confirms the order once when a paid session is reported (idempotent per event)", async () => {
    const { orderId } = await stripeOrder();
    await syncStripeCheckoutSession(session({ payment_status: "paid", status: "complete" }), "evt_paid");
    await syncStripeCheckoutSession(session({ payment_status: "paid", status: "complete" }), "evt_paid");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: { include: { transactions: true } } } });
    expect(order.status).toBe("CONFIRMED");
    expect(order.paymentStatus).toBe("PAID");
    expect(order.payments[0].providerPaymentId).toBe("pi_123");
    expect(order.payments[0].transactions.filter((t) => t.type === "CHARGE")).toHaveLength(1);
  });

  it("cancels the order and releases stock when the session expires unpaid", async () => {
    const { orderId, product } = await stripeOrder();
    await syncStripeCheckoutSession(session({ status: "expired" }), "evt_exp");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("CANCELLED");
    expect(await stockOf(product.variants[0].id)).toBe(5);
  });
});

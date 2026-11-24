import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addToCart, applyCartCoupon, getCartCount, getCartView, removeCartItem, updateCartItem } from "@/services/cart";
import { placeOrder } from "@/services/checkout";
import { reserveStock } from "@/services/inventory";
import { login } from "@/services/auth";
import { checkoutInput, createCustomer, createProduct, createShipping, resetDb, signOutLocal } from "./helpers";

describe("cart", () => {
  beforeEach(resetDb);

  it("adds items, prices them on the server and enforces stock", async () => {
    const p = await createProduct({ price: 1000, salePrice: 800, stock: 3 });
    await addToCart(p.id, undefined, 2);
    let cart = await getCartView();
    expect(cart.itemCount).toBe(2);
    expect(cart.items[0].unitPrice).toBe("800.00");
    expect(cart.subtotal).toBe("1600.00");

    await expect(addToCart(p.id, undefined, 2)).rejects.toThrow(/only 3 available/);
    await updateCartItem(cart.items[0].id, 3);
    await expect(updateCartItem(cart.items[0].id, 4)).rejects.toThrow(/Only 3/);
    await removeCartItem(cart.items[0].id);
    cart = await getCartView();
    expect(cart.items).toHaveLength(0);
  });

  it("requires a variant choice for multi-variant products and rejects foreign variants", async () => {
    const p = await createProduct({ price: 500, variants: [{ color: "Oat", stock: 2 }, { color: "Sage", stock: 0 }] });
    const other = await createProduct({ price: 100 });
    await expect(addToCart(p.id, undefined, 1)).rejects.toThrow(/choose a colour or size/);
    await expect(addToCart(p.id, other.variants[0].id, 1)).rejects.toThrow(/not available for this product/);
    await expect(addToCart(p.id, p.variants[1].id, 1)).rejects.toThrow(/out of stock/);
    await addToCart(p.id, p.variants[0].id, 1);
    expect(await getCartCount()).toBe(1);
  });

  it("refuses unpublished products", async () => {
    const p = await createProduct({ price: 500, status: "DRAFT" });
    await expect(addToCart(p.id, undefined, 1)).rejects.toThrow(/no longer available/);
  });

  it("flags lines whose stock dropped after they were added", async () => {
    const p = await createProduct({ price: 500, stock: 5 });
    await addToCart(p.id, undefined, 4);
    await prisma.inventory.update({ where: { variantId: p.variants[0].id }, data: { quantity: 2 } });
    const cart = await getCartView();
    expect(cart.hasIssues).toBe(true);
    expect(cart.items[0].warning).toMatch(/Only 2 left/);
  });

  it("applies coupons only when the server-side rules pass", async () => {
    const p = await createProduct({ price: 1000, stock: 10 });
    await prisma.coupon.create({ data: { code: "TENOFF", type: "PERCENTAGE", value: 10, minPurchase: 1500 } });
    await addToCart(p.id, undefined, 1);
    await expect(applyCartCoupon("TENOFF")).rejects.toThrow(/minimum purchase/i);
    await expect(applyCartCoupon("NOPE")).rejects.toThrow(/couldn't find/);
    await addToCart(p.id, undefined, 1);
    await applyCartCoupon("tenoff");
    const cart = await getCartView();
    expect(cart.couponCode).toBe("TENOFF");
    expect(cart.discount).toBe("200.00");
  });

  it("merges a guest cart into the account cart on sign-in", async () => {
    const p = await createProduct({ price: 300, stock: 10 });
    const { user, password } = await createCustomer();
    await addToCart(p.id, undefined, 2); // as guest
    await login(user.email, password);
    const cart = await prisma.cart.findUniqueOrThrow({ where: { userId: user.id }, include: { items: true } });
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
    expect(await prisma.cart.count({ where: { guestToken: { not: null } } })).toBe(0);
  });
});

describe("checkout", () => {
  beforeEach(resetDb);

  it("creates an order transactionally with server-calculated totals", async () => {
    const { dhaka } = await createShipping();
    const p = await createProduct({ price: 2000, salePrice: 1800, stock: 5, costPrice: 900 });
    await prisma.coupon.create({ data: { code: "FLAT200", type: "FIXED", value: 200 } });
    await addToCart(p.id, undefined, 2);
    const standard = dhaka.methods.find((m) => m.name === "Standard")!;

    const res = await placeOrder(checkoutInput(standard.id, { couponCode: "FLAT200" }) as never, null);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.orderId }, include: { items: true, payments: true, statusHistory: true, couponUsage: true } });

    expect(order.subtotal.toFixed(2)).toBe("3600.00");
    expect(order.discountTotal.toFixed(2)).toBe("200.00");
    expect(order.shippingTotal.toFixed(2)).toBe("70.00");
    expect(order.grandTotal.toFixed(2)).toBe("3470.00");
    expect(order.items[0].unitCost?.toFixed(2)).toBe("900.00");
    expect(order.payments[0]).toMatchObject({ method: "COD", status: "UNPAID" });
    expect(order.statusHistory).toHaveLength(1);
    expect(order.couponUsage?.discountAmount.toFixed(2)).toBe("200.00");

    const inv = await prisma.inventory.findUniqueOrThrow({ where: { variantId: p.variants[0].id } });
    expect(inv.quantity).toBe(3);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(product.stockQuantity).toBe(3);
    expect(product.soldCount).toBe(2);
    expect(await prisma.stockMovement.count({ where: { type: "SALE", orderId: order.id } })).toBe(1);
    expect(await getCartCount()).toBe(0);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "FLAT200" } })).usedCount).toBe(1);
  });

  it("is idempotent: resubmitting the same checkout returns the same order", async () => {
    const { dhaka } = await createShipping();
    const p = await createProduct({ price: 1000, stock: 5 });
    await addToCart(p.id, undefined, 1);
    const input = checkoutInput(dhaka.methods[0].id);
    const first = await placeOrder(input as never, null);
    const second = await placeOrder(input as never, null);
    expect(second.orderId).toBe(first.orderId);
    expect(second.duplicate).toBe(true);
    expect(await prisma.order.count()).toBe(1);
  });

  it("rejects a shipping method that doesn't serve the address, and COD where not allowed", async () => {
    const { dhaka, rest } = await createShipping();
    const p = await createProduct({ price: 1000, stock: 5 });
    await addToCart(p.id, undefined, 1);
    await expect(placeOrder(checkoutInput(rest.methods[0].id) as never, null)).rejects.toThrow(/not available for this address/);
    const express = dhaka.methods.find((m) => m.name === "Express")!;
    await expect(placeOrder(checkoutInput(express.id) as never, null)).rejects.toThrow(/Cash on Delivery is not available/);
    expect(await prisma.order.count()).toBe(0);
  });

  it("rolls everything back when stock runs out between cart and checkout", async () => {
    const { dhaka } = await createShipping();
    const p = await createProduct({ price: 1000, stock: 2 });
    await addToCart(p.id, undefined, 2);
    await prisma.inventory.update({ where: { variantId: p.variants[0].id }, data: { quantity: 1 } });
    await expect(placeOrder(checkoutInput(dhaka.methods[0].id) as never, null)).rejects.toThrow(/need attention/);
    expect(await prisma.order.count()).toBe(0);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { variantId: p.variants[0].id } })).quantity).toBe(1);
  });

  it("rejects online gateways that are not configured", async () => {
    const { dhaka } = await createShipping();
    const p = await createProduct({ price: 1000, stock: 2 });
    await addToCart(p.id, undefined, 1);
    await expect(placeOrder(checkoutInput(dhaka.methods[0].id, { paymentMethod: "STRIPE" }) as never, null)).rejects.toThrow(/not available/);
    await expect(placeOrder(checkoutInput(dhaka.methods[0].id, { paymentMethod: "BKASH" }) as never, null)).rejects.toThrow(/not available/);
  });

  it("never oversells under concurrent reservations", async () => {
    const p = await createProduct({ price: 1000, stock: 1 });
    const order = async () => {
      const o = await prisma.order.create({
        data: {
          orderNumber: `T-${Math.random()}`,
          paymentMethod: "COD",
          subtotal: 1000,
          grandTotal: 1000,
          customerName: "x",
          customerEmail: "x@example.com",
          customerPhone: "0",
          shipFullName: "x",
          shipPhone: "0",
          shipLine1: "x",
          shipDistrict: "Dhaka",
          shipDivision: "Dhaka",
          shippingMethodName: "x",
          idempotencyKey: crypto.randomUUID(),
        },
      });
      return prisma.$transaction((tx) => reserveStock(tx, { variantId: p.variants[0].id, quantity: 1, orderId: o.id, productName: "P" }));
    };
    const results = await Promise.allSettled([order(), order(), order()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { variantId: p.variants[0].id } })).quantity).toBe(0);
  });

  it("respects the coupon usage limit across customers", async () => {
    const { dhaka } = await createShipping();
    const p = await createProduct({ price: 1000, stock: 10 });
    await prisma.coupon.create({ data: { code: "ONCE", type: "FIXED", value: 100, usageLimit: 1 } });
    await addToCart(p.id, undefined, 1);
    await placeOrder(checkoutInput(dhaka.methods[0].id, { couponCode: "ONCE" }) as never, null);
    signOutLocal();
    await addToCart(p.id, undefined, 1);
    await expect(
      placeOrder(checkoutInput(dhaka.methods[0].id, { couponCode: "ONCE", customer: { name: "Other Person", email: "o@example.com", phone: "01700000001" } }) as never, null),
    ).rejects.toThrow(/usage limit/);
  });
});

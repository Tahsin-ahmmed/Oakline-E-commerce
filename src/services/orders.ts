import "server-only";
import type Stripe from "stripe";
import { prisma, type Tx } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { dec, moneyString, round2 } from "@/lib/money";
import { appUrl } from "@/lib/env";
import {
  canTransition,
  customerCanCancel,
  ORDER_STATUS_LABELS,
  restocksInventory,
  type OrderStatusValue,
} from "@/lib/order-status";
import { getProvider } from "@/lib/payments/registry";
import { fromMinorUnits } from "@/lib/payments/stripe";
import { sendMail } from "@/lib/email/mailer";
import { orderStatusTemplate } from "@/lib/email/templates";
import { releaseStock, syncProductStock } from "@/services/inventory";
import { notifyAdmins, notifyCustomer } from "@/services/notifications";
import { getSettings } from "@/services/settings";
import { sendOrderEmails } from "@/services/checkout";

// ───────────── Status transitions ─────────────

const TIMESTAMP_FIELD: Partial<Record<OrderStatusValue, "confirmedAt" | "shippedAt" | "deliveredAt" | "cancelledAt">> = {
  CONFIRMED: "confirmedAt",
  SHIPPED: "shippedAt",
  DELIVERED: "deliveredAt",
  CANCELLED: "cancelledAt",
};

async function restoreOrderStock(tx: Tx, orderId: string, type: "CANCELLATION" | "RETURN", userId: string | null) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (order.stockRestored) return;
  for (const item of order.items) {
    if (!item.variantId) continue;
    await releaseStock(tx, {
      variantId: item.variantId,
      quantity: item.quantity,
      orderId,
      type,
      userId,
      reason: type === "CANCELLATION" ? `Order ${order.orderNumber} cancelled` : `Order ${order.orderNumber} returned`,
    });
  }
  const productIds = [...new Set(order.items.map((i) => i.productId).filter((p): p is string => Boolean(p)))];
  for (const pid of productIds) {
    const qty = order.items.filter((i) => i.productId === pid).reduce((n, i) => n + i.quantity, 0);
    if (type === "CANCELLATION") {
      await tx.$executeRaw`UPDATE "Product" SET "soldCount" = GREATEST("soldCount" - ${qty}, 0) WHERE "id" = ${pid}`;
    }
    await syncProductStock(tx, pid);
  }
  await tx.order.update({ where: { id: orderId }, data: { stockRestored: true } });
}

export interface StatusChangeInput {
  orderId: string;
  to: OrderStatusValue;
  note?: string | null;
  trackingNumber?: string | null;
  courier?: string | null;
  notifyCustomer?: boolean;
}

export async function changeOrderStatus(input: StatusChangeInput, actor: { id: string } | null) {
  const updated = await prisma.$transaction(async (tx) => {
    // Lock the order row to serialize concurrent status changes.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { payments: true } });
    if (!order) throw notFound("Order not found.");
    if (order.status === input.to) throw badRequest(`The order is already ${ORDER_STATUS_LABELS[input.to].toLowerCase()}.`);
    if (!canTransition(order.status, input.to, order.paymentStatus)) {
      throw badRequest(
        `An order cannot move from ${ORDER_STATUS_LABELS[order.status]} to ${ORDER_STATUS_LABELS[input.to]}.`,
      );
    }
    if (input.to === "REFUNDED") {
      throw badRequest("Use “Process refund” to refund an order — it records the payment refund too.");
    }

    const data: Prisma.OrderUpdateInput = { status: input.to };
    const ts = TIMESTAMP_FIELD[input.to];
    if (ts) data[ts] = new Date();
    if (input.trackingNumber !== undefined) data.trackingNumber = input.trackingNumber || null;
    if (input.courier !== undefined) data.courier = input.courier || null;

    // Payment side-effects
    let paymentStatus: PaymentStatus | null = null;
    if (input.to === "DELIVERED" && order.paymentMethod === "COD" && order.paymentStatus !== "PAID") {
      paymentStatus = "PAID";
      const payment = order.payments[0];
      if (payment) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: new Date() } });
        await tx.paymentTransaction.create({
          data: {
            paymentId: payment.id,
            type: "COD_COLLECTION",
            status: "succeeded",
            amount: order.grandTotal,
            message: "Cash collected on delivery",
            createdById: actor?.id ?? null,
          },
        });
      }
    }
    if (input.to === "CANCELLED" && order.paymentStatus !== "PAID" && order.paymentStatus !== "PARTIALLY_REFUNDED") {
      paymentStatus = "CANCELLED";
      await tx.payment.updateMany({
        where: { orderId: order.id, status: { in: ["UNPAID", "PENDING", "FAILED"] } },
        data: { status: "CANCELLED" },
      });
    }
    if (paymentStatus) data.paymentStatus = paymentStatus;

    const result = await tx.order.update({ where: { id: order.id }, data });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: input.to,
        note: input.note || null,
        changedById: actor?.id ?? null,
      },
    });
    if (restocksInventory(input.to)) {
      await restoreOrderStock(tx, order.id, input.to === "CANCELLED" ? "CANCELLATION" : "RETURN", actor?.id ?? null);
    }
    return result;
  });

  if (input.notifyCustomer !== false) await notifyStatusChange(updated.id, input.note);
  return updated;
}

async function notifyStatusChange(orderId: string, note?: string | null) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  const label = ORDER_STATUS_LABELS[order.status];
  const { general } = await getSettings();
  const trackUrl = order.userId
    ? appUrl(`/account/orders/${order.id}`)
    : appUrl(`/track-order?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(order.customerEmail)}`);
  const mail = orderStatusTemplate({
    siteName: general.siteName,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    statusLabel: label,
    note,
    trackingNumber: order.trackingNumber,
    courier: order.courier,
    trackUrl,
  });
  await sendMail({ to: order.customerEmail, ...mail });
  if (order.userId) {
    await notifyCustomer(order.userId, {
      type: "order.status",
      title: `Order ${order.orderNumber} is ${label.toLowerCase()}`,
      body: note ?? undefined,
      link: `/account/orders/${order.id}`,
    });
  }
}

export async function cancelOrderAsCustomer(orderId: string, userId: string, reason?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) throw notFound("Order not found.");
  if (!customerCanCancel(order.status)) {
    throw forbidden("This order is already being prepared and can no longer be cancelled online. Please contact us.");
  }
  if (order.paymentStatus === "PAID") {
    throw forbidden("This order has been paid. Please contact us to cancel and arrange a refund.");
  }
  const result = await changeOrderStatus(
    { orderId, to: "CANCELLED", note: reason ? `Cancelled by customer: ${reason}` : "Cancelled by customer" },
    { id: userId },
  );
  await notifyAdmins({
    type: "order.cancelled",
    title: `Order ${order.orderNumber} cancelled by customer`,
    link: `/admin/orders/${order.id}`,
  });
  return result;
}

// ───────────── Payments & refunds ─────────────

export async function updatePaymentStatus(orderId: string, status: PaymentStatus, actor: { id: string }, note?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { payments: { orderBy: { createdAt: "desc" } } } });
    if (!order) throw notFound("Order not found.");
    if (status === "REFUNDED" || status === "PARTIALLY_REFUNDED") {
      throw badRequest("Use “Process refund” to record refunds.");
    }
    if (order.paymentMethod !== "COD" && status === "PAID") {
      throw badRequest("Online payments are confirmed automatically by the payment provider.");
    }
    const payment = order.payments[0];
    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status, paidAt: status === "PAID" ? new Date() : payment.paidAt },
      });
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          type: status === "PAID" ? "COD_COLLECTION" : "CHARGE",
          status: status.toLowerCase(),
          amount: status === "PAID" ? order.grandTotal : 0,
          message: note ?? `Payment status set to ${status} by staff`,
          createdById: actor.id,
        },
      });
    }
    return tx.order.update({ where: { id: order.id }, data: { paymentStatus: status } });
  });
}

export async function processRefund(
  orderId: string,
  input: { amount: number; reason: string; restock: boolean },
  actor: { id: string },
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw notFound("Order not found.");
  const payment = order.payments[0];
  if (!payment) throw badRequest("There is no captured payment to refund on this order.");
  const amount = round2(input.amount);
  const refundable = dec(payment.amount).minus(payment.refundedAmount);
  if (amount.lte(0)) throw badRequest("Refund amount must be greater than zero.");
  if (amount.gt(refundable)) throw badRequest(`You can refund at most ${moneyString(refundable)}.`);

  // Online payments are refunded through the provider first; COD refunds are recorded as manual payouts.
  let providerRefundId: string | null = null;
  if (payment.method !== "COD") {
    const provider = getProvider(payment.method);
    if (!provider.refund || !payment.providerPaymentId) {
      throw badRequest("This payment cannot be refunded automatically. Refund it in the provider dashboard first.");
    }
    const res = await provider.refund({
      providerPaymentId: payment.providerPaymentId,
      amount: moneyString(amount),
      currency: payment.currency,
    });
    providerRefundId = res.refundId;
  }

  const fullyRefunded = amount.equals(refundable);
  await prisma.$transaction(async (tx) => {
    const newRefunded = dec(payment.refundedAmount).plus(amount);
    const pStatus: PaymentStatus = fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await tx.payment.update({ where: { id: payment.id }, data: { refundedAmount: newRefunded, status: pStatus } });
    await tx.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        type: "REFUND",
        status: "succeeded",
        amount,
        providerEventId: providerRefundId,
        message: input.reason,
        createdById: actor.id,
      },
    });
    const orderData: Prisma.OrderUpdateInput = { paymentStatus: pStatus };
    if (fullyRefunded && canTransition(order.status, "REFUNDED", order.paymentStatus)) {
      orderData.status = "REFUNDED";
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: "REFUNDED", note: input.reason, changedById: actor.id },
      });
    }
    await tx.order.update({ where: { id: orderId }, data: orderData });
    if (input.restock) await restoreOrderStock(tx, orderId, "RETURN", actor.id);
  });
  if (fullyRefunded) await notifyStatusChange(orderId, `Refund of ${moneyString(amount)} ${order.currency} processed.`);
  return { refunded: moneyString(amount), fullyRefunded };
}

// ───────────── Stripe synchronisation (webhook + success page) ─────────────

/** Apply a Stripe Checkout Session's state to our records. Idempotent and safe to call repeatedly. */
export async function syncStripeCheckoutSession(session: Stripe.Checkout.Session, eventId?: string) {
  const payment = await prisma.payment.findUnique({ where: { providerReference: session.id }, include: { order: true } });
  if (!payment) {
    console.warn("[stripe] session without matching payment", session.id);
    return;
  }
  if (eventId) {
    const seen = await prisma.paymentTransaction.findUnique({ where: { providerEventId: eventId } });
    if (seen) return;
  }
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  if (session.payment_status === "paid" && payment.status !== "PAID" && payment.status !== "REFUNDED") {
    const amountPaid = session.amount_total !== null ? fromMinorUnits(session.amount_total) : moneyString(payment.amount);
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", paidAt: new Date(), providerPaymentId: paymentIntentId ?? null },
      });
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          type: "CHARGE",
          status: "succeeded",
          amount: amountPaid,
          providerEventId: eventId ?? `session:${session.id}:paid`,
          metadata: { sessionId: session.id, paymentIntentId },
        },
      });
      const confirm = payment.order.status === "PENDING";
      await tx.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: "PAID", ...(confirm ? { status: "CONFIRMED", confirmedAt: new Date() } : {}) },
      });
      if (confirm) {
        await tx.orderStatusHistory.create({
          data: { orderId: payment.orderId, fromStatus: "PENDING", toStatus: "CONFIRMED", note: "Payment received via Stripe" },
        });
      }
    });
    await sendOrderEmails(payment.orderId);
    await notifyAdmins({
      type: "payment.received",
      title: `Payment received for ${payment.order.orderNumber}`,
      link: `/admin/orders/${payment.orderId}`,
    });
    return;
  }

  if (session.status === "expired" && payment.status === "PENDING") {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "Checkout session expired" } });
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          type: "WEBHOOK",
          status: "expired",
          amount: 0,
          providerEventId: eventId ?? `session:${session.id}:expired`,
          message: "Checkout session expired without payment",
        },
      });
      await tx.order.update({ where: { id: payment.orderId }, data: { paymentStatus: "FAILED" } });
    });
    // Release reserved stock for abandoned online orders.
    const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
    if (order && order.status === "PENDING" && order.paymentStatus !== "PAID") {
      await changeOrderStatus(
        { orderId: order.id, to: "CANCELLED", note: "Payment not completed — order cancelled automatically", notifyCustomer: true },
        null,
      );
    }
  }
}

export async function recordStripePaymentFailure(paymentIntent: Stripe.PaymentIntent, eventId: string) {
  const paymentId = paymentIntent.metadata?.paymentId;
  if (!paymentId) return;
  const exists = await prisma.paymentTransaction.findUnique({ where: { providerEventId: eventId } });
  if (exists) return;
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  await prisma.paymentTransaction.create({
    data: {
      paymentId,
      type: "CHARGE",
      status: "failed",
      amount: fromMinorUnits(paymentIntent.amount),
      providerEventId: eventId,
      message: paymentIntent.last_payment_error?.message?.slice(0, 300) ?? "Payment failed",
    },
  });
  if (payment.status === "PENDING") {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { failureReason: paymentIntent.last_payment_error?.message?.slice(0, 300) ?? "Payment failed" },
    });
  }
}

// ───────────── Notes & returns ─────────────

export async function addOrderNote(orderId: string, body: string, authorId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) throw notFound("Order not found.");
  return prisma.orderNote.create({ data: { orderId, body, authorId } });
}

export async function requestReturn(
  userId: string,
  input: { orderId: string; orderItemId?: string; reason: string; details?: string; quantity: number },
) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
  if (!order || order.userId !== userId) throw notFound("Order not found.");
  if (order.status !== "DELIVERED") throw badRequest("Returns can be requested once your order has been delivered.");
  const { commerce } = await getSettings();
  const deliveredAt = order.deliveredAt ?? order.updatedAt;
  const windowEnds = new Date(deliveredAt.getTime() + commerce.returnWindowDays * 86_400_000);
  if (new Date() > windowEnds) throw badRequest(`The ${commerce.returnWindowDays}-day return window for this order has closed.`);
  if (input.orderItemId) {
    const item = order.items.find((i) => i.id === input.orderItemId);
    if (!item) throw badRequest("That item is not part of this order.");
    if (input.quantity > item.quantity) throw badRequest(`You ordered ${item.quantity} of this item.`);
  }
  const open = await prisma.returnRequest.findFirst({
    where: { orderId: order.id, orderItemId: input.orderItemId ?? null, status: { in: ["REQUESTED", "APPROVED", "RECEIVED"] } },
  });
  if (open) throw badRequest("A return request for this item is already in progress.");
  const request = await prisma.returnRequest.create({
    data: {
      orderId: order.id,
      orderItemId: input.orderItemId ?? null,
      userId,
      reason: input.reason,
      details: input.details ?? null,
      quantity: input.quantity,
    },
  });
  await notifyAdmins({
    type: "return.requested",
    title: `Return requested for ${order.orderNumber}`,
    body: input.reason,
    link: `/admin/returns`,
  });
  return request;
}

// ───────────── Queries ─────────────

export const orderDetailInclude = {
  items: true,
  statusHistory: { orderBy: { createdAt: "asc" as const }, include: { changedBy: { select: { name: true, isStaff: true } } } },
  payments: { orderBy: { createdAt: "desc" as const }, include: { transactions: { orderBy: { createdAt: "desc" as const } } } },
  returnRequests: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.OrderInclude;

export async function getCustomerOrder(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: orderDetailInclude });
  if (!order) return null;
  return stripInternal(order);
}

/** Guest order lookup by order number + email (rate limited at the route). */
export async function lookupOrder(orderNumber: string, email: string) {
  const order = await prisma.order.findFirst({
    where: { orderNumber: orderNumber.toUpperCase(), customerEmail: email.toLowerCase() },
    include: orderDetailInclude,
  });
  return order ? stripInternal(order) : null;
}

type OrderWithDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

/** Remove staff-only data (unit costs, internal transaction metadata, staff names) before showing to customers. */
function stripInternal(order: OrderWithDetail) {
  return {
    ...order,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- unitCost is deliberately removed for customers
    items: order.items.map(({ unitCost, ...rest }) => rest),
    statusHistory: order.statusHistory.map((h) => ({
      id: h.id,
      toStatus: h.toStatus,
      note: h.note,
      createdAt: h.createdAt,
    })),
    payments: order.payments.map((p) => ({
      id: p.id,
      method: p.method,
      status: p.status,
      amount: p.amount,
      refundedAmount: p.refundedAmount,
      paidAt: p.paidAt,
    })),
  };
}
export type CustomerOrder = NonNullable<Awaited<ReturnType<typeof getCustomerOrder>>>;

export function orderStatusIs(status: OrderStatus, ...statuses: OrderStatus[]) {
  return statuses.includes(status);
}

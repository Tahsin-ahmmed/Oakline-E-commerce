import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { isAppError, notFound } from "@/lib/errors";
import { moneyString } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";
import type { OrderListQuery } from "@/lib/validations/admin/sales";
import { addOrderNote, changeOrderStatus } from "@/services/orders";
import { logActivity } from "@/services/audit";

function parseDay(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setDate(d.getDate() + 1);
  return d;
}

export function orderWhere(q: Partial<OrderListQuery>): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (q.q) {
    const contains = { contains: q.q, mode: "insensitive" as const };
    and.push({
      OR: [{ orderNumber: contains }, { customerName: contains }, { customerEmail: contains }, { customerPhone: contains }],
    });
  }
  if (q.status) and.push({ status: q.status });
  if (q.payment) and.push({ paymentStatus: q.payment });
  if (q.method) and.push({ paymentMethod: q.method });
  const from = parseDay(q.from);
  const to = parseDay(q.to, true);
  if (from || to) and.push({ placedAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } });
  return and.length ? { AND: and } : {};
}

const ORDER_SORT: Record<OrderListQuery["sort"], Prisma.OrderOrderByWithRelationInput> = {
  newest: { placedAt: "desc" },
  oldest: { placedAt: "asc" },
  total_desc: { grandTotal: "desc" },
  total_asc: { grandTotal: "asc" },
};

export async function listAdminOrders(q: OrderListQuery) {
  const where = orderWhere(q);
  const [rows, total, agg] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: ORDER_SORT[q.sort],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        userId: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        grandTotal: true,
        currency: true,
        placedAt: true,
        shipDistrict: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { grandTotal: true } }),
  ]);
  return {
    items: rows.map((o) => ({ ...o, grandTotal: moneyString(o.grandTotal), placedAt: o.placedAt.toISOString() })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    sumTotal: moneyString(agg._sum.grandTotal ?? 0),
  };
}
export type AdminOrderRow = Awaited<ReturnType<typeof listAdminOrders>>["items"][number];

export async function getAdminOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { id: true, slug: true } } } },
      user: { select: { id: true, name: true, email: true, phone: true, createdAt: true, _count: { select: { orders: true } } } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true, isStaff: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      payments: {
        orderBy: { createdAt: "desc" },
        include: { transactions: { orderBy: { createdAt: "desc" } } },
      },
      returnRequests: { orderBy: { createdAt: "desc" }, include: { orderItem: { select: { productName: true, variantName: true } } } },
      coupon: { select: { id: true, code: true } },
    },
  });
}
export type AdminOrderDetail = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

export async function bulkChangeOrderStatus(
  ids: string[],
  to: OrderStatusValue,
  opts: { note?: string; notifyCustomer: boolean },
  actor: { id: string },
  ip?: string,
) {
  const orders = await prisma.order.findMany({ where: { id: { in: ids } }, select: { id: true, orderNumber: true } });
  const results: { id: string; orderNumber: string; ok: boolean; error?: string }[] = [];
  for (const id of ids) {
    const order = orders.find((o) => o.id === id);
    if (!order) {
      results.push({ id, orderNumber: "?", ok: false, error: "Order not found" });
      continue;
    }
    try {
      await changeOrderStatus(
        { orderId: id, to, note: opts.note || null, notifyCustomer: opts.notifyCustomer },
        actor,
      );
      results.push({ id, orderNumber: order.orderNumber, ok: true });
    } catch (e) {
      results.push({ id, orderNumber: order.orderNumber, ok: false, error: isAppError(e) ? e.message : "Unexpected error" });
      if (!isAppError(e)) console.error("[admin] bulk status failure", e);
    }
  }
  const succeeded = results.filter((r) => r.ok);
  if (succeeded.length) {
    await logActivity({
      user: actor,
      action: "order.bulk_status",
      entityType: "Order",
      summary: `Set ${succeeded.length} order(s) to ${ORDER_STATUS_LABELS[to]}`,
      metadata: { ids: succeeded.map((r) => r.id), status: to },
      ip,
    });
  }
  return { results, succeeded: succeeded.length, failed: results.length - succeeded.length };
}

export async function addAdminOrderNote(orderId: string, body: string, actor: { id: string }, ip?: string) {
  const note = await addOrderNote(orderId, body, actor.id);
  await logActivity({ user: actor, action: "order.note", entityType: "Order", entityId: orderId, summary: "Added internal note", ip });
  return note;
}

const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  // Prevent CSV/formula injection when opened in spreadsheet apps.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: unknown[][]) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export async function exportOrdersCsv(q: Partial<OrderListQuery>) {
  const orders = await prisma.order.findMany({
    where: orderWhere(q),
    orderBy: { placedAt: "desc" },
    take: 10_000,
    include: { _count: { select: { items: true } } },
  });
  const header = [
    "Order number", "Placed at", "Status", "Payment status", "Payment method", "Customer", "Email", "Phone",
    "District", "Division", "Items", "Subtotal", "Discount", "Shipping", "Tax", "Total", "Currency", "Coupon",
  ];
  return toCsv([
    header,
    ...orders.map((o) => [
      o.orderNumber,
      o.placedAt.toISOString(),
      ORDER_STATUS_LABELS[o.status],
      PAYMENT_STATUS_LABELS[o.paymentStatus],
      PAYMENT_METHOD_LABELS[o.paymentMethod],
      o.customerName,
      o.customerEmail,
      o.customerPhone,
      o.shipDistrict,
      o.shipDivision,
      o._count.items,
      moneyString(o.subtotal),
      moneyString(o.discountTotal),
      moneyString(o.shippingTotal),
      moneyString(o.taxTotal),
      moneyString(o.grandTotal),
      o.currency,
      o.couponCode ?? "",
    ]),
  ]);
}

export async function assertOrderExists(id: string) {
  const o = await prisma.order.findUnique({ where: { id }, select: { id: true, orderNumber: true } });
  if (!o) throw notFound("Order not found.");
  return o;
}

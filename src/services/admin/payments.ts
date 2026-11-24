import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { moneyString } from "@/lib/money";

export async function listPayments(opts: {
  q?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  page: number;
  pageSize: number;
}) {
  const and: Prisma.PaymentWhereInput[] = [];
  if (opts.q) {
    const contains = { contains: opts.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { providerReference: contains },
        { providerPaymentId: contains },
        { order: { orderNumber: contains } },
        { order: { customerName: contains } },
      ],
    });
  }
  if (opts.method) and.push({ method: opts.method });
  if (opts.status) and.push({ status: opts.status });
  const where: Prisma.PaymentWhereInput = and.length ? { AND: and } : {};
  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: {
        order: { select: { id: true, orderNumber: true, customerName: true, status: true } },
        _count: { select: { transactions: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);
  return {
    items: rows.map((p) => ({
      id: p.id,
      method: p.method,
      status: p.status,
      amount: moneyString(p.amount),
      refundedAmount: moneyString(p.refundedAmount),
      currency: p.currency,
      provider: p.provider,
      providerReference: p.providerReference,
      providerPaymentId: p.providerPaymentId,
      failureReason: p.failureReason,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      transactions: p._count.transactions,
      order: p.order,
    })),
    total,
  };
}

export async function paymentSummary() {
  const [collected, pendingCod, refunded, failed, awaiting] = await Promise.all([
    prisma.payment.aggregate({ where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { method: "COD", status: { in: ["UNPAID", "PENDING"] }, order: { status: { notIn: ["CANCELLED"] } } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({ _sum: { refundedAmount: true } }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.order.findMany({
      where: {
        paymentMethod: "COD",
        paymentStatus: { in: ["UNPAID", "PENDING"] },
        status: { in: ["SHIPPED", "OUT_FOR_DELIVERY"] },
      },
      orderBy: { shippedAt: "asc" },
      take: 10,
      select: { id: true, orderNumber: true, customerName: true, grandTotal: true, status: true, courier: true, shippedAt: true },
    }),
  ]);
  return {
    collected: moneyString(collected._sum.amount ?? 0),
    pendingCod: moneyString(pendingCod._sum.amount ?? 0),
    pendingCodCount: pendingCod._count,
    refunded: moneyString(refunded._sum.refundedAmount ?? 0),
    failed,
    awaitingCollection: awaiting.map((o) => ({ ...o, grandTotal: moneyString(o.grandTotal), shippedAt: o.shippedAt?.toISOString() ?? null })),
  };
}

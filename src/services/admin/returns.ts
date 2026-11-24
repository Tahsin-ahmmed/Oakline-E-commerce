import "server-only";
import { prisma } from "@/lib/prisma";
import type { ReturnStatus } from "@/generated/prisma/enums";
import { badRequest, notFound } from "@/lib/errors";
import { moneyString } from "@/lib/money";
import type { ReturnActionInput } from "@/lib/validations/admin/sales";
import { processRefund } from "@/services/orders";
import { logActivity } from "@/services/audit";
import { notifyCustomer } from "@/services/notifications";

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RECEIVED: "Received",
  REFUNDED: "Refunded",
};

const ALLOWED: Record<ReturnActionInput["action"], ReturnStatus[]> = {
  approve: ["REQUESTED"],
  reject: ["REQUESTED", "APPROVED"],
  receive: ["APPROVED"],
  refund: ["APPROVED", "RECEIVED"],
};

export async function listReturns(opts: { status?: ReturnStatus; page: number; pageSize: number }) {
  const where = opts.status ? { status: opts.status } : {};
  const [items, total, counts] = await Promise.all([
    prisma.returnRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerEmail: true,
            currency: true,
            grandTotal: true,
            paymentStatus: true,
            paymentMethod: true,
            payments: { select: { amount: true, refundedAmount: true, status: true }, orderBy: { createdAt: "desc" } },
          },
        },
        orderItem: { select: { productName: true, variantName: true, quantity: true, unitPrice: true, lineTotal: true } },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.returnRequest.count({ where }),
    prisma.returnRequest.groupBy({ by: ["status"], _count: true }),
  ]);
  return {
    items: items.map((r) => {
      const captured = r.order.payments.find((p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED");
      const refundable = captured ? Number(captured.amount) - Number(captured.refundedAmount) : 0;
      const suggested = r.orderItem ? Number(r.orderItem.unitPrice) * r.quantity : refundable;
      return {
        id: r.id,
        status: r.status,
        reason: r.reason,
        details: r.details,
        quantity: r.quantity,
        adminNote: r.adminNote,
        refundAmount: r.refundAmount ? moneyString(r.refundAmount) : null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        order: {
          id: r.order.id,
          orderNumber: r.order.orderNumber,
          customerName: r.order.customerName,
          customerEmail: r.order.customerEmail,
          currency: r.order.currency,
          paymentStatus: r.order.paymentStatus,
          paymentMethod: r.order.paymentMethod,
        },
        item: r.orderItem
          ? { productName: r.orderItem.productName, variantName: r.orderItem.variantName, orderedQuantity: r.orderItem.quantity }
          : null,
        refundable: moneyString(Math.max(0, refundable)),
        suggestedRefund: moneyString(Math.max(0, Math.min(refundable, suggested))),
        userId: r.user?.id ?? null,
      };
    }),
    total,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Partial<Record<ReturnStatus, number>>,
  };
}
export type AdminReturnRow = Awaited<ReturnType<typeof listReturns>>["items"][number];

export async function actOnReturn(id: string, input: ReturnActionInput, actor: { id: string }, ip?: string) {
  const request = await prisma.returnRequest.findUnique({
    where: { id },
    include: { order: { select: { id: true, orderNumber: true, userId: true } } },
  });
  if (!request) throw notFound("Return request not found.");
  if (!ALLOWED[input.action].includes(request.status)) {
    throw badRequest(`Cannot ${input.action} a return that is ${RETURN_STATUS_LABELS[request.status].toLowerCase()}.`);
  }
  const noteText = input.note?.trim() || null;
  let next: ReturnStatus;
  let refundAmount: string | null = null;
  if (input.action === "refund") {
    // Validated and executed against the captured payment server-side (amount ≤ refundable).
    const result = await processRefund(
      request.orderId,
      { amount: input.amount, reason: noteText ?? `Return refund: ${request.reason}`, restock: input.restock },
      actor,
    );
    refundAmount = result.refunded;
    next = "REFUNDED";
  } else {
    next = input.action === "approve" ? "APPROVED" : input.action === "reject" ? "REJECTED" : "RECEIVED";
  }
  const updated = await prisma.returnRequest.update({
    where: { id },
    data: {
      status: next,
      adminNote: noteText ?? request.adminNote,
      ...(refundAmount ? { refundAmount } : {}),
    },
  });
  await logActivity({
    user: actor,
    action: `return.${input.action}`,
    entityType: "ReturnRequest",
    entityId: id,
    summary: `Return for ${request.order.orderNumber} → ${RETURN_STATUS_LABELS[next]}${refundAmount ? ` (${refundAmount})` : ""}`,
    ip,
  });
  if (request.order.userId) {
    await notifyCustomer(request.order.userId, {
      type: "return.updated",
      title: `Your return for ${request.order.orderNumber} is ${RETURN_STATUS_LABELS[next].toLowerCase()}`,
      body: noteText ?? undefined,
      link: `/account/orders/${request.order.id}`,
    });
  }
  return updated;
}

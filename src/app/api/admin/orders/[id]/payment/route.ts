import { route } from "@/lib/api";
import { paymentStatusSchema } from "@/lib/validations/admin/sales";
import { updatePaymentStatus } from "@/services/orders";
import { assertOrderExists } from "@/services/admin/orders";
import { logActivity } from "@/services/audit";

/** POST /api/admin/orders/:id/payment — manual payment status (COD collections). Online payments are provider-confirmed. */
export const POST = route<{ id: string }>({ auth: "staff", permission: "payments.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(paymentStatusSchema);
  const order = await assertOrderExists(params.id);
  const updated = await updatePaymentStatus(params.id, input.status, user!, input.note || undefined);
  await logActivity({
    user,
    action: "order.payment_status",
    entityType: "Order",
    entityId: params.id,
    summary: `${order.orderNumber} payment → ${input.status}`,
    ip,
  });
  return { id: updated.id, paymentStatus: updated.paymentStatus };
});

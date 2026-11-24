import { route } from "@/lib/api";
import { refundSchema } from "@/lib/validations/admin/sales";
import { processRefund } from "@/services/orders";
import { assertOrderExists } from "@/services/admin/orders";
import { logActivity } from "@/services/audit";

/** POST /api/admin/orders/:id/refund — amount is validated against the captured payment on the server. */
export const POST = route<{ id: string }>({ auth: "staff", permission: "payments.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(refundSchema);
  const order = await assertOrderExists(params.id);
  const result = await processRefund(params.id, input, user!);
  await logActivity({
    user,
    action: "order.refund",
    entityType: "Order",
    entityId: params.id,
    summary: `Refunded ${result.refunded} on ${order.orderNumber}${result.fullyRefunded ? " (full)" : ""}`,
    metadata: { reason: input.reason, restock: input.restock },
    ip,
  });
  return result;
});

import { route } from "@/lib/api";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { orderStatusSchema } from "@/lib/validations/admin/sales";
import { changeOrderStatus } from "@/services/orders";
import { assertOrderExists } from "@/services/admin/orders";
import { logActivity } from "@/services/audit";

/** POST /api/admin/orders/:id/status — validated status transition (restocks on cancel/return). */
export const POST = route<{ id: string }>({ auth: "staff", permission: "orders.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(orderStatusSchema);
  const order = await assertOrderExists(params.id);
  const updated = await changeOrderStatus(
    {
      orderId: params.id,
      to: input.status,
      note: input.note || null,
      trackingNumber: input.trackingNumber === undefined ? undefined : input.trackingNumber,
      courier: input.courier === undefined ? undefined : input.courier,
      notifyCustomer: input.notifyCustomer,
    },
    user!,
  );
  await logActivity({
    user,
    action: "order.status",
    entityType: "Order",
    entityId: params.id,
    summary: `${order.orderNumber} → ${ORDER_STATUS_LABELS[input.status]}`,
    metadata: { note: input.note || undefined, trackingNumber: input.trackingNumber || undefined },
    ip,
  });
  return { id: updated.id, status: updated.status, paymentStatus: updated.paymentStatus };
});

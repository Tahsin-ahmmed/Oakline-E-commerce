import { route } from "@/lib/api";
import { bulkOrderStatusSchema } from "@/lib/validations/admin/sales";
import { bulkChangeOrderStatus } from "@/services/admin/orders";

/** POST /api/admin/orders/bulk-status — applies a status to many orders; invalid transitions are reported per order. */
export const POST = route({ auth: "staff", permission: "orders.manage" }, async ({ json, user, ip }) => {
  const input = await json(bulkOrderStatusSchema);
  return bulkChangeOrderStatus(input.ids, input.status, { note: input.note, notifyCustomer: input.notifyCustomer }, user!, ip);
});

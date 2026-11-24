import { route } from "@/lib/api";
import { customerStatusSchema } from "@/lib/validations/admin/sales";
import { setCustomerStatus } from "@/services/admin/customers";

/** POST /api/admin/customers/:id/status — block (revokes all sessions) or unblock. */
export const POST = route<{ id: string }>({ auth: "staff", permission: "customers.manage" }, async ({ params, json, user, ip }) => {
  const { status } = await json(customerStatusSchema);
  return setCustomerStatus(params.id, status, user!, ip);
});

import { route } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { returnActionSchema } from "@/lib/validations/admin/sales";
import { actOnReturn } from "@/services/admin/returns";

/** PATCH /api/admin/returns/:id — approve / reject / receive / refund a return request. */
export const PATCH = route<{ id: string }>({ auth: "staff", permission: "orders.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(returnActionSchema);
  if (input.action === "refund" && !hasPermission(user, "payments.manage")) throw forbidden("Refunds require payment permissions.");
  const updated = await actOnReturn(params.id, input, user!, ip);
  return { id: updated.id, status: updated.status };
});

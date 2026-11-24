import { route } from "@/lib/api";
import { stripHtml } from "@/lib/sanitize";
import { orderNoteSchema } from "@/lib/validations/admin/sales";
import { addAdminOrderNote } from "@/services/admin/orders";

/** POST /api/admin/orders/:id/notes — internal, staff-only note. */
export const POST = route<{ id: string }>({ auth: "staff", permission: "orders.manage" }, async ({ params, json, user, ip }) => {
  const { body } = await json(orderNoteSchema);
  return addAdminOrderNote(params.id, stripHtml(body), user!, ip);
});

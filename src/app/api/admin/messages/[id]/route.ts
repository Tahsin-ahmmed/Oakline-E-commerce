import { route } from "@/lib/api";
import { contactStatusSchema } from "@/lib/validations/admin/sales";
import { setContactStatus } from "@/services/admin/messages";

export const PATCH = route<{ id: string }>({ auth: "staff", permission: "messages.manage" }, async ({ params, json, user, ip }) => {
  const { status } = await json(contactStatusSchema);
  await setContactStatus(params.id, status, user!, ip);
  return { id: params.id, status };
});

import { route } from "@/lib/api";
import { subscriberStatusSchema } from "@/lib/validations/admin/sales";
import { setSubscriberStatus } from "@/services/admin/messages";

export const PATCH = route<{ id: string }>({ auth: "staff", permission: "messages.manage" }, async ({ params, json, user, ip }) => {
  const { status } = await json(subscriberStatusSchema);
  await setSubscriberStatus(params.id, status, user!, ip);
  return { id: params.id, status };
});

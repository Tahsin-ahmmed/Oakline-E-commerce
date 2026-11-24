import { z } from "zod";
import { route } from "@/lib/api";
import { listAdminNotifications, markAdminNotificationsRead } from "@/services/notifications";

export const GET = route({ auth: "staff" }, async () => listAdminNotifications());

export const POST = route({ auth: "staff" }, async ({ json }) => {
  const { ids } = await json(z.object({ ids: z.array(z.string().max(40)).max(100).optional() }));
  await markAdminNotificationsRead(ids);
  return { ok: true };
});

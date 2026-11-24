import { z } from "zod";
import { route } from "@/lib/api";
import { exportSubscribersCsv } from "@/services/admin/messages";
import { logActivity } from "@/services/audit";

export const GET = route({ auth: "staff", permission: "messages.manage" }, async ({ query, user, ip }) => {
  const q = query(
    z.object({
      q: z.string().trim().max(100).optional(),
      status: z.enum(["SUBSCRIBED", "UNSUBSCRIBED"]).optional().catch(undefined),
    }),
  );
  const csv = await exportSubscribersCsv(q);
  await logActivity({ user, action: "newsletter.export", entityType: "NewsletterSubscriber", summary: "Exported subscribers CSV", ip });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});

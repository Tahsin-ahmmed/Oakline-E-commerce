import { z } from "zod";
import { route } from "@/lib/api";
import { listContactMessages } from "@/services/admin/messages";

export const GET = route({ auth: "staff", permission: "messages.manage" }, async ({ query }) => {
  const q = query(
    z.object({
      q: z.string().trim().max(100).optional(),
      status: z.enum(["NEW", "READ", "REPLIED", "ARCHIVED"]).optional().catch(undefined),
      page: z.coerce.number().int().min(1).catch(1).default(1),
      pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
    }),
  );
  return listContactMessages(q);
});

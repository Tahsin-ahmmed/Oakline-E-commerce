import { z } from "zod";
import { route } from "@/lib/api";
import { listCustomers } from "@/services/admin/customers";

/** GET /api/admin/customers — customers with order count and lifetime spend. */
export const GET = route({ auth: "staff", permission: "customers.view" }, async ({ query }) => {
  const q = query(
    z.object({
      q: z.string().trim().max(100).optional(),
      status: z.enum(["ACTIVE", "BLOCKED"]).optional().catch(undefined),
      sort: z.enum(["joined_desc", "joined_asc", "spend_desc", "orders_desc", "name_asc"]).catch("joined_desc").default("joined_desc"),
      page: z.coerce.number().int().min(1).catch(1).default(1),
      pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
    }),
  );
  return listCustomers(q);
});

import { z } from "zod";
import { route } from "@/lib/api";
import { listReturns } from "@/services/admin/returns";

export const GET = route({ auth: "staff", permission: "orders.view" }, async ({ query }) => {
  const q = query(
    z.object({
      status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "REFUNDED"]).optional().catch(undefined),
      page: z.coerce.number().int().min(1).catch(1).default(1),
      pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
    }),
  );
  return listReturns(q);
});

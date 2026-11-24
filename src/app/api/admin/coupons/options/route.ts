import { z } from "zod";
import { route } from "@/lib/api";
import { couponOptions } from "@/services/admin/coupons";

/** GET /api/admin/coupons/options?q= — categories and product search for coupon restrictions. */
export const GET = route({ auth: "staff", permission: "coupons.manage" }, async ({ query }) => {
  const { q } = query(z.object({ q: z.string().trim().max(80).optional() }));
  return couponOptions(q);
});

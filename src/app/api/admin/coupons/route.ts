import { z } from "zod";
import { route } from "@/lib/api";
import { couponSchema } from "@/lib/validations/admin/sales";
import { createCoupon, listCoupons } from "@/services/admin/coupons";

export const GET = route({ auth: "staff", permission: "coupons.manage" }, async ({ query }) => {
  const q = query(
    z.object({
      q: z.string().trim().max(60).optional(),
      state: z.enum(["active", "scheduled", "expired", "inactive"]).optional().catch(undefined),
      page: z.coerce.number().int().min(1).catch(1).default(1),
      pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
    }),
  );
  return listCoupons(q);
});

export const POST = route({ auth: "staff", permission: "coupons.manage" }, async ({ json, user, ip }) => {
  const input = await json(couponSchema);
  const coupon = await createCoupon(input, user!, ip);
  return { id: coupon.id, code: coupon.code };
});

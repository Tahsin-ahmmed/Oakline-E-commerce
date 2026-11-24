import { z } from "zod";
import { route } from "@/lib/api";
import { couponSchema } from "@/lib/validations/admin/sales";
import { deleteCoupon, getCouponUsage, setCouponActive, updateCoupon } from "@/services/admin/coupons";

/** GET /api/admin/coupons/:id — usage history. */
export const GET = route<{ id: string }>({ auth: "staff", permission: "coupons.manage" }, async ({ params }) => ({
  usages: await getCouponUsage(params.id),
}));

/** PUT /api/admin/coupons/:id — full update. */
export const PUT = route<{ id: string }>({ auth: "staff", permission: "coupons.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(couponSchema);
  const coupon = await updateCoupon(params.id, input, user!, ip);
  return { id: coupon.id, code: coupon.code };
});

/** PATCH /api/admin/coupons/:id — toggle active status. */
export const PATCH = route<{ id: string }>({ auth: "staff", permission: "coupons.manage" }, async ({ params, json, user, ip }) => {
  const { isActive } = await json(z.object({ isActive: z.boolean() }));
  await setCouponActive(params.id, isActive, user!, ip);
  return { id: params.id, isActive };
});

/** DELETE /api/admin/coupons/:id — soft delete. */
export const DELETE = route<{ id: string }>({ auth: "staff", permission: "coupons.manage" }, async ({ params, user, ip }) => {
  await deleteCoupon(params.id, user!, ip);
  return { deleted: true };
});

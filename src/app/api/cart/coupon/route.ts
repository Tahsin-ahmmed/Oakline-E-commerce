import { route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { couponApplySchema } from "@/lib/validations/checkout";
import { applyCartCoupon, getCartView, removeCartCoupon } from "@/services/cart";

export const POST = route({ auth: "optional", rateLimit: RATE_LIMITS.coupon }, async ({ json }) => {
  const { code } = await json(couponApplySchema);
  await applyCartCoupon(code);
  return getCartView();
});

export const DELETE = route({ auth: "optional" }, async () => {
  await removeCartCoupon();
  return getCartView();
});

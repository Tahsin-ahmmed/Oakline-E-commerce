import { route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { moneyString } from "@/lib/money";
import { couponApplySchema } from "@/lib/validations/checkout";
import { getCurrentCartId, loadPricedLines } from "@/services/cart";
import { validateCoupon } from "@/services/coupons";

/** POST /api/coupons/validate — check a code against the current cart without applying it. */
export const POST = route({ auth: "optional", rateLimit: RATE_LIMITS.coupon }, async ({ json, user }) => {
  const { code } = await json(couponApplySchema);
  const cartId = await getCurrentCartId();
  const lines = cartId ? (await loadPricedLines(cartId)).filter((l) => l.purchasable) : [];
  const result = await validateCoupon(
    code,
    lines.map((l) => ({ productId: l.productId, categoryIds: l.categoryIds, lineTotal: l.lineTotal })),
    { userId: user?.id, email: user?.email },
  );
  if (!result.ok) return { valid: false, reason: result.reason };
  return { valid: true, code: result.code, discount: moneyString(result.discount), freeShipping: result.freeShipping };
});

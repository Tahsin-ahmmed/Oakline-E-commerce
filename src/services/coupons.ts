import "server-only";
import { prisma, type Tx } from "@/lib/prisma";
import { evaluateCoupon, type CouponResult, type CouponRule, type PricedLine } from "@/lib/pricing";

export async function loadCouponRule(code: string, db: Tx | typeof prisma = prisma) {
  const coupon = await db.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { products: { select: { id: true } }, categories: { select: { id: true } } },
  });
  if (!coupon) return null;
  const rule: CouponRule = {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minPurchase: coupon.minPurchase,
    maxDiscount: coupon.maxDiscount,
    startsAt: coupon.startsAt,
    expiresAt: coupon.expiresAt,
    usageLimit: coupon.usageLimit,
    perCustomerLimit: coupon.perCustomerLimit,
    usedCount: coupon.usedCount,
    isActive: coupon.isActive,
    deletedAt: coupon.deletedAt,
    productIds: coupon.products.map((p) => p.id),
    categoryIds: coupon.categories.map((c) => c.id),
  };
  return { coupon, rule };
}

export async function customerCouponUsage(
  couponId: string,
  who: { userId?: string | null; email?: string | null },
  db: Tx | typeof prisma = prisma,
) {
  const or = [
    ...(who.userId ? [{ userId: who.userId }] : []),
    ...(who.email ? [{ email: who.email.toLowerCase() }] : []),
  ];
  if (!or.length) return 0;
  return db.couponUsage.count({ where: { couponId, OR: or } });
}

/** Validate a coupon code against priced cart lines. All checks run on the server. */
export async function validateCoupon(
  code: string,
  lines: PricedLine[],
  who: { userId?: string | null; email?: string | null },
  db: Tx | typeof prisma = prisma,
): Promise<CouponResult & { couponId?: string; code?: string }> {
  const loaded = await loadCouponRule(code, db);
  if (!loaded) return { ok: false, reason: "We couldn't find that coupon code." };
  const usage = await customerCouponUsage(loaded.coupon.id, who, db);
  const result = evaluateCoupon(loaded.rule, { lines, customerUsageCount: usage });
  return { ...result, couponId: loaded.coupon.id, code: loaded.coupon.code };
}

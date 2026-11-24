import { z } from "zod";
import { route } from "@/lib/api";
import { Decimal, moneyString } from "@/lib/money";
import { computeTotals } from "@/lib/pricing";
import { getCurrentCartId, loadPricedLines } from "@/services/cart";
import { validateCoupon } from "@/services/coupons";
import { getShippingOptions } from "@/services/shipping";
import { getSettings } from "@/services/settings";

const schema = z.object({
  division: z.string().min(1).max(60),
  district: z.string().min(1).max(60),
  area: z.string().max(80).optional(),
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
});

/**
 * POST /api/shipping/quote — delivery options and a full server-side price breakdown for the
 * current cart and destination. Used by checkout to show totals; the order endpoint recomputes everything.
 */
export const POST = route({ auth: "optional" }, async ({ json, user }) => {
  const input = await json(schema);
  const settings = await getSettings();
  const cartId = await getCurrentCartId();
  const lines = cartId ? (await loadPricedLines(cartId)).filter((l) => l.purchasable) : [];
  const priced = lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity }));

  let discount = new Decimal(0);
  let freeShippingCoupon = false;
  let couponError: string | null = null;
  if (input.couponCode) {
    const result = await validateCoupon(
      input.couponCode,
      lines.map((l) => ({ productId: l.productId, categoryIds: l.categoryIds, lineTotal: l.lineTotal })),
      { userId: user?.id, email: user?.email },
    );
    if (result.ok) {
      discount = result.discount;
      freeShippingCoupon = result.freeShipping;
    } else couponError = result.reason;
  }
  const pre = computeTotals({ lines: priced, discount });
  const options = await getShippingOptions(
    { division: input.division, district: input.district, area: input.area },
    pre.subtotal.minus(pre.discount),
    { storeFreeThreshold: settings.commerce.freeShippingThreshold, freeShippingCoupon },
  );
  const tax = { rate: settings.commerce.taxEnabled ? settings.commerce.taxRate : 0, inclusive: settings.commerce.taxInclusive };
  return {
    options: options.map((o) => {
      const totals = computeTotals({ lines: priced, discount, shipping: o.fee, taxRate: tax.rate, taxInclusive: tax.inclusive });
      return { ...o, total: moneyString(totals.total), tax: moneyString(totals.tax) };
    }),
    subtotal: moneyString(pre.subtotal),
    discount: moneyString(pre.discount),
    couponError,
    freeShippingCoupon,
    taxInclusive: tax.inclusive,
    taxRate: tax.rate,
  };
});

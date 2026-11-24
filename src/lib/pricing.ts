/**
 * Pure pricing rules shared by cart, checkout and tests.
 * Nothing in here touches the database or trusts client input.
 */
import { Decimal, dec, round2, type MoneyInput } from "@/lib/money";

// ───────────── Unit prices ─────────────

export interface PriceSource {
  price: MoneyInput;
  salePrice?: MoneyInput;
}

export interface VariantPriceSource {
  price?: MoneyInput;
  salePrice?: MoneyInput;
}

export interface ResolvedPrice {
  regular: Decimal;
  sale: Decimal | null;
  effective: Decimal;
  onSale: boolean;
}

/**
 * Resolve the selling price of a variant.
 * A variant with its own price fully overrides the product price (and only its own sale price applies).
 * Otherwise the product price applies, with the variant's sale price taking precedence over the product's.
 */
export function resolvePrice(product: PriceSource, variant?: VariantPriceSource | null): ResolvedPrice {
  const hasOwnPrice = variant?.price !== null && variant?.price !== undefined && variant.price !== "";
  const regular = round2(hasOwnPrice ? variant!.price : product.price);
  const rawSale = hasOwnPrice ? variant?.salePrice : (variant?.salePrice ?? product.salePrice);
  const sale = rawSale !== null && rawSale !== undefined && rawSale !== "" ? round2(rawSale) : null;
  const onSale = sale !== null && sale.gt(0) && sale.lt(regular);
  return { regular, sale: onSale ? sale : null, effective: onSale ? sale! : regular, onSale };
}

// ───────────── Coupons ─────────────

export type CouponKind = "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";

export interface CouponRule {
  code: string;
  type: CouponKind;
  value: MoneyInput;
  minPurchase?: MoneyInput;
  maxDiscount?: MoneyInput;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  usedCount: number;
  isActive: boolean;
  deletedAt?: Date | null;
  productIds: string[];
  categoryIds: string[];
}

export interface PricedLine {
  productId: string;
  categoryIds: string[];
  lineTotal: MoneyInput;
}

export interface CouponContext {
  lines: PricedLine[];
  now?: Date;
  /** Times this customer (by user id or email) already used the coupon. */
  customerUsageCount?: number;
}

export type CouponResult =
  | { ok: true; discount: Decimal; freeShipping: boolean; eligibleSubtotal: Decimal }
  | { ok: false; reason: string };

export function evaluateCoupon(coupon: CouponRule, ctx: CouponContext): CouponResult {
  const now = ctx.now ?? new Date();
  if (!coupon.isActive || coupon.deletedAt) return { ok: false, reason: "This coupon is not active." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, reason: "This coupon is not active yet." };
  if (coupon.expiresAt && coupon.expiresAt <= now) return { ok: false, reason: "This coupon has expired." };
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "This coupon has reached its usage limit." };
  }
  if (
    coupon.perCustomerLimit !== null &&
    coupon.perCustomerLimit !== undefined &&
    (ctx.customerUsageCount ?? 0) >= coupon.perCustomerLimit
  ) {
    return { ok: false, reason: "You have already used this coupon the maximum number of times." };
  }
  if (ctx.lines.length === 0) return { ok: false, reason: "Your cart is empty." };

  const restricted = coupon.productIds.length > 0 || coupon.categoryIds.length > 0;
  const eligibleLines = restricted
    ? ctx.lines.filter(
        (l) =>
          coupon.productIds.includes(l.productId) || l.categoryIds.some((c) => coupon.categoryIds.includes(c)),
      )
    : ctx.lines;
  if (eligibleLines.length === 0) {
    return { ok: false, reason: "This coupon does not apply to the items in your cart." };
  }
  const eligibleSubtotal = round2(eligibleLines.reduce((sum, l) => sum.plus(dec(l.lineTotal)), new Decimal(0)));

  const min = coupon.minPurchase !== null && coupon.minPurchase !== undefined ? dec(coupon.minPurchase) : null;
  if (min && eligibleSubtotal.lt(min)) {
    return { ok: false, reason: `A minimum purchase of ${min.toFixed(2)} is required for this coupon.` };
  }

  let discount = new Decimal(0);
  let freeShipping = false;
  if (coupon.type === "PERCENTAGE") {
    const pct = Decimal.min(Decimal.max(dec(coupon.value), 0), 100);
    discount = eligibleSubtotal.times(pct).div(100);
  } else if (coupon.type === "FIXED") {
    discount = Decimal.max(dec(coupon.value), 0);
  } else {
    freeShipping = true;
  }
  if (coupon.maxDiscount !== null && coupon.maxDiscount !== undefined && dec(coupon.maxDiscount).gt(0)) {
    discount = Decimal.min(discount, dec(coupon.maxDiscount));
  }
  discount = round2(Decimal.min(discount, eligibleSubtotal));
  return { ok: true, discount, freeShipping, eligibleSubtotal };
}

// ───────────── Shipping ─────────────

export interface ZoneRule {
  id: string;
  divisions: string[];
  districts: string[];
  areas: string[];
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface Destination {
  division: string;
  district: string;
  area?: string | null;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Pick the most specific active zone for a destination: area > district > division > default. */
export function matchShippingZone<Z extends ZoneRule>(zones: Z[], dest: Destination): Z | null {
  const active = zones.filter((z) => z.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const area = norm(dest.area);
  const district = norm(dest.district);
  const division = norm(dest.division);
  return (
    (area ? active.find((z) => z.areas.map(norm).includes(area)) : undefined) ??
    active.find((z) => z.districts.map(norm).includes(district)) ??
    active.find((z) => z.divisions.map(norm).includes(division)) ??
    active.find((z) => z.isDefault) ??
    null
  );
}

export interface MethodRule {
  fee: MoneyInput;
  freeShippingThreshold?: MoneyInput;
}

/**
 * Shipping fee for a method given the merchandise subtotal (after discounts).
 * Free when the method threshold or the store-wide threshold is reached, or a free-shipping coupon applies.
 */
export function shippingFee(
  method: MethodRule,
  subtotalAfterDiscount: MoneyInput,
  opts: { storeFreeThreshold?: MoneyInput; freeShippingCoupon?: boolean } = {},
): Decimal {
  if (opts.freeShippingCoupon) return new Decimal(0);
  const sub = dec(subtotalAfterDiscount);
  const thresholds = [method.freeShippingThreshold, opts.storeFreeThreshold]
    .filter((t) => t !== null && t !== undefined && t !== "")
    .map((t) => dec(t))
    .filter((t) => t.gt(0));
  if (thresholds.some((t) => sub.gte(t))) return new Decimal(0);
  return round2(Decimal.max(dec(method.fee), 0));
}

// ───────────── Totals ─────────────

export interface TotalsInput {
  lines: { unitPrice: MoneyInput; quantity: number }[];
  discount?: MoneyInput;
  shipping?: MoneyInput;
  /** Tax rate as a percentage, e.g. 5 for 5%. */
  taxRate?: MoneyInput;
  /** When true, prices already include tax and tax is reported but not added. */
  taxInclusive?: boolean;
}

export interface Totals {
  subtotal: Decimal;
  discount: Decimal;
  shipping: Decimal;
  tax: Decimal;
  total: Decimal;
}

export function lineTotal(unitPrice: MoneyInput, quantity: number): Decimal {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error("Quantity must be a non-negative integer");
  return round2(dec(unitPrice).times(quantity));
}

export function computeTotals(input: TotalsInput): Totals {
  const subtotal = round2(
    input.lines.reduce((sum, l) => sum.plus(lineTotal(l.unitPrice, l.quantity)), new Decimal(0)),
  );
  const discount = round2(Decimal.min(Decimal.max(dec(input.discount), 0), subtotal));
  const shipping = round2(Decimal.max(dec(input.shipping), 0));
  const taxable = subtotal.minus(discount);
  const rate = Decimal.max(dec(input.taxRate), 0);
  let tax = new Decimal(0);
  if (rate.gt(0)) {
    tax = input.taxInclusive
      ? round2(taxable.minus(taxable.div(rate.div(100).plus(1))))
      : round2(taxable.times(rate).div(100));
  }
  const total = round2(taxable.plus(shipping).plus(input.taxInclusive ? 0 : tax));
  return { subtotal, discount, shipping, tax, total };
}

// ───────────── Inventory ─────────────

export type StockState = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export function stockState(quantity: number, lowStockThreshold = 5): StockState {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

/** Validate a requested quantity against available stock. Returns the allowed quantity and a warning. */
export function clampToStock(requested: number, available: number): { quantity: number; warning: string | null } {
  if (available <= 0) return { quantity: 0, warning: "This item is out of stock." };
  if (requested > available) {
    return { quantity: available, warning: `Only ${available} left in stock — quantity adjusted.` };
  }
  return { quantity: requested, warning: null };
}

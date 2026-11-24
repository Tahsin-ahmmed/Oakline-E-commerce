import { describe, expect, it } from "vitest";
import {
  clampToStock,
  computeTotals,
  evaluateCoupon,
  lineTotal,
  matchShippingZone,
  resolvePrice,
  shippingFee,
  stockState,
  type CouponRule,
  type ZoneRule,
} from "@/lib/pricing";

describe("resolvePrice", () => {
  it("uses the product price when there is no sale", () => {
    const p = resolvePrice({ price: "1200", salePrice: null });
    expect(p.effective.toFixed(2)).toBe("1200.00");
    expect(p.onSale).toBe(false);
    expect(p.sale).toBeNull();
  });

  it("applies a valid sale price", () => {
    const p = resolvePrice({ price: "1200", salePrice: "999.99" });
    expect(p.effective.toFixed(2)).toBe("999.99");
    expect(p.onSale).toBe(true);
  });

  it("ignores a sale price that is not lower than the regular price", () => {
    expect(resolvePrice({ price: 100, salePrice: 100 }).onSale).toBe(false);
    expect(resolvePrice({ price: 100, salePrice: 150 }).effective.toNumber()).toBe(100);
    expect(resolvePrice({ price: 100, salePrice: 0 }).effective.toNumber()).toBe(100);
  });

  it("lets a variant price fully override the product price and sale", () => {
    const p = resolvePrice({ price: 1000, salePrice: 800 }, { price: 1500, salePrice: null });
    expect(p.effective.toNumber()).toBe(1500);
    expect(p.onSale).toBe(false);
  });

  it("applies a variant sale price over the product price", () => {
    const p = resolvePrice({ price: 1000, salePrice: 900 }, { price: null, salePrice: 850 });
    expect(p.effective.toNumber()).toBe(850);
  });

  it("falls back to the product sale price for variants without overrides", () => {
    expect(resolvePrice({ price: 1000, salePrice: 900 }, { price: null, salePrice: null }).effective.toNumber()).toBe(900);
  });
});

describe("lineTotal / computeTotals", () => {
  it("multiplies with decimal precision (no float drift)", () => {
    expect(lineTotal("0.10", 3).toFixed(2)).toBe("0.30");
    expect(lineTotal("19.99", 3).toFixed(2)).toBe("59.97");
  });

  it("rejects negative or fractional quantities", () => {
    expect(() => lineTotal(10, -1)).toThrow();
    expect(() => lineTotal(10, 1.5)).toThrow();
  });

  it("computes subtotal, discount, shipping and total", () => {
    const t = computeTotals({
      lines: [
        { unitPrice: "2690.00", quantity: 2 },
        { unitPrice: "850.00", quantity: 1 },
      ],
      discount: "500",
      shipping: "70",
    });
    expect(t.subtotal.toFixed(2)).toBe("6230.00");
    expect(t.discount.toFixed(2)).toBe("500.00");
    expect(t.total.toFixed(2)).toBe("5800.00");
  });

  it("never lets the discount exceed the subtotal", () => {
    const t = computeTotals({ lines: [{ unitPrice: 100, quantity: 1 }], discount: 500, shipping: 50 });
    expect(t.discount.toNumber()).toBe(100);
    expect(t.total.toNumber()).toBe(50);
  });

  it("adds exclusive tax on the discounted amount", () => {
    const t = computeTotals({ lines: [{ unitPrice: 1000, quantity: 1 }], discount: 100, taxRate: 5, taxInclusive: false });
    expect(t.tax.toFixed(2)).toBe("45.00");
    expect(t.total.toFixed(2)).toBe("945.00");
  });

  it("reports inclusive tax without adding it to the total", () => {
    const t = computeTotals({ lines: [{ unitPrice: 1050, quantity: 1 }], taxRate: 5, taxInclusive: true });
    expect(t.tax.toFixed(2)).toBe("50.00");
    expect(t.total.toFixed(2)).toBe("1050.00");
  });
});

const baseCoupon: CouponRule = {
  code: "TEST",
  type: "PERCENTAGE",
  value: 10,
  usedCount: 0,
  isActive: true,
  productIds: [],
  categoryIds: [],
};
const lines = [
  { productId: "p1", categoryIds: ["c1"], lineTotal: "3000.00" },
  { productId: "p2", categoryIds: ["c2"], lineTotal: "1000.00" },
];

describe("evaluateCoupon", () => {
  it("applies a percentage discount to the whole cart", () => {
    const r = evaluateCoupon(baseCoupon, { lines });
    expect(r.ok && r.discount.toFixed(2)).toBe("400.00");
  });

  it("caps percentage discounts at maxDiscount", () => {
    const r = evaluateCoupon({ ...baseCoupon, value: 50, maxDiscount: 300 }, { lines });
    expect(r.ok && r.discount.toNumber()).toBe(300);
  });

  it("applies fixed discounts but never more than the eligible subtotal", () => {
    const r = evaluateCoupon({ ...baseCoupon, type: "FIXED", value: 9000 }, { lines });
    expect(r.ok && r.discount.toNumber()).toBe(4000);
  });

  it("returns free shipping with zero discount for FREE_SHIPPING coupons", () => {
    const r = evaluateCoupon({ ...baseCoupon, type: "FREE_SHIPPING", value: 0 }, { lines });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.freeShipping).toBe(true);
      expect(r.discount.toNumber()).toBe(0);
    }
  });

  it("restricts eligibility to listed categories/products", () => {
    const r = evaluateCoupon({ ...baseCoupon, categoryIds: ["c2"] }, { lines });
    expect(r.ok && r.discount.toNumber()).toBe(100);
    const none = evaluateCoupon({ ...baseCoupon, productIds: ["zzz"] }, { lines });
    expect(none.ok).toBe(false);
  });

  it("enforces minimum purchase against the eligible subtotal", () => {
    const r = evaluateCoupon({ ...baseCoupon, minPurchase: 5000 }, { lines });
    expect(r.ok).toBe(false);
  });

  it("rejects inactive, deleted, expired, not-yet-started and exhausted coupons", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(evaluateCoupon({ ...baseCoupon, isActive: false }, { lines, now }).ok).toBe(false);
    expect(evaluateCoupon({ ...baseCoupon, deletedAt: now }, { lines, now }).ok).toBe(false);
    expect(evaluateCoupon({ ...baseCoupon, expiresAt: new Date("2026-05-31") }, { lines, now }).ok).toBe(false);
    expect(evaluateCoupon({ ...baseCoupon, startsAt: new Date("2026-06-02") }, { lines, now }).ok).toBe(false);
    expect(evaluateCoupon({ ...baseCoupon, usageLimit: 5, usedCount: 5 }, { lines, now }).ok).toBe(false);
  });

  it("enforces the per-customer limit", () => {
    const rule = { ...baseCoupon, perCustomerLimit: 1 };
    expect(evaluateCoupon(rule, { lines, customerUsageCount: 0 }).ok).toBe(true);
    expect(evaluateCoupon(rule, { lines, customerUsageCount: 1 }).ok).toBe(false);
  });

  it("rejects an empty cart", () => {
    expect(evaluateCoupon(baseCoupon, { lines: [] }).ok).toBe(false);
  });
});

describe("shipping", () => {
  const zones: ZoneRule[] = [
    { id: "dhaka", divisions: [], districts: ["Dhaka"], areas: [], isDefault: false, isActive: true, sortOrder: 0 },
    { id: "gulshan", divisions: [], districts: [], areas: ["Gulshan"], isDefault: false, isActive: true, sortOrder: 1 },
    { id: "ctg-div", divisions: ["Chattogram"], districts: [], areas: [], isDefault: false, isActive: true, sortOrder: 2 },
    { id: "rest", divisions: [], districts: [], areas: [], isDefault: true, isActive: true, sortOrder: 3 },
    { id: "off", divisions: [], districts: ["Sylhet"], areas: [], isDefault: false, isActive: false, sortOrder: 4 },
  ];

  it("prefers area over district over division over default", () => {
    expect(matchShippingZone(zones, { division: "Dhaka", district: "Dhaka", area: "gulshan" })?.id).toBe("gulshan");
    expect(matchShippingZone(zones, { division: "Dhaka", district: "Dhaka", area: "Mirpur" })?.id).toBe("dhaka");
    expect(matchShippingZone(zones, { division: "Chattogram", district: "Cumilla" })?.id).toBe("ctg-div");
    expect(matchShippingZone(zones, { division: "Rajshahi", district: "Bogura" })?.id).toBe("rest");
  });

  it("ignores inactive zones", () => {
    expect(matchShippingZone(zones, { division: "Sylhet", district: "Sylhet" })?.id).toBe("rest");
  });

  it("returns null when nothing matches and there is no default", () => {
    expect(matchShippingZone(zones.filter((z) => !z.isDefault), { division: "Khulna", district: "Khulna" })).toBeNull();
  });

  it("charges the method fee below thresholds and nothing at/above them", () => {
    const method = { fee: 130, freeShippingThreshold: 3000 };
    expect(shippingFee(method, 2999.99).toNumber()).toBe(130);
    expect(shippingFee(method, 3000).toNumber()).toBe(0);
    expect(shippingFee({ fee: 130 }, 5000, { storeFreeThreshold: 5000 }).toNumber()).toBe(0);
    expect(shippingFee({ fee: 130 }, 100, { freeShippingCoupon: true }).toNumber()).toBe(0);
  });

  it("treats zero thresholds as disabled", () => {
    expect(shippingFee({ fee: 70, freeShippingThreshold: 0 }, 1, { storeFreeThreshold: 0 }).toNumber()).toBe(70);
  });
});

describe("inventory helpers", () => {
  it("classifies stock levels", () => {
    expect(stockState(0)).toBe("OUT_OF_STOCK");
    expect(stockState(-2)).toBe("OUT_OF_STOCK");
    expect(stockState(3, 5)).toBe("LOW_STOCK");
    expect(stockState(5, 5)).toBe("LOW_STOCK");
    expect(stockState(6, 5)).toBe("IN_STOCK");
  });

  it("clamps requested quantities to available stock", () => {
    expect(clampToStock(2, 10)).toEqual({ quantity: 2, warning: null });
    expect(clampToStock(5, 3).quantity).toBe(3);
    expect(clampToStock(5, 3).warning).toMatch(/Only 3/);
    expect(clampToStock(1, 0).quantity).toBe(0);
  });
});

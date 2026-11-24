import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type MoneyInput = Decimal | string | number | { toString(): string } | null | undefined;

/** Convert any money-ish value (Prisma Decimal, string, number) into a decimal.js Decimal. */
export function dec(value: MoneyInput): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  if (value instanceof Decimal) return value;
  return new Decimal(typeof value === "number" ? value : value.toString());
}

/** Round to 2 decimal places (currency minor units). */
export function round2(value: MoneyInput): Decimal {
  return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Serialize money for JSON responses / client props. Always a fixed 2-dp string. */
export function moneyString(value: MoneyInput): string {
  return round2(value).toFixed(2);
}

export function toNumber(value: MoneyInput): number {
  return dec(value).toNumber();
}

const SYMBOLS: Record<string, string> = { BDT: "৳", USD: "$", EUR: "€", GBP: "£", INR: "₹" };

/** Format an amount for display, e.g. ৳1,25,000 (BDT uses South-Asian digit grouping). */
export function formatMoney(value: MoneyInput, currency = "BDT"): string {
  const d = round2(value);
  const n = d.toNumber();
  const locale = currency === "BDT" || currency === "INR" ? "en-IN" : "en-US";
  const fractionDigits = d.isInteger() ? 0 : 2;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return `${n < 0 ? "-" : ""}${symbol}${formatted}`;
}

/** Percentage off between a regular and a sale price, rounded to an integer. */
export function discountPercent(regular: MoneyInput, sale: MoneyInput): number {
  const r = dec(regular);
  const s = dec(sale);
  if (r.lte(0) || s.gte(r)) return 0;
  return r.minus(s).div(r).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

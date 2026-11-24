/** Order lifecycle rules (pure, shared by server, admin UI and tests). */

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "UNPAID",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CANCELLED",
] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["COD", "STRIPE", "BKASH", "NAGAD", "SSLCOMMERZ"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatusValue, string> = {
  UNPAID: "Unpaid",
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  CANCELLED: "Cancelled",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, string> = {
  COD: "Cash on Delivery",
  STRIPE: "Card (Stripe)",
  BKASH: "bKash",
  NAGAD: "Nagad",
  SSLCOMMERZ: "SSLCommerz",
};

/** The forward fulfilment path. Admins may move forward along it, skipping steps. */
export const FULFILMENT_FLOW: OrderStatusValue[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const CANCELLABLE: OrderStatusValue[] = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED"];
const RETURNABLE: OrderStatusValue[] = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

export function allowedTransitions(from: OrderStatusValue, paymentStatus: PaymentStatusValue): OrderStatusValue[] {
  const next: OrderStatusValue[] = [];
  const idx = FULFILMENT_FLOW.indexOf(from);
  if (idx >= 0) next.push(...FULFILMENT_FLOW.slice(idx + 1));
  if (CANCELLABLE.includes(from)) next.push("CANCELLED");
  if (RETURNABLE.includes(from)) next.push("RETURNED");
  const paid = paymentStatus === "PAID" || paymentStatus === "PARTIALLY_REFUNDED";
  if (paid && ["CANCELLED", "RETURNED", "DELIVERED"].includes(from)) next.push("REFUNDED");
  return next;
}

export function canTransition(
  from: OrderStatusValue,
  to: OrderStatusValue,
  paymentStatus: PaymentStatusValue,
): boolean {
  return allowedTransitions(from, paymentStatus).includes(to);
}

/** Statuses after which reserved stock should go back on the shelf. */
export function restocksInventory(to: OrderStatusValue) {
  return to === "CANCELLED" || to === "RETURNED";
}

/** Customers may cancel their own order only before it is being prepared. */
export function customerCanCancel(status: OrderStatusValue) {
  return status === "PENDING" || status === "CONFIRMED";
}

/** Steps shown on the customer tracking timeline. */
export const TRACKING_STEPS: OrderStatusValue[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

import { route } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { orderLookupSchema } from "@/lib/validations/checkout";
import { lookupOrder } from "@/services/orders";

/** POST /api/orders/lookup — guest order tracking by order number + email (rate limited against enumeration). */
export const POST = route({ auth: "none", rateLimit: RATE_LIMITS.orderLookup }, async ({ json }) => {
  const { orderNumber, email } = await json(orderLookupSchema);
  const order = await lookupOrder(orderNumber, email);
  if (!order) throw notFound("We couldn't find an order with those details. Check the order number and email.");
  return order;
});

import "server-only";
import Stripe from "stripe";
import { env, appUrl } from "@/lib/env";
import { dec } from "@/lib/money";
import type { PaymentOrder, PaymentProvider } from "@/lib/payments/types";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing).");
  client ??= new Stripe(key);
  return client;
}

/** Stripe expects integer minor units (e.g. paisa for BDT, cents for USD). */
export function toMinorUnits(amount: string | number) {
  return dec(amount).times(100).toDecimalPlaces(0).toNumber();
}

export function fromMinorUnits(amount: number) {
  return dec(amount).div(100).toFixed(2);
}

export const stripeProvider: PaymentProvider = {
  method: "STRIPE",
  label: "Credit / debit card",
  description: "Pay securely with Visa, Mastercard or Amex via Stripe.",
  isOnline: true,
  isConfigured: () => Boolean(env().STRIPE_SECRET_KEY),

  async initiate(order: PaymentOrder, paymentId: string) {
    const stripe = getStripe();
    const currency = env().STRIPE_CURRENCY.toLowerCase();
    // Charge the server-calculated order total as one line so discounts/shipping/tax always reconcile exactly.
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: order.customerEmail,
        client_reference_id: order.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: toMinorUnits(order.grandTotal),
              product_data: {
                name: `Order ${order.orderNumber}`,
                description: order.items
                  .map((i) => `${i.productName}${i.variantName ? ` (${i.variantName})` : ""} × ${i.quantity}`)
                  .join(", ")
                  .slice(0, 480),
              },
            },
          },
        ],
        metadata: { orderId: order.id, paymentId, orderNumber: order.orderNumber },
        payment_intent_data: { metadata: { orderId: order.id, paymentId } },
        success_url: appUrl(`/checkout/success?order=${encodeURIComponent(order.orderNumber)}&session_id={CHECKOUT_SESSION_ID}`),
        cancel_url: appUrl(`/checkout/cancelled?order=${encodeURIComponent(order.orderNumber)}`),
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour to pay
      },
      { idempotencyKey: `checkout-${paymentId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { redirectUrl: session.url, providerReference: session.id };
  },

  async refund({ providerPaymentId, amount }) {
    const refund = await getStripe().refunds.create({
      payment_intent: providerPaymentId,
      amount: toMinorUnits(amount),
    });
    return { refundId: refund.id };
  },
};

import type Stripe from "stripe";
import { NextResponse, type NextRequest } from "next/server";
import { env, integrations } from "@/lib/env";
import { getStripe } from "@/lib/payments/stripe";
import { recordStripePaymentFailure, syncStripeCheckoutSession } from "@/services/orders";

/**
 * Stripe webhook. The raw body is verified against STRIPE_WEBHOOK_SECRET before anything is trusted.
 * Handlers are idempotent (events are recorded by id), so Stripe retries are safe.
 */
export async function POST(req: NextRequest) {
  if (!integrations.stripeWebhook()) {
    return NextResponse.json({ error: "Stripe webhooks are not configured" }, { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, env().STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        await syncStripeCheckoutSession(event.data.object as Stripe.Checkout.Session, event.id);
        break;
      case "payment_intent.payment_failed":
        await recordStripePaymentFailure(event.data.object as Stripe.PaymentIntent, event.id);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("[stripe] webhook handling failed", event.type, error);
    // A 500 makes Stripe retry later.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

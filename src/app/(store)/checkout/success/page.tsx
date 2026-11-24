import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { integrations } from "@/lib/env";
import { getStripe } from "@/lib/payments/stripe";
import { PAYMENT_METHOD_LABELS } from "@/lib/order-status";
import { getCustomerOrder, syncStripeCheckoutSession } from "@/services/orders";
import { OrderDetailView, toOrderView } from "@/components/account/order-view";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; session_id?: string }>;
}) {
  const { order: orderNumber, session_id: sessionId } = await searchParams;
  if (!orderNumber || orderNumber.length > 40) notFound();

  let order = await prisma.order.findUnique({
    where: { orderNumber: orderNumber.toUpperCase() },
    select: { id: true, orderNumber: true, userId: true, paymentMethod: true, paymentStatus: true, customerEmail: true },
  });
  if (!order) notFound();

  // Confirm online payment state directly with Stripe (never trust the redirect alone).
  if (sessionId && order.paymentMethod === "STRIPE" && order.paymentStatus !== "PAID" && integrations.stripe() && sessionId.length < 300) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.metadata?.orderId === order.id) {
        await syncStripeCheckoutSession(session);
        order = await prisma.order.findUniqueOrThrow({
          where: { id: order.id },
          select: { id: true, orderNumber: true, userId: true, paymentMethod: true, paymentStatus: true, customerEmail: true },
        });
      }
    } catch (error) {
      console.error("[checkout/success] could not verify Stripe session", error);
    }
  }

  const user = await getCurrentUser();
  const owned = user && order.userId === user.id ? await getCustomerOrder(order.id, user.id) : null;
  const awaitingPayment = order.paymentMethod !== "COD" && order.paymentStatus !== "PAID";

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        {awaitingPayment ? <Clock className="mx-auto size-12 text-warning" /> : <CheckCircle2 className="mx-auto size-12 text-success" />}
        <h1 className="mt-4 font-heading text-4xl">{awaitingPayment ? "We're confirming your payment" : "Thank you for your order"}</h1>
        <p className="mt-3 text-muted-foreground">
          {awaitingPayment
            ? "Your order is saved. As soon as the payment is confirmed we'll email you — this usually takes a few seconds."
            : `Order ${order.orderNumber} has been received. A confirmation email is on its way to you.`}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Payment: {PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/products">Continue shopping</Link>
          </Button>
          {owned ? (
            <Button asChild>
              <Link href={`/account/orders/${order.id}`}>View in my account</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`}>Track this order</Link>
            </Button>
          )}
        </div>
      </div>
      {owned ? (
        <OrderDetailView order={toOrderView(owned)} />
      ) : (
        <div className="mx-auto max-w-md rounded-xl border bg-card p-6 text-center text-sm">
          <p className="eyebrow">Your order number</p>
          <p className="mt-2 font-heading text-2xl" data-testid="order-number">
            {order.orderNumber}
          </p>
          <p className="mt-3 text-muted-foreground">Keep this number handy — you&apos;ll need it with your email to track the order.</p>
        </div>
      )}
    </div>
  );
}

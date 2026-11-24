import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Payment not completed", robots: { index: false } };

export default async function CheckoutCancelledPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderNumber } = await searchParams;
  const user = await getCurrentUser();
  const order =
    orderNumber && orderNumber.length <= 40 && user
      ? await prisma.order.findFirst({ where: { orderNumber: orderNumber.toUpperCase(), userId: user.id }, select: { id: true } })
      : null;

  return (
    <div className="container-page py-16 lg:py-24">
      <div className="mx-auto max-w-xl text-center">
        <CircleAlert className="mx-auto size-12 text-warning" />
        <h1 className="mt-4 font-heading text-4xl">Payment not completed</h1>
        <p className="mt-3 text-muted-foreground">
          No payment was taken. {orderNumber ? `Your order ${orderNumber} is saved for a short while` : "Your order is saved for a short while"} — you can try
          paying again, or contact us and we&apos;ll help.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Unpaid online orders are cancelled automatically when the payment window expires.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {order ? (
            <Button asChild>
              <Link href={`/account/orders/${order.id}`}>Retry payment</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href={orderNumber ? `/track-order?order=${encodeURIComponent(orderNumber)}` : "/track-order"}>View order status</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

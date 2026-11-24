import type { Metadata } from "next";
import { TrackOrderForm } from "@/components/account/track-order-form";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the status of your order with your order number and email address.",
  alternates: { canonical: "/track-order" },
};

export default async function TrackOrderPage({ searchParams }: { searchParams: Promise<{ order?: string; email?: string }> }) {
  const { order, email } = await searchParams;
  return (
    <div className="container-page py-10 lg:py-14">
      <p className="eyebrow">Order tracking</p>
      <h1 className="mt-2 mb-2 font-heading text-4xl">Track your order</h1>
      <p className="mb-8 max-w-xl text-sm text-muted-foreground">
        Enter the order number from your confirmation email and the email address you used at checkout.
      </p>
      <TrackOrderForm initialOrder={(order ?? "").slice(0, 40)} initialEmail={(email ?? "").slice(0, 160)} />
    </div>
  );
}

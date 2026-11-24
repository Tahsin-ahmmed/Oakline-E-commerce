import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listPaymentOptions } from "@/lib/payments/registry";
import { getCartCount } from "@/services/cart";
import { getSettings } from "@/services/settings";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [count, user, settings] = await Promise.all([getCartCount(), getCurrentUser(), getSettings()]);
  if (count === 0) redirect("/cart");
  const paymentOptions = listPaymentOptions({ codEnabled: settings.commerce.codEnabled });
  return (
    <div className="container-page py-10 lg:py-14">
      <p className="eyebrow">Secure checkout</p>
      <h1 className="mt-2 mb-8 font-heading text-4xl">Checkout</h1>
      <CheckoutForm
        user={user ? { name: user.name, email: user.email, phone: user.phone ?? "" } : null}
        paymentOptions={paymentOptions}
      />
    </div>
  );
}

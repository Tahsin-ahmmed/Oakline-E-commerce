import type { Metadata } from "next";
import { CartPage } from "@/components/cart/cart-page";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default function CartRoute() {
  return (
    <div className="container-page py-10 lg:py-14">
      <p className="eyebrow">Shopping bag</p>
      <h1 className="mt-2 mb-8 font-heading text-4xl">Your bag</h1>
      <CartPage />
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { PolicyLayout } from "@/components/content/policy-layout";
import { getSettings } from "@/services/settings";

export const metadata: Metadata = {
  title: "Terms & conditions",
  description: "The terms that apply when you use our website and buy from us.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const { general, commerce } = await getSettings();
  const name = general.siteName;
  return (
    <PolicyLayout
      title="Terms & conditions"
      description={`Please read these terms carefully. By using this website or placing an order with ${name}, you agree to them.`}
      updated={new Date("2026-11-01")}
      contactEmail={general.contactEmail}
      sections={[
        {
          id: "about",
          title: "About us",
          body: (
            <p>
              This website is operated by {name}, a fashion and accessories retailer based in Bangladesh{general.address ? ` (${general.address})` : ""}. You can
              reach us at {general.contactEmail}
              {general.phone ? ` or ${general.phone}` : ""}.
            </p>
          ),
        },
        {
          id: "orders",
          title: "Orders and contract",
          body: (
            <>
              <p>
                When you place an order you&apos;ll receive an email acknowledging it. A contract is formed when we confirm and dispatch your order.
                We may decline or cancel an order — for example if an item is unavailable, a pricing error has occurred, or we suspect fraud — and
                will refund any payment in full.
              </p>
              <p>You must be at least 18 years old, or have a parent&apos;s permission, to place an order.</p>
            </>
          ),
        },
        {
          id: "pricing",
          title: "Prices and payment",
          body: (
            <>
              <p>
                Prices are shown in {general.currency} and include applicable VAT. Delivery fees are calculated and displayed at checkout. All prices
                and discounts are verified on our servers when you place your order; the confirmed total is the amount you pay.
              </p>
              <p>
                We accept Cash on Delivery and card payments processed securely by Stripe. Card payments are only treated as paid once confirmed by
                the payment provider.
              </p>
            </>
          ),
        },
        {
          id: "promotions",
          title: "Coupons and promotions",
          body: (
            <p>
              Coupon codes are subject to their stated conditions (minimum spend, expiry dates, eligible products and usage limits), cannot be
              exchanged for cash and only one code can be applied per order. We may withdraw a promotion at any time without affecting orders
              already placed.
            </p>
          ),
        },
        {
          id: "delivery",
          title: "Delivery",
          body: (
            <p>
              Delivery estimates are given in good faith but are not guaranteed. Risk in the goods passes to you on delivery. See our{" "}
              <Link href="/shipping-policy">shipping policy</Link> for details.
            </p>
          ),
        },
        {
          id: "returns",
          title: "Returns",
          body: (
            <p>
              You may return eligible items within {commerce.returnWindowDays} days of delivery as described in our{" "}
              <Link href="/returns-policy">return &amp; refund policy</Link>.
            </p>
          ),
        },
        {
          id: "products",
          title: "Product information",
          body: (
            <p>
              Many of our products are handmade, so slight variations in colour, glaze, grain or size are natural and not defects. We take care to
              display colours accurately, but screens vary.
            </p>
          ),
        },
        {
          id: "accounts",
          title: "Your account",
          body: (
            <p>
              You are responsible for keeping your password confidential and for activity under your account. We may suspend accounts that are used
              fraudulently or abusively.
            </p>
          ),
        },
        {
          id: "ip",
          title: "Intellectual property",
          body: <p>All content on this site — designs, photography, text and logos — belongs to {name} or its licensors and may not be reused without permission.</p>,
        },
        {
          id: "liability",
          title: "Liability",
          body: (
            <p>
              Nothing in these terms limits liability that cannot be limited by law. Otherwise, our total liability for any order is limited to the
              amount you paid for that order, and we are not liable for indirect or unforeseeable losses.
            </p>
          ),
        },
        {
          id: "law",
          title: "Governing law",
          body: <p>These terms are governed by the laws of the People&apos;s Republic of Bangladesh, and disputes are subject to the courts of Dhaka.</p>,
        },
      ]}
    />
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { PolicyLayout } from "@/components/content/policy-layout";
import { getSettings } from "@/services/settings";

export const metadata: Metadata = {
  title: "Return & refund policy",
  description: "How to return an item, refund timelines and what can be returned.",
  alternates: { canonical: "/returns-policy" },
};

export default async function ReturnsPolicyPage() {
  const { general, commerce, policies } = await getSettings();
  const days = commerce.returnWindowDays;
  return (
    <PolicyLayout
      title="Return & refund policy"
      description={policies.returnInfo}
      updated={new Date("2026-11-01")}
      contactEmail={general.contactEmail}
      sections={[
        {
          id: "window",
          title: `${days}-day returns`,
          body: (
            <>
              <p>
                Changed your mind? You can return most items within <strong>{days} days of delivery</strong>, as long as they are unused, in the
                condition you received them and in their original packaging with all tags attached.
              </p>
              <p>This doesn&apos;t affect your rights if an item is faulty, damaged or not as described.</p>
            </>
          ),
        },
        {
          id: "how",
          title: "How to start a return",
          body: (
            <ol>
              <li>
                Sign in and open the order from <Link href="/account/orders">My orders</Link>, then choose <em>Request a return</em> for the item.
                Guest shoppers can <Link href="/contact">contact us</Link> with their order number.
              </li>
              <li>Tell us the reason — it helps us improve. We&apos;ll confirm within one business day.</li>
              <li>Pack the item securely. Inside Dhaka we arrange a courier pickup; elsewhere we&apos;ll share the return address.</li>
              <li>Once the item arrives and passes inspection, we process your refund.</li>
            </ol>
          ),
        },
        {
          id: "refunds",
          title: "Refunds",
          body: (
            <>
              <p>Refunds are issued within 5–7 business days after we receive and inspect your return:</p>
              <ul>
                <li><strong>Card payments</strong> are refunded to the original card. Your bank may take a few extra days to show it.</li>
                <li><strong>Cash on Delivery</strong> orders are refunded by bKash, Nagad or bank transfer — we&apos;ll ask for your preferred account.</li>
              </ul>
              <p>
                Original delivery fees are refunded only when the return is due to our error (faulty, damaged or incorrect items). For change-of-mind
                returns, a return pickup fee equal to the standard delivery fee may be deducted.
              </p>
            </>
          ),
        },
        {
          id: "damaged",
          title: "Damaged, faulty or wrong items",
          body: (
            <p>
              We check every piece before it leaves our warehouse, but accidents happen. Contact us within 48 hours of delivery with photos of the item
              and packaging, and we&apos;ll arrange a free replacement or full refund — including delivery fees — at no cost to you.
            </p>
          ),
        },
        {
          id: "exclusions",
          title: "Items we can't accept",
          body: (
            <ul>
              <li>Underwear, camisoles and undershirts once the hygiene seal or packaging has been opened, unless faulty.</li>
              <li>Sunglasses with scratched lenses, and footwear that shows signs of outdoor wear.</li>
              <li>Items marked as final sale, gift cards and personalised pieces.</li>
              <li>Items damaged through misuse, or returned without their original packaging.</li>
            </ul>
          ),
        },
        {
          id: "exchanges",
          title: "Exchanges",
          body: (
            <p>
              Want a different colour or size? The quickest way is to return the original item for a refund and place a new order, so you don&apos;t
              miss out on stock. If you&apos;d prefer a direct exchange, mention it in your return request and we&apos;ll do our best.
            </p>
          ),
        },
      ]}
    />
  );
}

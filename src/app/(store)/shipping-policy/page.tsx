import Link from "next/link";
import type { Metadata } from "next";
import { PolicyLayout } from "@/components/content/policy-layout";
import { getSettings } from "@/services/settings";
import { getPublicShippingTable } from "@/services/blog";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Shipping policy",
  description: "Delivery areas, fees and timelines for orders across Bangladesh.",
  alternates: { canonical: "/shipping-policy" },
};

function days(min: number, max: number) {
  if (max <= 1 && min === 0) return "Same day / next day";
  return min === max ? `${min} business day${min === 1 ? "" : "s"}` : `${min}–${max} business days`;
}

export default async function ShippingPolicyPage() {
  const [{ general, commerce, policies }, zones] = await Promise.all([getSettings(), getPublicShippingTable()]);
  const cur = general.currency;
  const free = commerce.freeShippingThreshold > 0 ? formatMoney(commerce.freeShippingThreshold, cur) : null;
  const updated = zones.reduce((d, z) => (z.updatedAt > d ? z.updatedAt : d), new Date("2026-01-01"));

  return (
    <PolicyLayout
      title="Shipping policy"
      description={policies.shippingInfo}
      updated={updated}
      contactEmail={general.contactEmail}
      sections={[
        {
          id: "areas",
          title: "Where we deliver",
          body: (
            <>
              <p>
                We deliver to every district in Bangladesh through trusted courier partners. Your delivery fee and estimated delivery time are
                calculated from your division, district and area and shown at checkout before you pay — there are no surprise charges at the door.
              </p>
              {free && (
                <p>
                  <strong>Free delivery:</strong> orders with a merchandise total of {free} or more (after discounts) ship free with standard delivery.
                </p>
              )}
            </>
          ),
        },
        {
          id: "rates",
          title: "Delivery rates & timelines",
          body: zones.length ? (
            <div className="not-prose overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-secondary/60 text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Area</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Estimated time</th>
                    <th className="px-4 py-3 text-right font-medium">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {zones.flatMap((z) =>
                    z.methods.map((m, i) => (
                      <tr key={m.id} className="bg-card">
                        {i === 0 && (
                          <td rowSpan={z.methods.length} className="px-4 py-3 align-top">
                            <p className="font-medium">{z.name}</p>
                            {(z.districts.length > 0 || z.divisions.length > 0) && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{[...z.districts, ...z.divisions].join(", ")}</p>
                            )}
                            {z.isDefault && <p className="mt-0.5 text-xs text-muted-foreground">All other areas</p>}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          {m.name}
                          {!m.codAvailable && <span className="block text-xs text-muted-foreground">Prepaid orders only</span>}
                          {m.freeShippingThreshold && Number(m.freeShippingThreshold) > 0 && (
                            <span className="block text-xs text-muted-foreground">Free over {formatMoney(m.freeShippingThreshold, cur)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{days(m.minDays, m.maxDays)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatMoney(m.fee, cur)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Delivery options are being updated. Fees are always shown at checkout.</p>
          ),
        },
        {
          id: "processing",
          title: "Order processing",
          body: (
            <>
              <p>
                Orders placed before 2pm (Saturday–Thursday) are usually packed the same day. Orders placed after 2pm, on Fridays or on public
                holidays are processed the next working day. Express same-day delivery inside Dhaka must be placed before 12pm.
              </p>
              <p>During sales and major holidays (Eid, Pohela Boishakh) please allow an extra 1–2 days.</p>
            </>
          ),
        },
        {
          id: "tracking",
          title: "Tracking your order",
          body: (
            <p>
              We email you at every step. Once your parcel is handed to the courier you&apos;ll receive the courier name and tracking number. You can
              check progress anytime on the <Link href="/track-order">Track Order</Link> page or in your account.
            </p>
          ),
        },
        {
          id: "cod",
          title: "Cash on Delivery",
          body: (
            <p>
              Cash on Delivery is available on most delivery methods nationwide. Please have the order total ready when the courier arrives; you may
              inspect the outer packaging before paying. Repeatedly refused COD parcels may lead us to require prepayment on future orders.
            </p>
          ),
        },
        {
          id: "issues",
          title: "Delays, damage & failed delivery",
          body: (
            <>
              <p>
                If your parcel arrives damaged, please refuse it or contact us within 48 hours with photos — we&apos;ll send a replacement or a full
                refund. If the courier cannot reach you after two attempts, the parcel returns to us and we&apos;ll get in touch to rearrange delivery.
              </p>
              <p>Couriers occasionally face delays due to weather or road conditions; we&apos;ll keep you updated if that happens.</p>
            </>
          ),
        },
      ]}
    />
  );
}

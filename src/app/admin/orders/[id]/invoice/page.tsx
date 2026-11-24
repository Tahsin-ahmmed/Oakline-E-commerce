import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Download } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { dec, formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-status";
import { getAdminOrder } from "@/services/admin/orders";
import { getSettings } from "@/services/settings";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/admin/orders/print-button";

export const metadata = { title: "Invoice" };

/** Print-optimized invoice. The admin chrome (sidebar/top bar) is hidden when printing. */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff("orders.view", `/admin/orders/${id}/invoice`);
  const [order, { general }] = await Promise.all([getAdminOrder(id), getSettings()]);
  if (!order) notFound();
  const money = (v: { toString(): string }) => formatMoney(v, order.currency);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body { background: #fff !important; }
          body aside, body header, .no-print { display: none !important; }
          main { padding: 0 !important; }
          .invoice-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: none !important; }
        }
      `}</style>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link href={`/admin/orders/${order.id}`}>
            <ArrowLeft /> Back to order
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/api/admin/orders/${order.id}/invoice.pdf`} download>
              <Download /> Download PDF
            </a>
          </Button>
          <PrintButton />
        </div>
      </div>

      <article className="invoice-sheet mx-auto max-w-3xl rounded-xl border bg-white p-10 text-[0.9rem] text-neutral-800 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap justify-between gap-6">
          <div>
            <p className="font-heading text-3xl text-neutral-900">{general.siteName}</p>
            <p className="mt-2 max-w-xs text-xs leading-5 text-neutral-500">
              {general.address}
              <br />
              {general.phone} · {general.contactEmail}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tracking-wide text-neutral-900">INVOICE</p>
            <p className="mt-2 text-sm">No. {order.orderNumber}</p>
            <p className="text-xs text-neutral-500">Date: {format(order.placedAt, "d MMMM yyyy")}</p>
            <p className="text-xs text-neutral-500">Status: {ORDER_STATUS_LABELS[order.status]}</p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8">
          <div>
            <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-neutral-500 uppercase">Bill to</p>
            <p className="mt-2">{order.customerName}</p>
            <p className="text-neutral-600">{order.customerEmail}</p>
            <p className="text-neutral-600">{order.customerPhone}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-neutral-500 uppercase">Ship to</p>
            <p className="mt-2">{order.shipFullName}</p>
            <p className="text-neutral-600">
              {order.shipLine1}
              {order.shipLine2 ? `, ${order.shipLine2}` : ""}
            </p>
            <p className="text-neutral-600">{[order.shipArea, order.shipDistrict, order.shipDivision].filter(Boolean).join(", ")}</p>
            <p className="text-neutral-600">{order.shipPhone}</p>
          </div>
        </div>

        <table className="mt-10 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-800 text-left text-[0.7rem] tracking-wider text-neutral-500 uppercase">
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit price</th>
              <th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-200 align-top">
                <td className="py-3">
                  {item.productName}
                  {item.variantName && <span className="text-neutral-500"> — {item.variantName}</span>}
                  <p className="text-xs text-neutral-500">SKU {item.sku}</p>
                </td>
                <td className="py-3 text-right tabular-nums">{item.quantity}</td>
                <td className="py-3 text-right tabular-nums">{money(item.unitPrice)}</td>
                <td className="py-3 text-right tabular-nums">{money(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 ml-auto w-72 space-y-1.5">
          <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span className="tabular-nums">{money(order.subtotal)}</span></div>
          {dec(order.discountTotal).gt(0) && (
            <div className="flex justify-between"><span className="text-neutral-500">Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span><span className="tabular-nums">-{money(order.discountTotal)}</span></div>
          )}
          <div className="flex justify-between"><span className="text-neutral-500">Shipping</span><span className="tabular-nums">{dec(order.shippingTotal).isZero() ? "Free" : money(order.shippingTotal)}</span></div>
          {dec(order.taxTotal).gt(0) && <div className="flex justify-between"><span className="text-neutral-500">Tax</span><span className="tabular-nums">{money(order.taxTotal)}</span></div>}
          <div className="flex justify-between border-t-2 border-neutral-800 pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums">{money(order.grandTotal)}</span></div>
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-neutral-600">
          <p>Payment method: {PAYMENT_METHOD_LABELS[order.paymentMethod]} · {PAYMENT_STATUS_LABELS[order.paymentStatus]}</p>
          <p className="mt-4 text-xs text-neutral-500">Thank you for shopping with {general.siteName}.</p>
        </div>
      </article>
    </>
  );
}

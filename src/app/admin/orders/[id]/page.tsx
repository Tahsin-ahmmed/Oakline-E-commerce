import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Download, ExternalLink, Printer } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { dec, formatMoney, moneyString } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-status";
import { getAdminOrder } from "@/services/admin/orders";
import { RETURN_STATUS_LABELS } from "@/services/admin/returns";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { OrderStatusBadge, PaymentStatusBadge, ToneBadge } from "@/components/shared/status-badge";
import { SmartImage } from "@/components/shared/smart-image";
import { OrderActions } from "@/components/admin/orders/order-actions";
import { OrderNotes } from "@/components/admin/orders/order-notes";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getAdminOrder(id);
  return { title: order ? `Order ${order.orderNumber}` : "Order" };
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 text-sm ${strong ? "border-t pt-2.5 font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff("orders.view", `/admin/orders/${id}`);
  const order = await getAdminOrder(id);
  if (!order) notFound();
  const money = (v: { toString(): string } | string | number) => formatMoney(v, order.currency);
  const captured = order.payments.find((p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED");
  const refundable = captured ? dec(captured.amount).minus(captured.refundedAmount) : dec(0);

  return (
    <>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            Placed {format(order.placedAt, "d MMM yyyy, h:mm a")}
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/admin/orders/${order.id}/invoice`}>
                <Printer /> Print invoice
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/api/admin/orders/${order.id}/invoice.pdf`} download>
                <Download /> PDF
              </a>
            </Button>
          </>
        }
      />

      <div className="mb-6">
        <OrderActions
          orderId={order.id}
          orderNumber={order.orderNumber}
          status={order.status}
          paymentStatus={order.paymentStatus}
          paymentMethod={order.paymentMethod}
          currency={order.currency}
          refundable={moneyString(refundable)}
          trackingNumber={order.trackingNumber}
          courier={order.courier}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title={`Items (${order.items.length})`} bodyClassName="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Product</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="pr-5 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                          {item.imageUrl && <SmartImage src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" />}
                        </div>
                        <div className="min-w-0">
                          {item.product ? (
                            <Link href={`/admin/products/${item.product.id}`} className="font-medium hover:underline">
                              {item.productName}
                            </Link>
                          ) : (
                            <span className="font-medium">{item.productName}</span>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {item.variantName ? `${item.variantName} · ` : ""}SKU {item.sku}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(item.unitPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="pr-5 text-right font-medium tabular-nums">{money(item.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="ml-auto max-w-xs px-5 py-4">
              <Row label="Subtotal" value={money(order.subtotal)} />
              {dec(order.discountTotal).gt(0) && (
                <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`-${money(order.discountTotal)}`} />
              )}
              <Row label={`Shipping · ${order.shippingMethodName}`} value={dec(order.shippingTotal).isZero() ? "Free" : money(order.shippingTotal)} />
              {dec(order.taxTotal).gt(0) && <Row label="Tax" value={money(order.taxTotal)} />}
              <Row label="Total" value={money(order.grandTotal)} strong />
            </div>
          </Panel>

          <Panel title="Payments" bodyClassName="space-y-4">
            {order.payments.length === 0 && <p className="text-sm text-muted-foreground">No payment records.</p>}
            {order.payments.map((p) => (
              <div key={p.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{PAYMENT_METHOD_LABELS[p.method]}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.provider}
                      {p.providerReference ? ` · ref ${p.providerReference}` : ""}
                      {p.providerPaymentId ? ` · ${p.providerPaymentId}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <PaymentStatusBadge status={p.status} />
                    <p className="mt-1 text-sm font-medium tabular-nums">{money(p.amount)}</p>
                    {dec(p.refundedAmount).gt(0) && <p className="text-xs text-muted-foreground">Refunded {money(p.refundedAmount)}</p>}
                  </div>
                </div>
                {p.failureReason && <p className="mt-2 text-xs text-destructive">{p.failureReason}</p>}
                {p.transactions.length > 0 && (
                  <ul className="mt-3 divide-y border-t text-xs">
                    {p.transactions.map((t) => (
                      <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2">
                        <span>
                          <span className="font-medium">{t.type.replace(/_/g, " ").toLowerCase()}</span> · {t.status}
                          {t.message ? ` — ${t.message}` : ""}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {money(t.amount)} · {format(t.createdAt, "d MMM yyyy, h:mm a")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </Panel>

          <Panel title="Status history">
            <ol className="relative space-y-5 border-l pl-6">
              {order.statusHistory.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute top-1 -left-[1.82rem] size-3 rounded-full border-2 border-card bg-clay" />
                  <p className="text-sm font-medium">
                    {h.fromStatus ? `${ORDER_STATUS_LABELS[h.fromStatus]} → ` : ""}
                    {ORDER_STATUS_LABELS[h.toStatus]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(h.createdAt, "d MMM yyyy, h:mm a")} · {h.changedBy ? `${h.changedBy.name}${h.changedBy.isStaff ? " (staff)" : ""}` : "System"}
                  </p>
                  {h.note && <p className="mt-1 text-sm text-foreground/80">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Panel>

          {order.returnRequests.length > 0 && (
            <Panel title="Return requests" actions={<Link href="/admin/returns" className="text-xs underline">Manage returns</Link>}>
              <ul className="divide-y">
                {order.returnRequests.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm first:pt-0 last:pb-0">
                    <div>
                      <p className="font-medium">
                        {r.orderItem ? `${r.orderItem.productName}${r.orderItem.variantName ? ` (${r.orderItem.variantName})` : ""} × ${r.quantity}` : "Whole order"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.reason} · {format(r.createdAt, "d MMM yyyy")}
                      </p>
                      {r.details && <p className="mt-1 text-xs">{r.details}</p>}
                    </div>
                    <ToneBadge tone={r.status === "REJECTED" ? "danger" : r.status === "REFUNDED" ? "success" : "progress"}>
                      {RETURN_STATUS_LABELS[r.status]}
                    </ToneBadge>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <p className="font-medium">{order.customerName}</p>
            <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
            <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
            {order.user ? (
              <Link href={`/admin/customers/${order.user.id}`} className="mt-3 inline-flex items-center gap-1 text-sm underline underline-offset-4">
                Customer profile · {order.user._count.orders} order{order.user._count.orders === 1 ? "" : "s"} <ExternalLink className="size-3" />
              </Link>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Guest checkout</p>
            )}
          </Panel>

          <Panel title="Shipping">
            <address className="text-sm leading-6 not-italic">
              {order.shipFullName}
              <br />
              {order.shipLine1}
              {order.shipLine2 && (
                <>
                  <br />
                  {order.shipLine2}
                </>
              )}
              <br />
              {[order.shipArea, order.shipDistrict].filter(Boolean).join(", ")}
              <br />
              {order.shipDivision}
              {order.shipPostalCode ? ` ${order.shipPostalCode}` : ""}, {order.shipCountry}
              <br />
              {order.shipPhone}
            </address>
            <div className="mt-4 space-y-1 border-t pt-4 text-sm">
              <Row label="Method" value={order.shippingMethodName} />
              {order.estimatedDelivery && <Row label="Estimate" value={order.estimatedDelivery} />}
              <Row label="Courier" value={order.courier ?? "—"} />
              <Row label="Tracking" value={order.trackingNumber ?? "—"} />
              {order.shippedAt && <Row label="Shipped" value={format(order.shippedAt, "d MMM yyyy")} />}
              {order.deliveredAt && <Row label="Delivered" value={format(order.deliveredAt, "d MMM yyyy")} />}
            </div>
          </Panel>

          <Panel title="Payment summary">
            <Row label="Method" value={PAYMENT_METHOD_LABELS[order.paymentMethod]} />
            <Row label="Status" value={PAYMENT_STATUS_LABELS[order.paymentStatus]} />
            {captured && <Row label="Refundable" value={money(refundable)} />}
          </Panel>

          {order.customerNote && (
            <Panel title="Customer note">
              <p className="text-sm whitespace-pre-wrap">{order.customerNote}</p>
            </Panel>
          )}

          <Panel title="Internal notes">
            <OrderNotes
              orderId={order.id}
              notes={order.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), author: n.author?.name ?? null }))}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

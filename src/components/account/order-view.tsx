
import { format } from "date-fns";
import { Check, CircleX, MapPin, Package, RotateCcw, Truck } from "lucide-react";
import { Money } from "@/components/shared/price";
import { SmartImage } from "@/components/shared/smart-image";
import { OrderStatusBadge, PaymentStatusBadge, ToneBadge } from "@/components/shared/status-badge";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  TRACKING_STEPS,
  type OrderStatusValue,
  type PaymentMethodValue,
  type PaymentStatusValue,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";

/** Serializable order shape for customer-facing views (server- or API-sourced). */
export interface OrderView {
  id: string;
  orderNumber: string;
  status: OrderStatusValue;
  paymentStatus: PaymentStatusValue;
  paymentMethod: PaymentMethodValue;
  currency: string;
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  couponCode: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shipFullName: string;
  shipPhone: string;
  shipLine1: string;
  shipLine2: string | null;
  shipArea: string | null;
  shipDistrict: string;
  shipDivision: string;
  shipPostalCode: string | null;
  shippingMethodName: string;
  estimatedDelivery: string | null;
  trackingNumber: string | null;
  courier: string | null;
  customerNote: string | null;
  placedAt: string;
  items: {
    id: string;
    productId: string | null;
    productName: string;
    variantName: string | null;
    sku: string;
    imageUrl: string | null;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
  }[];
  statusHistory: { id: string; toStatus: OrderStatusValue; note: string | null; createdAt: string }[];
  returnRequests: { id: string; orderItemId: string | null; reason: string; status: string; quantity: number; createdAt: string }[];
}

const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
const d = (v: unknown) => new Date(v as string | Date).toISOString();

/** Normalize a service/API order (Decimal/Date values) into an OrderView. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toOrderView(o: any): OrderView {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    currency: o.currency,
    subtotal: String(o.subtotal),
    discountTotal: String(o.discountTotal),
    shippingTotal: String(o.shippingTotal),
    taxTotal: String(o.taxTotal),
    grandTotal: String(o.grandTotal),
    couponCode: o.couponCode ?? null,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    shipFullName: o.shipFullName,
    shipPhone: o.shipPhone,
    shipLine1: o.shipLine1,
    shipLine2: o.shipLine2 ?? null,
    shipArea: o.shipArea ?? null,
    shipDistrict: o.shipDistrict,
    shipDivision: o.shipDivision,
    shipPostalCode: o.shipPostalCode ?? null,
    shippingMethodName: o.shippingMethodName,
    estimatedDelivery: o.estimatedDelivery ?? null,
    trackingNumber: o.trackingNumber ?? null,
    courier: o.courier ?? null,
    customerNote: o.customerNote ?? null,
    placedAt: d(o.placedAt),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (o.items ?? []).map((i: any) => ({
      id: i.id,
      productId: i.productId ?? null,
      productName: i.productName,
      variantName: i.variantName ?? null,
      sku: i.sku,
      imageUrl: i.imageUrl ?? null,
      unitPrice: String(i.unitPrice),
      quantity: i.quantity,
      lineTotal: String(i.lineTotal),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    statusHistory: (o.statusHistory ?? []).map((h: any) => ({ id: h.id, toStatus: h.toStatus, note: h.note ?? null, createdAt: d(h.createdAt) })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    returnRequests: (o.returnRequests ?? []).map((r: any) => ({
      id: r.id,
      orderItemId: s(r.orderItemId),
      reason: r.reason,
      status: r.status,
      quantity: r.quantity,
      createdAt: d(r.createdAt),
    })),
  };
}

const fmt = (iso: string) => format(new Date(iso), "d MMM yyyy, h:mm a");

export function TrackingTimeline({ order }: { order: OrderView }) {
  const terminal = ["CANCELLED", "RETURNED", "REFUNDED"].includes(order.status);
  const reached = new Map<OrderStatusValue, string>();
  for (const h of order.statusHistory) if (!reached.has(h.toStatus)) reached.set(h.toStatus, h.createdAt);
  const currentIdx = TRACKING_STEPS.indexOf(order.status);
  const lastReachedIdx = Math.max(
    currentIdx,
    ...TRACKING_STEPS.map((st, i) => (reached.has(st) ? i : -1)),
  );

  if (terminal) {
    const Icon = order.status === "CANCELLED" ? CircleX : RotateCcw;
    const at = reached.get(order.status);
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border bg-secondary/50 p-4">
          <Icon className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p className="font-medium">This order was {ORDER_STATUS_LABELS[order.status].toLowerCase()}</p>
            {at && <p className="text-sm text-muted-foreground">{fmt(at)}</p>}
          </div>
        </div>
        <HistoryList order={order} />
      </div>
    );
  }

  return (
    <ol className="relative space-y-0">
      {TRACKING_STEPS.map((step, i) => {
        const done = i <= lastReachedIdx;
        const current = i === currentIdx;
        const at = reached.get(step);
        const note = order.statusHistory.find((h) => h.toStatus === step)?.note;
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
            {i < TRACKING_STEPS.length - 1 && (
              <span className={cn("absolute top-7 left-[13px] h-[calc(100%-1.75rem)] w-px", i < lastReachedIdx ? "bg-foreground" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs",
                done ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground",
                current && "ring-4 ring-sand",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <div className="pt-0.5">
              <p className={cn("text-sm", done ? "font-medium" : "text-muted-foreground")}>{ORDER_STATUS_LABELS[step]}</p>
              {at && <p className="text-xs text-muted-foreground">{fmt(at)}</p>}
              {note && note !== "Order placed" && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function HistoryList({ order }: { order: OrderView }) {
  return (
    <ul className="space-y-2 text-sm">
      {[...order.statusHistory].reverse().map((h) => (
        <li key={h.id} className="flex justify-between gap-4 border-b pb-2 last:border-none">
          <span>
            {ORDER_STATUS_LABELS[h.toStatus]}
            {h.note && <span className="block text-xs text-muted-foreground">{h.note}</span>}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{fmt(h.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

export function OrderDetailView({ order, actions }: { order: OrderView; actions?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Order</p>
          <p className="mt-1 font-heading text-2xl">{order.orderNumber}</p>
          <p className="mt-1 text-sm text-muted-foreground">Placed {fmt(order.placedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>
      {actions}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-6">
            <h2 className="mb-5 flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
              <Truck className="size-4" /> Tracking
            </h2>
            {(order.trackingNumber || order.courier) && (
              <div className="mb-5 rounded-lg bg-secondary/60 p-4 text-sm">
                {order.courier && <p>Courier: <span className="font-medium">{order.courier}</span></p>}
                {order.trackingNumber && <p>Tracking number: <span className="font-mono font-medium">{order.trackingNumber}</span></p>}
              </div>
            )}
            <TrackingTimeline order={order} />
          </section>

          <section className="rounded-xl border bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
              <Package className="size-4" /> Items
            </h2>
            <ul className="divide-y">
              {order.items.map((item) => {
                const ret = order.returnRequests.find((r) => r.orderItemId === item.id);
                return (
                  <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.imageUrl && <SmartImage src={item.imageUrl} alt={item.productName} fill sizes="64px" className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium">{item.productName}</p>
                      {item.variantName && <p className="text-muted-foreground">{item.variantName}</p>}
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × <Money value={item.unitPrice} />
                      </p>
                      {ret && (
                        <ToneBadge tone="neutral" className="mt-1">
                          Return {ret.status.toLowerCase()}
                        </ToneBadge>
                      )}
                    </div>
                    <Money value={item.lineTotal} className="text-sm font-medium" />
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-6 text-sm">
            <h2 className="mb-4 font-sans text-base font-semibold tracking-normal">Summary</h2>
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd><Money value={order.subtotal} /></dd></div>
              {Number(order.discountTotal) > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Discount{order.couponCode && ` (${order.couponCode})`}</dt>
                  <dd>-<Money value={order.discountTotal} /></dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{Number(order.shippingTotal) === 0 ? "Free" : <Money value={order.shippingTotal} />}</dd>
              </div>
              {Number(order.taxTotal) > 0 && (
                <div className="flex justify-between"><dt className="text-muted-foreground">VAT</dt><dd><Money value={order.taxTotal} /></dd></div>
              )}
              <div className="flex justify-between border-t pt-3 text-base font-semibold"><dt>Total</dt><dd><Money value={order.grandTotal} /></dd></div>
            </dl>
            <p className="mt-4 text-muted-foreground">Payment: {PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
          </section>
          <section className="rounded-xl border bg-card p-6 text-sm">
            <h2 className="mb-3 flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
              <MapPin className="size-4" /> Delivery
            </h2>
            <p className="font-medium">{order.shipFullName}</p>
            <p className="text-muted-foreground">{order.shipLine1}</p>
            {order.shipLine2 && <p className="text-muted-foreground">{order.shipLine2}</p>}
            <p className="text-muted-foreground">{[order.shipArea, order.shipDistrict].filter(Boolean).join(", ")}</p>
            <p className="text-muted-foreground">{[order.shipDivision, order.shipPostalCode].filter(Boolean).join(" ")}</p>
            <p className="mt-1 text-muted-foreground">{order.shipPhone}</p>
            <p className="mt-3">
              {order.shippingMethodName}
              {order.estimatedDelivery && <span className="block text-xs text-muted-foreground">Estimated {order.estimatedDelivery}</span>}
            </p>
            {order.customerNote && <p className="mt-3 rounded-md bg-secondary/60 p-3 text-xs">Note: {order.customerNote}</p>}
          </section>
          {order.returnRequests.length > 0 && (
            <section className="rounded-xl border bg-card p-6 text-sm">
              <h2 className="mb-3 font-sans text-base font-semibold tracking-normal">Return requests</h2>
              <ul className="space-y-2">
                {order.returnRequests.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3">
                    <span>
                      {r.reason}
                      <span className="block text-xs text-muted-foreground">{fmt(r.createdAt)}</span>
                    </span>
                    <ToneBadge tone="neutral">{r.status.toLowerCase()}</ToneBadge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

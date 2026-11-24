import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Money } from "@/components/shared/price";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import type { OrderStatusValue, PaymentStatusValue } from "@/lib/order-status";

export interface OrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatusValue;
  paymentStatus: PaymentStatusValue;
  grandTotal: string;
  placedAt: string;
  itemCount: number;
}

export function OrdersList({ orders }: { orders: OrderRow[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 transition hover:bg-secondary/40">
            <div className="min-w-40">
              <p className="font-medium">{o.orderNumber}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(o.placedAt), "d MMM yyyy")} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <OrderStatusBadge status={o.status} />
              <PaymentStatusBadge status={o.paymentStatus} />
            </div>
            <Money value={o.grandTotal} className="ml-auto font-medium" />
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

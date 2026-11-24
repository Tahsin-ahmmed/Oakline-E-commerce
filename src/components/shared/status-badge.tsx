import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatusValue,
  type PaymentStatusValue,
} from "@/lib/order-status";

type Tone = "neutral" | "info" | "progress" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-sky-50 text-sky-800 border-sky-200",
  progress: "bg-amber-50 text-amber-800 border-amber-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-orange-50 text-orange-800 border-orange-200",
  danger: "bg-red-50 text-red-800 border-red-200",
};

export function ToneBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("rounded-full px-2.5 font-medium", TONES[tone], className)}>
      {children}
    </Badge>
  );
}

const ORDER_TONE: Record<OrderStatusValue, Tone> = {
  PENDING: "warning",
  CONFIRMED: "info",
  PROCESSING: "progress",
  PACKED: "progress",
  SHIPPED: "info",
  OUT_FOR_DELIVERY: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  RETURNED: "neutral",
  REFUNDED: "neutral",
};

const PAYMENT_TONE: Record<PaymentStatusValue, Tone> = {
  UNPAID: "warning",
  PENDING: "progress",
  PAID: "success",
  FAILED: "danger",
  REFUNDED: "neutral",
  PARTIALLY_REFUNDED: "neutral",
  CANCELLED: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatusValue }) {
  return <ToneBadge tone={ORDER_TONE[status]}>{ORDER_STATUS_LABELS[status]}</ToneBadge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatusValue }) {
  return <ToneBadge tone={PAYMENT_TONE[status]}>{PAYMENT_STATUS_LABELS[status]}</ToneBadge>;
}

export function StockBadge({ quantity, threshold = 5 }: { quantity: number; threshold?: number }) {
  if (quantity <= 0) return <ToneBadge tone="danger">Out of stock</ToneBadge>;
  if (quantity <= threshold) return <ToneBadge tone="warning">Low · {quantity}</ToneBadge>;
  return <ToneBadge tone="success">In stock · {quantity}</ToneBadge>;
}

export function ActiveBadge({ active, on = "Active", off = "Inactive" }: { active: boolean; on?: string; off?: string }) {
  return <ToneBadge tone={active ? "success" : "neutral"}>{active ? on : off}</ToneBadge>;
}

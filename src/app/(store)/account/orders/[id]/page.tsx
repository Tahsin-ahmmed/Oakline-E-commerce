import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { customerCanCancel } from "@/lib/order-status";
import { getCustomerOrder } from "@/services/orders";
import { getSettings } from "@/services/settings";
import { OrderDetailView, toOrderView } from "@/components/account/order-view";
import { OrderActions } from "@/components/account/order-actions";

export const metadata = { title: "Order details" };

function withinReturnWindow(deliveredAt: Date, days: number) {
  return Date.now() <= deliveredAt.getTime() + days * 86_400_000;
}

export default async function AccountOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/account/orders/${id}`);
  const order = await getCustomerOrder(id, user.id);
  if (!order) notFound();
  const view = toOrderView(order);
  const { commerce } = await getSettings();

  const paid = order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED";
  const canCancel = customerCanCancel(order.status) && !paid;
  const canRetryPayment = order.paymentMethod !== "COD" && order.status === "PENDING" && !paid;
  const withinWindow = withinReturnWindow(order.deliveredAt ?? order.updatedAt, commerce.returnWindowDays);
  const openReturnItems = new Set(
    order.returnRequests.filter((r) => ["REQUESTED", "APPROVED", "RECEIVED"].includes(r.status)).map((r) => r.orderItemId),
  );
  const returnableItems =
    order.status === "DELIVERED" && withinWindow
      ? order.items
          .filter((i) => !openReturnItems.has(i.id))
          .map((i) => ({ id: i.id, name: i.variantName ? `${i.productName} (${i.variantName})` : i.productName, quantity: i.quantity }))
      : [];

  return (
    <div className="space-y-4">
      <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All orders
      </Link>
      <OrderDetailView
        order={view}
        actions={
          <OrderActions orderId={order.id} canCancel={canCancel} canRetryPayment={canRetryPayment} returnableItems={returnableItems} />
        }
      />
    </div>
  );
}

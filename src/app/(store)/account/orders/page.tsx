import Link from "next/link";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { OrdersList } from "@/components/account/orders-table";

export const metadata = { title: "Orders" };

const PAGE_SIZE = 10;

export default async function AccountOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/account/orders");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);
  const where = { userId: user.id };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, orderNumber: true, status: true, paymentStatus: true, grandTotal: true, placedAt: true, _count: { select: { items: true } } },
    }),
    prisma.order.count({ where }),
  ]);
  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl">Order history</h2>
      {orders.length ? (
        <>
          <OrdersList
            orders={orders.map((o) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              status: o.status,
              paymentStatus: o.paymentStatus,
              grandTotal: o.grandTotal.toString(),
              placedAt: o.placedAt.toISOString(),
              itemCount: o._count.items,
            }))}
          />
          <PaginationLinks page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/account/orders" searchParams={sp} />
        </>
      ) : (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Your orders will appear here once you've placed one."
          action={
            <Button asChild>
              <Link href="/products">Browse the shop</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

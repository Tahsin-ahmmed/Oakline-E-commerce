import Link from "next/link";
import { Heart, MapPin, Package, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/shared/empty-state";
import { OrdersList } from "@/components/account/orders-table";
import { VerificationBanner } from "@/components/account/verification-banner";

export const metadata = { title: "Overview" };

export default async function AccountOverviewPage() {
  const user = await requireUser("/account");
  const [orders, orderCount, wishlistCount, addressCount] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { placedAt: "desc" },
      take: 3,
      select: { id: true, orderNumber: true, status: true, paymentStatus: true, grandTotal: true, placedAt: true, _count: { select: { items: true } } },
    }),
    prisma.order.count({ where: { userId: user.id } }),
    prisma.wishlistItem.count({ where: { wishlist: { userId: user.id } } }),
    prisma.address.count({ where: { userId: user.id } }),
  ]);

  const tiles = [
    { href: "/account/orders", label: "Orders", value: orderCount, icon: Package },
    { href: "/wishlist", label: "Wishlist", value: wishlistCount, icon: Heart },
    { href: "/account/addresses", label: "Addresses", value: addressCount, icon: MapPin },
    { href: "/account/security", label: "Security", value: user.emailVerified ? "Verified" : "Unverified", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-8">
      {!user.emailVerified && <VerificationBanner email={user.email} />}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map(({ href, label, value, icon: Icon }) => (
          <Link key={href} href={href} className="rounded-xl border bg-card p-5 transition hover:shadow-[var(--shadow-soft)]">
            <Icon className="size-5 text-muted-foreground" />
            <p className="mt-4 text-2xl font-semibold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </Link>
        ))}
      </div>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-2xl">Recent orders</h2>
          {orderCount > 3 && (
            <Link href="/account/orders" className="text-sm underline underline-offset-4">
              View all
            </Link>
          )}
        </div>
        {orders.length ? (
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
        ) : (
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="When you place an order, you'll be able to track it here."
            action={
              <Button asChild>
                <Link href="/products">Start shopping</Link>
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireStaff } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/order-status";
import { getCustomer } from "@/services/admin/customers";
import { getSettings } from "@/services/settings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { OrderStatusBadge, PaymentStatusBadge, ToneBadge } from "@/components/shared/status-badge";
import { RatingStars } from "@/components/shared/rating-stars";
import { CustomerActions } from "@/components/admin/customers/customer-actions";

export const metadata = { title: "Customer" };

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff("customers.view", `/admin/customers/${id}`);
  const [customer, { general }] = await Promise.all([getCustomer(id), getSettings()]);
  if (!customer) notFound();
  const money = (v: { toString(): string } | string) => formatMoney(v, general.currency);

  return (
    <>
      <PageHeader
        title={customer.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {customer.email}
            <ToneBadge tone={customer.status === "ACTIVE" ? "success" : "danger"}>{customer.status === "ACTIVE" ? "Active" : "Blocked"}</ToneBadge>
            {!customer.emailVerifiedAt && <ToneBadge tone="warning">Email unverified</ToneBadge>}
          </span>
        }
        actions={
          <CustomerActions
            customer={{
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              marketingOptIn: customer.marketingOptIn,
              status: customer.status,
            }}
          />
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total spent" value={money(customer.totalSpent)} />
        <Stat label="Orders" value={customer._count.orders} />
        <Stat label="Average order" value={money(customer.averageOrder)} />
        <Stat label="Wishlist items" value={customer.wishlistCount} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Order history" bodyClassName="p-0">
            {customer.orders.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Payment</TableHead>
                    <TableHead className="pr-5 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="pl-5">
                        <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                          {o.orderNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground">{o._count.items} item(s) · {PAYMENT_METHOD_LABELS[o.paymentMethod]}</p>
                      </TableCell>
                      <TableCell className="text-sm">{format(o.placedAt, "d MMM yyyy")}</TableCell>
                      <TableCell>
                        <OrderStatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <PaymentStatusBadge status={o.paymentStatus} />
                      </TableCell>
                      <TableCell className="pr-5 text-right tabular-nums">{money(o.grandTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>

          <Panel title={`Reviews (${customer.reviews.length})`}>
            {customer.reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews written.</p>
            ) : (
              <ul className="divide-y">
                {customer.reviews.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
                    <div>
                      <Link href={`/admin/products/${r.product.id}`} className="font-medium hover:underline">
                        {r.product.name}
                      </Link>
                      {r.title && <span className="text-muted-foreground"> · {r.title}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <RatingStars rating={r.rating} />
                      <ToneBadge tone={r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "danger" : "warning"}>
                        {r.status.toLowerCase()}
                      </ToneBadge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Profile">
            <dl className="space-y-2 text-sm">
              {[
                ["Email", customer.email],
                ["Phone", customer.phone ?? "—"],
                ["Joined", format(customer.createdAt, "d MMM yyyy")],
                ["Last sign-in", customer.lastLoginAt ? format(customer.lastLoginAt, "d MMM yyyy, h:mm a") : "—"],
                ["Marketing emails", customer.marketingOptIn ? "Subscribed" : "Not subscribed"],
                ["Active sessions", String(customer._count.sessions)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title={`Addresses (${customer.addresses.length})`}>
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved addresses.</p>
            ) : (
              <ul className="space-y-4">
                {customer.addresses.map((a) => (
                  <li key={a.id} className="text-sm leading-6">
                    <p className="font-medium">
                      {a.label ?? "Address"} {a.isDefault && <ToneBadge tone="info" className="ml-1">Default</ToneBadge>}
                    </p>
                    <p className="text-muted-foreground">
                      {a.fullName} · {a.phone}
                      <br />
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}
                      <br />
                      {[a.area, a.district, a.division].filter(Boolean).join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

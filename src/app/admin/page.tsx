import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Minus, PackageX } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { dashboardQuerySchema } from "@/lib/validations/admin/system";
import type { SearchParams } from "@/lib/admin-params";
import type { OrderStatusValue, PaymentStatusValue } from "@/lib/order-status";
import { getSettings } from "@/services/settings";
import {
  getOrderBreakdown,
  getOverview,
  getRecentActivity,
  getRevenueSeries,
  getTopProducts,
  resolveRange,
} from "@/services/admin/dashboard";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { RangeFilter } from "@/components/admin/dashboard/range-filter";
import { CategoryChart, OrdersChart, RevenueChart, StatusChart } from "@/components/admin/dashboard/charts";
import { ADMIN_NAV } from "@/components/admin/nav-config";
import { OrderStatusBadge, PaymentStatusBadge, ToneBadge } from "@/components/shared/status-badge";
import { SmartImage } from "@/components/shared/smart-image";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function Delta({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs text-muted-foreground">New this period</span>;
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", change > 0 ? "text-success" : change < 0 ? "text-destructive" : "text-muted-foreground")}>
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(change)}%<span className="ml-1 font-normal text-muted-foreground">vs previous period</span>
    </span>
  );
}

function Kpi({ label, value, change, sub }: { label: string; value: string; change: number | null; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-heading text-[1.9rem] leading-none tabular-nums">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
      <div className="mt-3">
        <Delta change={change} />
      </div>
    </div>
  );
}

function Counter({ label, value, href, tone }: { label: string; value: number; href?: string; tone?: "warning" | "danger" }) {
  const body = (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 transition hover:bg-secondary/40">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", tone === "warning" && value > 0 && "text-warning", tone === "danger" && value > 0 && "text-destructive")}>
        {value.toLocaleString("en-IN")}
      </span>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Welcome({ name, permissions, roles }: { name: string; permissions: string[]; roles: string[] }) {
  const subject = { roles, permissions };
  const links = ADMIN_NAV.flatMap((g) => g.items).filter((i) => i.href !== "/admin" && (!i.permission || hasPermission(subject, i.permission)));
  return (
    <>
      <PageHeader title={`Welcome, ${name.split(" ")[0]}`} description="Here are the areas you can manage." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:bg-secondary/40">
            <l.icon className="size-5 text-muted-foreground" />
            <span className="font-medium">{l.label}</span>
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </Link>
        ))}
        {links.length === 0 && <p className="text-sm text-muted-foreground">Your role doesn&apos;t include any admin sections yet.</p>}
      </div>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireStaff(undefined, "/admin");
  if (!hasPermission(user, "dashboard.view")) {
    return <Welcome name={user.name} permissions={user.permissions} roles={user.roles} />;
  }
  const sp = await searchParams;
  const query = dashboardQuerySchema.parse({ range: sp.range, from: sp.from, to: sp.to });
  const range = resolveRange(query);
  const [{ general }, overview, series, breakdown, topProducts, recent] = await Promise.all([
    getSettings(),
    getOverview(range),
    getRevenueSeries(range),
    getOrderBreakdown(range),
    getTopProducts(range),
    getRecentActivity(),
  ]);
  const currency = general.currency;
  const money = (v: string | number) => formatMoney(v, currency);
  const { kpis, counters } = overview;
  const canOrders = hasPermission(user, "orders.view");
  const canCustomers = hasPermission(user, "customers.view");
  const canInventory = hasPermission(user, "inventory.view");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`${range.label} · ${dayFmt.format(range.from)} – ${dayFmt.format(new Date(range.to.getTime() - 1))} (Asia/Dhaka)`}
        actions={<RangeFilter active={range.key} from={query.from} to={query.to} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total revenue" value={money(kpis.revenue.value)} change={kpis.revenue.change} sub={`Paid: ${money(kpis.paidRevenue.value)}`} />
        <Kpi label="Orders" value={kpis.orders.value.toLocaleString("en-IN")} change={kpis.orders.change} sub="Excluding cancelled" />
        <Kpi label="Average order value" value={money(kpis.aov.value)} change={kpis.aov.change} />
        <Kpi label="New customers" value={kpis.newCustomers.value.toLocaleString("en-IN")} change={kpis.newCustomers.change} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6">
        <Counter label="Active products" value={counters.totalProducts} href={hasPermission(user, "products.view") ? "/admin/products" : undefined} />
        <Counter label="Customers" value={counters.totalCustomers} href={canCustomers ? "/admin/customers" : undefined} />
        <Counter label="Pending orders" value={counters.pendingOrders} href={canOrders ? "/admin/orders?status=PENDING" : undefined} tone="warning" />
        <Counter label="Delivered orders" value={counters.deliveredOrders} href={canOrders ? "/admin/orders?status=DELIVERED" : undefined} />
        <Counter label="Low stock" value={counters.lowStock} href={canInventory ? "/admin/inventory?stock=low" : undefined} tone="warning" />
        <Counter label="Out of stock" value={counters.outOfStock} href={canInventory ? "/admin/inventory?stock=out" : undefined} tone="danger" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RevenueChart points={series.points} currency={currency} />
        <OrdersChart points={series.points} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <StatusChart data={breakdown.byStatus} />
        <CategoryChart data={breakdown.byCategory} currency={currency} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel title="Top-selling products" description={range.label} className="xl:col-span-2" bodyClassName="p-0">
          {topProducts.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No sales in this period.</p>
          ) : (
            <ul className="divide-y">
              {topProducts.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                    {p.image && <SmartImage src={p.image} alt="" fill sizes="40px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/products/${p.id}`} className="block truncate text-sm font-medium hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium tabular-nums">{money(p.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{p.units} sold</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent orders"
          className="xl:col-span-3"
          bodyClassName="p-0"
          actions={canOrders && <Link href="/admin/orders" className="text-xs font-medium hover:underline">View all</Link>}
        >
          {recent.orders.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Order</th>
                    <th className="px-3 py-2.5 font-medium">Customer</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Payment</th>
                    <th className="px-5 py-2.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recent.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-secondary/30">
                      <td className="px-5 py-2.5">
                        {canOrders ? (
                          <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                            {o.orderNumber}
                          </Link>
                        ) : (
                          <span className="font-medium">{o.orderNumber}</span>
                        )}
                        <p className="text-xs text-muted-foreground">{dateFmt.format(new Date(o.placedAt))}</p>
                      </td>
                      <td className="px-3 py-2.5">{o.customerName}</td>
                      <td className="px-3 py-2.5">
                        <OrderStatusBadge status={o.status as OrderStatusValue} />
                      </td>
                      <td className="px-3 py-2.5">
                        <PaymentStatusBadge status={o.paymentStatus as PaymentStatusValue} />
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium tabular-nums">{money(o.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Recent customers"
          bodyClassName="p-0"
          actions={canCustomers && <Link href="/admin/customers" className="text-xs font-medium hover:underline">View all</Link>}
        >
          {recent.customers.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No customers yet.</p>
          ) : (
            <ul className="divide-y">
              {recent.customers.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    {canCustomers ? (
                      <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{c.name}</span>
                    )}
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Joined {dayFmt.format(new Date(c.createdAt))}</p>
                    <p>
                      {c.orders} order{c.orders === 1 ? "" : "s"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Low-stock alerts"
          description={`Variants at or below their threshold (store default ${counters.lowStockThreshold})`}
          bodyClassName="p-0"
          actions={canInventory && <Link href="/admin/inventory" className="text-xs font-medium hover:underline">Manage inventory</Link>}
        >
          {recent.lowStock.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">All products are well stocked.</p>
          ) : (
            <ul className="divide-y">
              {recent.lowStock.map((v) => (
                <li key={v.variantId} className="flex items-center gap-3 px-5 py-3 text-sm">
                  {v.quantity <= 0 ? (
                    <PackageX className="size-4 shrink-0 text-destructive" aria-hidden />
                  ) : (
                    <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {v.productName}
                      {v.variantName !== "Default" && <span className="font-normal text-muted-foreground"> · {v.variantName}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{v.sku}</p>
                  </div>
                  <ToneBadge tone={v.quantity <= 0 ? "danger" : "warning"}>{v.quantity <= 0 ? "Out of stock" : `${v.quantity} left`}</ToneBadge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

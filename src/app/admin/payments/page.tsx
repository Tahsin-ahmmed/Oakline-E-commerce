import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, CreditCard, HandCoins, RotateCcw, Wallet } from "lucide-react";
import type { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { requireStaff } from "@/lib/auth/guards";
import { oneOf, pageParams, str, type SearchParams } from "@/lib/admin-params";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, PAYMENT_STATUS_LABELS, PAYMENT_STATUSES, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { listPayments, paymentSummary } from "@/services/admin/payments";
import { getSettings } from "@/services/settings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/admin/list-toolbar";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationLinks } from "@/components/shared/pagination-links";

export const metadata = { title: "Payments" };

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("payments.view", "/admin/payments");
  const sp = await searchParams;
  const { page, pageSize } = pageParams(sp);
  const filters = {
    q: str(sp, "q"),
    method: oneOf(sp, "method", PAYMENT_METHODS) as PaymentMethod | undefined,
    status: oneOf(sp, "status", PAYMENT_STATUSES) as PaymentStatus | undefined,
  };
  const [list, summary, { general }] = await Promise.all([listPayments({ ...filters, page, pageSize }), paymentSummary(), getSettings()]);
  const money = (v: string) => formatMoney(v, general.currency);
  const totalPages = Math.max(1, Math.ceil(list.total / pageSize));

  return (
    <>
      <PageHeader title="Payments" description="Every payment attempt, collection and refund across all orders." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Wallet} label="Collected" value={money(summary.collected)} hint="Paid & partially refunded payments" />
        <Stat icon={HandCoins} label="COD pending" value={money(summary.pendingCod)} hint={`${summary.pendingCodCount} open COD order(s)`} />
        <Stat icon={RotateCcw} label="Refunded" value={money(summary.refunded)} />
        <Stat icon={AlertTriangle} label="Failed payments" value={String(summary.failed)} />
      </div>

      {summary.awaitingCollection.length > 0 && (
        <Panel title="COD awaiting collection" description="Shipped Cash on Delivery orders not yet marked paid." className="mb-6" bodyClassName="p-0">
          <ul className="divide-y">
            {summary.awaitingCollection.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                    {o.orderNumber}
                  </Link>
                  <span className="text-muted-foreground"> · {o.customerName}</span>
                </div>
                <span className="text-muted-foreground">
                  {ORDER_STATUS_LABELS[o.status]}
                  {o.courier ? ` via ${o.courier}` : ""}
                  {o.shippedAt ? ` · shipped ${format(new Date(o.shippedAt), "d MMM")}` : ""}
                </span>
                <span className="font-medium tabular-nums">{money(o.grandTotal)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Toolbar>
        <SearchInput placeholder="Order #, customer or provider ref" />
        <FilterSelect param="method" placeholder="All methods" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
        <FilterSelect param="status" placeholder="All statuses" options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] }))} />
        <ClearFilters keys={["q", "method", "status"]} />
      </Toolbar>
      {list.items.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments found" description="Try a different search or filter." />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Order</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="hidden lg:table-cell">Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="pr-4 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4">
                      <Link href={`/admin/orders/${p.order.id}`} className="font-medium hover:underline">
                        {p.order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">{p.order.customerName}</p>
                    </TableCell>
                    <TableCell className="text-sm">{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                    <TableCell className="hidden max-w-56 truncate font-mono text-xs lg:table-cell">
                      {p.providerPaymentId ?? p.providerReference ?? "—"}
                      {p.failureReason && <p className="truncate font-sans text-destructive">{p.failureReason}</p>}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {format(new Date(p.paidAt ?? p.createdAt), "d MMM yyyy")}
                      <p className="text-xs text-muted-foreground">{p.paidAt ? "Paid" : "Created"}</p>
                    </TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">
                      <span className="font-medium">{formatMoney(p.amount, p.currency)}</span>
                      {Number(p.refundedAmount) > 0 && (
                        <p className="text-xs text-muted-foreground">-{formatMoney(p.refundedAmount, p.currency)} refunded</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationLinks page={page} totalPages={totalPages} basePath="/admin/payments" searchParams={sp} className="mt-6" />
        </>
      )}
    </>
  );
}

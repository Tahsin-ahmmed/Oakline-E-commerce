import Link from "next/link";
import { format } from "date-fns";
import { RotateCcw } from "lucide-react";
import type { ReturnStatus } from "@/generated/prisma/enums";
import { requireStaff } from "@/lib/auth/guards";
import { oneOf, pageParams, type SearchParams } from "@/lib/admin-params";
import { formatMoney } from "@/lib/money";
import { listReturns, RETURN_STATUS_LABELS } from "@/services/admin/returns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ClearFilters, FilterSelect, Toolbar } from "@/components/admin/list-toolbar";
import { ToneBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { ReturnActions } from "@/components/admin/orders/return-actions";

export const metadata = { title: "Returns" };

const STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "REFUNDED"] as const;
const TONE = { REQUESTED: "warning", APPROVED: "info", REJECTED: "danger", RECEIVED: "progress", REFUNDED: "success" } as const;

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("orders.view", "/admin/returns");
  const sp = await searchParams;
  const status = oneOf(sp, "status", STATUSES) as ReturnStatus | undefined;
  const { page, pageSize } = pageParams(sp);
  const data = await listReturns({ status, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <>
      <PageHeader
        title="Returns"
        description={`${data.counts.REQUESTED ?? 0} awaiting review · ${data.counts.APPROVED ?? 0} approved · ${data.counts.RECEIVED ?? 0} received`}
      />
      <Toolbar>
        <FilterSelect param="status" placeholder="All returns" options={STATUSES.map((s) => ({ value: s, label: `${RETURN_STATUS_LABELS[s]} (${data.counts[s] ?? 0})` }))} />
        <ClearFilters keys={["status"]} />
      </Toolbar>
      {data.items.length === 0 ? (
        <EmptyState icon={RotateCcw} title="No return requests" description="Customers can request returns from delivered orders in their account." />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Order</TableHead>
                  <TableHead>Item & reason</TableHead>
                  <TableHead className="hidden md:table-cell">Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r) => (
                  <TableRow key={r.id} className="align-top">
                    <TableCell className="pl-4">
                      <Link href={`/admin/orders/${r.order.id}`} className="font-medium hover:underline">
                        {r.order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.order.customerName}</p>
                    </TableCell>
                    <TableCell className="max-w-sm whitespace-normal">
                      <p className="font-medium">
                        {r.item ? `${r.item.productName}${r.item.variantName ? ` (${r.item.variantName})` : ""} × ${r.quantity}` : "Whole order"}
                      </p>
                      <p className="text-sm">{r.reason}</p>
                      {r.details && <p className="mt-1 text-xs text-muted-foreground">“{r.details}”</p>}
                      {r.adminNote && <p className="mt-1 text-xs text-muted-foreground">Staff note: {r.adminNote}</p>}
                      {r.refundAmount && <p className="mt-1 text-xs">Refunded {formatMoney(r.refundAmount, r.order.currency)}</p>}
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{format(new Date(r.createdAt), "d MMM yyyy")}</TableCell>
                    <TableCell>
                      <ToneBadge tone={TONE[r.status]}>{RETURN_STATUS_LABELS[r.status]}</ToneBadge>
                    </TableCell>
                    <TableCell className="pr-4">
                      <ReturnActions item={r} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationLinks page={page} totalPages={totalPages} basePath="/admin/returns" searchParams={sp} className="mt-6" />
        </>
      )}
    </>
  );
}

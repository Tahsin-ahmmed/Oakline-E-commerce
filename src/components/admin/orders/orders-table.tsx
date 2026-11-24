"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { useAdmin } from "@/components/admin/admin-context";
import { useSelection } from "@/hooks/use-selection";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, PAYMENT_METHOD_LABELS, type OrderStatusValue } from "@/lib/order-status";
import type { AdminOrderRow } from "@/services/admin/orders";

interface BulkResult {
  succeeded: number;
  failed: number;
  results: { orderNumber: string; ok: boolean; error?: string }[];
}

export function OrdersTable({ orders }: { orders: AdminOrderRow[] }) {
  const router = useRouter();
  const { can, currency } = useAdmin();
  const sel = useSelection(orders.map((o) => o.id));
  const [bulkStatus, setBulkStatus] = useState<OrderStatusValue | "">("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const canManage = can("orders.manage");

  const applyBulk = async () => {
    if (!bulkStatus || !sel.selected.length) return;
    setBusy(true);
    try {
      const res = await api<BulkResult>("/api/admin/orders/bulk-status", {
        body: { ids: sel.selected, status: bulkStatus, notifyCustomer: notify },
      });
      if (res.succeeded) toast.success(`Updated ${res.succeeded} order${res.succeeded === 1 ? "" : "s"}.`);
      for (const r of res.results.filter((x) => !x.ok).slice(0, 5)) toast.error(`${r.orderNumber}: ${r.error}`);
      if (res.failed > 5) toast.error(`…and ${res.failed - 5} more could not be updated.`);
      sel.clear();
      setBulkStatus("");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {canManage && sel.selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b bg-secondary/50 px-4 py-2.5 text-sm">
          <span className="font-medium">{sel.selected.length} selected</span>
          <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as OrderStatusValue)}>
            <SelectTrigger size="sm" className="h-8 w-48 bg-card" aria-label="New status">
              <SelectValue placeholder="Change status to…" />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.filter((s) => s !== "REFUNDED").map((s) => (
                <SelectItem key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="bulk-notify" checked={notify} onCheckedChange={setNotify} />
            <Label htmlFor="bulk-notify" className="text-xs">Email customers</Label>
          </div>
          <Button size="sm" disabled={!bulkStatus || busy} onClick={applyBulk}>
            {busy && <Loader2 className="animate-spin" />} Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={sel.clear}>
            Clear
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {canManage && (
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={sel.allSelected ? true : sel.someSelected ? "indeterminate" : false}
                  onCheckedChange={sel.toggleAll}
                  aria-label="Select all orders"
                />
              </TableHead>
            )}
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="hidden md:table-cell">Placed</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Payment</TableHead>
            <TableHead className="pr-4 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id} data-state={sel.isSelected(o.id) ? "selected" : undefined}>
              {canManage && (
                <TableCell className="pl-4">
                  <Checkbox checked={sel.isSelected(o.id)} onCheckedChange={() => sel.toggle(o.id)} aria-label={`Select ${o.orderNumber}`} />
                </TableCell>
              )}
              <TableCell>
                <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                  {o.orderNumber}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {o._count.items} item{o._count.items === 1 ? "" : "s"} · {o.shipDistrict}
                </p>
              </TableCell>
              <TableCell>
                <p className="max-w-48 truncate">{o.customerName}</p>
                <p className="max-w-48 truncate text-xs text-muted-foreground">{o.customerEmail}</p>
              </TableCell>
              <TableCell className="hidden text-sm md:table-cell">
                {format(new Date(o.placedAt), "d MMM yyyy")}
                <p className="text-xs text-muted-foreground">{format(new Date(o.placedAt), "h:mm a")}</p>
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={o.status} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <PaymentStatusBadge status={o.paymentStatus} />
                <p className="mt-1 text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[o.paymentMethod]}</p>
              </TableCell>
              <TableCell className="pr-4 text-right font-medium tabular-nums">{formatMoney(o.grandTotal, o.currency || currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

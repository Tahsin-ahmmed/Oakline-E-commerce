"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "@/components/shared/form-field";
import { StockBadge, ToneBadge } from "@/components/shared/status-badge";
import { MovementsTable } from "@/components/admin/inventory/movements-table";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { stockAdjustSchema } from "@/lib/validations/admin/catalog";
import type { InventoryRow, MovementRow } from "@/services/admin/inventory";

export function InventoryTable({ rows, canAdjust }: { rows: InventoryRow[]; canAdjust: boolean }) {
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null);
  const [history, setHistory] = useState<InventoryRow | null>(null);
  return (
    <div className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="hidden md:table-cell">Category</TableHead>
            <TableHead className="text-right">On hand</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Alert at</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.inventoryId}>
              <TableCell className="pl-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.image && <img src={r.image} alt="" className="size-full object-cover" loading="lazy" />}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/admin/products/${r.productId}`} className="block max-w-60 truncate text-sm font-medium hover:underline">
                      {r.productName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.variantName ?? "Single variant"}
                      {!r.isActive && " · inactive"}
                      {r.productStatus !== "ACTIVE" && ` · ${r.productStatus.toLowerCase()}`}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">{r.sku}</TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{r.category}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{r.quantity}</TableCell>
              <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">{r.lowStockThreshold}</TableCell>
              <TableCell>
                {r.quantity <= 0 ? (
                  <ToneBadge tone="danger">Out of stock</ToneBadge>
                ) : r.quantity <= r.lowStockThreshold ? (
                  <ToneBadge tone="warning">Low stock</ToneBadge>
                ) : (
                  <StockBadge quantity={r.quantity} threshold={r.lowStockThreshold} />
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setHistory(r)} aria-label={`Stock history for ${r.sku}`} title="History">
                    <History />
                  </Button>
                  {canAdjust && (
                    <Button variant="outline" size="sm" onClick={() => setAdjusting(r)}>
                      <SlidersHorizontal /> Adjust
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {adjusting && <AdjustDialog row={adjusting} onClose={() => setAdjusting(null)} />}
      <HistorySheet row={history} onClose={() => setHistory(null)} />
    </div>
  );
}

function AdjustDialog({ row, onClose }: { row: InventoryRow; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"add" | "set">("add");
  const [quantity, setQuantity] = useState("");
  const [type, setType] = useState<"RESTOCK" | "ADJUSTMENT" | "RETURN">("RESTOCK");
  const [reason, setReason] = useState("");
  const [threshold, setThreshold] = useState(String(row.lowStockThreshold));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const q = Number(quantity);
  const preview = quantity.trim() === "" || !Number.isFinite(q) ? null : mode === "set" ? q : row.quantity + q;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      variantId: row.variantId,
      mode,
      quantity: quantity.trim() === "" ? Number.NaN : Math.trunc(q),
      type,
      reason,
      lowStockThreshold: threshold.trim() === "" ? undefined : Number(threshold),
    };
    const parsed = stockAdjustSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await api<{ quantity: number }>("/api/admin/inventory/adjust", { body: parsed.data });
      toast.success(`Stock for ${row.sku} is now ${res.quantity}`);
      onClose();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        setErrors(Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : String(v)])));
      }
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {row.productName}
            {row.variantName ? ` · ${row.variantName}` : ""} — {row.sku}. Currently <strong>{row.quantity}</strong> on hand.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <ToggleGroup
            type="single"
            variant="outline"
            value={mode}
            onValueChange={(v) => v && setMode(v as "add" | "set")}
            className="w-full"
          >
            <ToggleGroupItem value="add" className="flex-1">
              Add / remove
            </ToggleGroupItem>
            <ToggleGroupItem value="set" className="flex-1">
              Set exact count
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={mode === "add" ? "Change (use − to remove)" : "New on-hand quantity"}
              htmlFor="adj-q"
              error={errors.quantity}
              hint={preview !== null ? `Result: ${preview}` : undefined}
            >
              <Input id="adj-q" type="number" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
            </Field>
            <Field label="Movement type" htmlFor="adj-type">
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger id="adj-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESTOCK">Restock / delivery</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment / count</SelectItem>
                  <SelectItem value="RETURN">Customer return</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Reason" htmlFor="adj-reason" error={errors.reason} required>
            <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Supplier delivery PO-1042, damaged in storage…" />
          </Field>
          <Field label="Low-stock alert at" htmlFor="adj-th" error={errors.lowStockThreshold}>
            <Input id="adj-th" type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
          {preview !== null && preview < 0 && <p className="text-xs text-destructive">Stock cannot go below zero.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || (preview !== null && preview < 0)}>
              {busy && <Loader2 className="animate-spin" />}
              Save adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistorySheet({ row, onClose }: { row: InventoryRow | null; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["stock-history", row?.variantId],
    queryFn: () => api<{ items: MovementRow[]; total: number }>(`/api/admin/inventory/movements?variantId=${row!.variantId}&pageSize=100`),
    enabled: Boolean(row),
  });
  return (
    <Sheet open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Stock history</SheetTitle>
          <SheetDescription>
            {row?.productName}
            {row?.variantName ? ` · ${row.variantName}` : ""} — {row?.sku}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">Could not load the history.</p>
          ) : data?.items.length ? (
            <>
              <MovementsTable rows={data.items} />
              {data.total > data.items.length && <p className="mt-3 text-xs text-muted-foreground">Showing the latest {data.items.length} of {data.total} movements.</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No movements recorded yet.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

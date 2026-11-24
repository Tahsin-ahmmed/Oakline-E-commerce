"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Copy, ExternalLink, Loader2, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StockBadge, ToneBadge } from "@/components/shared/status-badge";
import { useAdmin } from "@/components/admin/admin-context";
import { useSelection } from "@/hooks/use-selection";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { AdminProductRow } from "@/services/admin/products";

const STATUS_TONE = { ACTIVE: "success", DRAFT: "warning", ARCHIVED: "neutral" } as const;

export function ProductStatusBadge({ status }: { status: "ACTIVE" | "DRAFT" | "ARCHIVED" }) {
  return <ToneBadge tone={STATUS_TONE[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</ToneBadge>;
}

export function ProductsTable({ rows, canManage }: { rows: AdminProductRow[]; canManage: boolean }) {
  const router = useRouter();
  const { currency } = useAdmin();
  const sel = useSelection(rows.map((r) => r.id));
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string>("ACTIVE");
  const [toDelete, setToDelete] = useState<AdminProductRow | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(success);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const bulk = (action: "delete" | "status" | "feature" | "unfeature", status?: string) =>
    run(
      "bulk",
      async () => {
        const res = await api<{ count: number }>("/api/admin/products/bulk", { body: { ids: sel.selected, action, status } });
        sel.clear();
        return res;
      },
      action === "delete" ? `Deleted ${sel.selected.length} product(s)` : `Updated ${sel.selected.length} product(s)`,
    );

  return (
    <div className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
      {canManage && sel.selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-secondary/50 px-4 py-2.5">
          <span className="text-sm font-medium">{sel.selected.length} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger size="sm" className="h-8 w-32" aria-label="Status to apply">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={busy === "bulk"} onClick={() => bulk("status", bulkStatus)}>
              Set status
            </Button>
            <Button size="sm" variant="outline" disabled={busy === "bulk"} onClick={() => bulk("feature")}>
              <Star /> Feature
            </Button>
            <Button size="sm" variant="outline" disabled={busy === "bulk"} onClick={() => bulk("unfeature")}>
              Unfeature
            </Button>
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="destructive" disabled={busy === "bulk"}>
                  <Trash2 /> Delete
                </Button>
              }
              title={`Delete ${sel.selected.length} product(s)?`}
              description="They will be removed from the store, carts and wishlists. Order history is kept."
              confirmLabel="Delete"
              destructive
              onConfirm={() => bulk("delete")}
            />
            {busy === "bulk" && <Loader2 className="size-4 animate-spin" />}
          </div>
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
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <TableHead>Product</TableHead>
            <TableHead className="hidden md:table-cell">Category</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
            <TableHead className="hidden lg:table-cell">Featured</TableHead>
            <TableHead className="hidden xl:table-cell">Updated</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id} data-state={sel.isSelected(p.id) ? "selected" : undefined}>
              {canManage && (
                <TableCell className="pl-4">
                  <Checkbox checked={sel.isSelected(p.id)} onCheckedChange={() => sel.toggle(p.id)} aria-label={`Select ${p.name}`} />
                </TableCell>
              )}
              <TableCell>
                <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                  <div className="size-11 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image && <img src={p.image} alt="" className="size-full object-cover" loading="lazy" />}
                  </div>
                  <div className="min-w-0">
                    <p className="max-w-64 truncate font-medium hover:underline">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.sku}
                      {p.hasVariants && ` · ${p.variantCount} variants`}
                    </p>
                  </div>
                </Link>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {p.category.name}
                {p.brand && <span className="block text-xs">{p.brand.name}</span>}
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {p.salePrice ? (
                  <>
                    <span className="text-clay">{formatMoney(p.salePrice, currency)}</span>
                    <span className="block text-xs text-muted-foreground line-through">{formatMoney(p.price, currency)}</span>
                  </>
                ) : (
                  formatMoney(p.price, currency)
                )}
              </TableCell>
              <TableCell>
                <StockBadge quantity={p.stockQuantity} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <ProductStatusBadge status={p.status} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Switch
                  checked={p.isFeatured}
                  disabled={!canManage || busy === `f-${p.id}`}
                  aria-label={`Feature ${p.name}`}
                  onCheckedChange={(v) =>
                    run(`f-${p.id}`, () => api(`/api/admin/products/${p.id}`, { method: "PATCH", body: { isFeatured: v } }), v ? "Product featured" : "Removed from featured")
                  }
                />
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}>
                      {busy === `r-${p.id}` ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/products/${p.id}`}>
                        <Pencil /> {canManage ? "Edit" : "View"}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/products/${p.slug}`} target="_blank">
                        <ExternalLink /> View on store
                      </Link>
                    </DropdownMenuItem>
                    {canManage && (
                      <>
                        <DropdownMenuItem
                          onSelect={() =>
                            run(
                              `r-${p.id}`,
                              async () => {
                                const res = await api<{ id: string }>(`/api/admin/products/${p.id}/duplicate`, { method: "POST" });
                                router.push(`/admin/products/${res.id}`);
                              },
                              "Product duplicated as a draft",
                            )
                          }
                        >
                          <Copy /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(p)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ControlledConfirm
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.name ?? ""}”?`}
        description="The product is removed from the store, carts and wishlists. Past orders keep their details."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await api(`/api/admin/products/${toDelete.id}`, { method: "DELETE" });
            toast.success("Product deleted");
            router.refresh();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

/** Controlled confirmation dialog (safe to open from dropdown menus). */
export function ControlledConfirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch {
                /* keep the dialog open; the caller already reported the error */
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

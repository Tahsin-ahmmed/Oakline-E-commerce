"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { History, MoreHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToneBadge } from "@/components/shared/status-badge";
import { useAdmin } from "@/components/admin/admin-context";
import { CouponFormDialog } from "@/components/admin/coupons/coupon-form-dialog";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { AdminCouponRow } from "@/services/admin/coupons";

const STATE_TONE = { active: "success", scheduled: "info", expired: "neutral", inactive: "warning" } as const;

interface Usage {
  id: string;
  email: string;
  discountAmount: string;
  createdAt: string;
  order: { id: string; orderNumber: string; status: string; grandTotal: string };
}

function UsageDialog({ coupon, onClose }: { coupon: AdminCouponRow | null; onClose: () => void }) {
  const { currency } = useAdmin();
  const { data, isLoading } = useQuery({
    queryKey: ["coupon-usage", coupon?.id],
    queryFn: () => api<{ usages: Usage[] }>(`/api/admin/coupons/${coupon!.id}`),
    enabled: Boolean(coupon),
  });
  return (
    <Dialog open={Boolean(coupon)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{coupon?.code} usage</DialogTitle>
          <DialogDescription>
            Used {coupon?.usedCount ?? 0} time(s){coupon?.usageLimit ? ` of ${coupon.usageLimit}` : ""}.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data?.usages.length ? (
          <p className="text-sm text-muted-foreground">This coupon hasn&apos;t been used yet.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto text-sm">
            {data.usages.map((u) => (
              <li key={u.id} className="flex justify-between gap-3 py-2.5">
                <div>
                  <Link href={`/admin/orders/${u.order.id}`} className="font-medium hover:underline">
                    {u.order.orderNumber}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {u.email} · {format(new Date(u.createdAt), "d MMM yyyy")}
                  </p>
                </div>
                <span className="tabular-nums">-{formatMoney(u.discountAmount, currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CouponsTable({ coupons }: { coupons: AdminCouponRow[] }) {
  const router = useRouter();
  const { currency } = useAdmin();
  const [editing, setEditing] = useState<AdminCouponRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [usageFor, setUsageFor] = useState<AdminCouponRow | null>(null);
  const [deleting, setDeleting] = useState<AdminCouponRow | null>(null);

  const describe = (c: AdminCouponRow) =>
    c.type === "PERCENTAGE"
      ? `${Number(c.value)}% off${c.maxDiscount ? ` (max ${formatMoney(c.maxDiscount, currency)})` : ""}`
      : c.type === "FIXED"
        ? `${formatMoney(c.value, currency)} off`
        : "Free shipping";

  const toggle = async (c: AdminCouponRow) => {
    try {
      await api(`/api/admin/coupons/${c.id}`, { method: "PATCH", body: { isActive: !c.isActive } });
      toast.success(c.isActive ? "Coupon deactivated." : "Coupon activated.");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus /> New coupon
        </Button>
      </div>
      {coupons.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">No coupons match these filters.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="hidden lg:table-cell">Conditions</TableHead>
                <TableHead className="hidden md:table-cell">Validity</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4">
                    <p className="font-mono font-medium">{c.code}</p>
                    {c.description && <p className="max-w-56 truncate text-xs text-muted-foreground">{c.description}</p>}
                  </TableCell>
                  <TableCell className="text-sm">{describe(c)}</TableCell>
                  <TableCell className="hidden max-w-64 text-xs whitespace-normal text-muted-foreground lg:table-cell">
                    {c.minPurchase && <p>Min. {formatMoney(c.minPurchase, currency)}</p>}
                    {c.perCustomerLimit && <p>{c.perCustomerLimit}× per customer</p>}
                    {c.categories.length > 0 && <p>Categories: {c.categories.map((x) => x.name).join(", ")}</p>}
                    {c.products.length > 0 && <p>{c.products.length} product(s)</p>}
                    {!c.minPurchase && !c.perCustomerLimit && !c.categories.length && !c.products.length && <p>Whole cart</p>}
                  </TableCell>
                  <TableCell className="hidden text-xs md:table-cell">
                    {c.startsAt ? format(new Date(c.startsAt), "d MMM yyyy") : "Now"} – {c.expiresAt ? format(new Date(c.expiresAt), "d MMM yyyy") : "No expiry"}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={STATE_TONE[c.state]}>{c.state}</ToneBadge>
                  </TableCell>
                  <TableCell className="pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.code}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(c)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setUsageFor(c)}>
                          <History /> Usage history
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => toggle(c)}>
                          <Power /> {c.isActive ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {creating && <CouponFormDialog open onOpenChange={setCreating} />}
      {editing && <CouponFormDialog key={editing.id} open onOpenChange={(o) => !o && setEditing(null)} coupon={editing} />}
      <UsageDialog coupon={usageFor} onClose={() => setUsageFor(null)} />
      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.code}?</AlertDialogTitle>
            <AlertDialogDescription>The coupon stops working immediately. Past orders and usage history are kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await api(`/api/admin/coupons/${deleting.id}`, { method: "DELETE" });
                  toast.success("Coupon deleted.");
                  router.refresh();
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

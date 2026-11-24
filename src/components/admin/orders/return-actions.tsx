"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/form-field";
import { useAdmin } from "@/components/admin/admin-context";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { AdminReturnRow } from "@/services/admin/returns";

type Action = "approve" | "reject" | "receive" | "refund";

const LABELS: Record<Action, string> = { approve: "Approve", reject: "Reject", receive: "Mark received", refund: "Refund" };

export function ReturnActions({ item }: { item: AdminReturnRow }) {
  const router = useRouter();
  const { can } = useAdmin();
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState(item.suggestedRefund);
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available: Action[] = [];
  if (item.status === "REQUESTED") available.push("approve", "reject");
  if (item.status === "APPROVED") available.push("receive", "refund", "reject");
  if (item.status === "RECEIVED") available.push("refund");
  const canPayout = can("payments.manage");
  const actions = available.filter((a) => a !== "refund" || canPayout);
  if (!can("orders.manage") || actions.length === 0) return null;
  const paid = ["PAID", "PARTIALLY_REFUNDED"].includes(item.order.paymentStatus);

  const submit = async () => {
    if (!action) return;
    setError(null);
    if (action === "reject" && note.trim().length < 3) return setError("Explain why the return is rejected.");
    if (action === "refund") {
      const n = Number(amount);
      if (!(n > 0) || n > Number(item.refundable)) return setError(`Enter an amount between 0.01 and ${item.refundable}.`);
    }
    setBusy(true);
    try {
      await api(`/api/admin/returns/${item.id}`, {
        method: "PATCH",
        body: { action, note: note || undefined, ...(action === "refund" ? { amount: Number(amount), restock } : {}) },
      });
      toast.success(`Return ${action === "receive" ? "marked received" : `${action}${action.endsWith("e") ? "d" : "ed"}`}.`);
      setAction(null);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        {actions.map((a) => (
          <Button
            key={a}
            size="sm"
            variant={a === "reject" ? "ghost" : a === "refund" ? "default" : "outline"}
            disabled={a === "refund" && !paid}
            title={a === "refund" && !paid ? "No captured payment to refund on this order" : undefined}
            onClick={() => {
              setError(null);
              setAction(a);
            }}
          >
            {LABELS[a]}
          </Button>
        ))}
      </div>
      <Dialog open={action !== null} onOpenChange={(o) => !busy && !o && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action ? LABELS[action] : ""} return</DialogTitle>
            <DialogDescription>
              {item.order.orderNumber} · {item.item ? `${item.item.productName} × ${item.quantity}` : "Whole order"} · {item.reason}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {action === "refund" && (
              <>
                <Field label="Refund amount" htmlFor="ret-amount" hint={`Up to ${formatMoney(item.refundable, item.order.currency)} remains refundable.`}>
                  <Input id="ret-amount" type="number" step="0.01" min="0.01" max={item.refundable} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={restock} onCheckedChange={(v) => setRestock(v === true)} /> Return items to inventory
                </label>
              </>
            )}
            <Field label={action === "reject" ? "Reason (sent to the customer)" : "Note (optional)"} htmlFor="ret-note">
              <Textarea id="ret-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
            </Field>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={busy}>
              Close
            </Button>
            <Button variant={action === "reject" ? "destructive" : "default"} onClick={submit} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {action ? LABELS[action] : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

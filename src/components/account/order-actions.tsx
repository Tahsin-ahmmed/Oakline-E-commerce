"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field } from "@/components/shared/form-field";
import { api, errorMessage } from "@/lib/api-client";

const REASONS = ["Damaged or defective", "Wrong item received", "Not as described", "Changed my mind", "Other"] as const;

export function OrderActions({
  orderId,
  canCancel,
  canRetryPayment,
  returnableItems,
}: {
  orderId: string;
  canCancel: boolean;
  canRetryPayment: boolean;
  returnableItems: { id: string; name: string; quantity: number }[];
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  if (!canCancel && !canRetryPayment && returnableItems.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {canRetryPayment && (
        <Button
          disabled={paying}
          onClick={async () => {
            setPaying(true);
            try {
              const res = await api<{ redirectUrl: string }>(`/api/orders/${orderId}/pay`, { method: "POST", body: {} });
              if (/^https?:\/\//.test(res.redirectUrl)) window.location.assign(res.redirectUrl);
              else router.push(res.redirectUrl);
            } catch (e) {
              toast.error(errorMessage(e));
              setPaying(false);
            }
          }}
        >
          {paying ? <Loader2 className="animate-spin" /> : <CreditCard />} Complete payment
        </Button>
      )}
      {canCancel && (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <XCircle /> Cancel order
            </Button>
          }
          title="Cancel this order?"
          description="Your items will be released and you won't be charged. This can't be undone."
          confirmLabel="Cancel order"
          destructive
          onConfirm={async () => {
            try {
              await api(`/api/orders/${orderId}/cancel`, { method: "POST", body: {} });
              toast.success("Your order has been cancelled.");
              router.refresh();
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        />
      )}
      {returnableItems.length > 0 && <ReturnDialog orderId={orderId} items={returnableItems} />}
    </div>
  );
}

function ReturnDialog({ orderId, items }: { orderId: string; items: { id: string; name: string; quantity: number }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = items.find((i) => i.id === itemId);

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RotateCcw /> Request a return
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a return</DialogTitle>
          <DialogDescription>Tell us what you&apos;d like to return. We&apos;ll review your request within one business day.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            if (!reason) {
              setError("Please choose a reason.");
              return;
            }
            setBusy(true);
            try {
              await api(`/api/orders/${orderId}/return`, {
                body: { orderItemId: itemId, reason, details: details.trim() || undefined, quantity },
              });
              toast.success("Return requested — we'll be in touch shortly.");
              setOpen(false);
              router.refresh();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Item" htmlFor="return-item">
            <Select
              value={itemId}
              onValueChange={(v) => {
                setItemId(v);
                setQuantity(1);
              }}
            >
              <SelectTrigger id="return-item" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {item && item.quantity > 1 && (
            <Field label="Quantity" htmlFor="return-qty">
              <Select value={String(quantity)} onValueChange={(v) => setQuantity(Number(v))}>
                <SelectTrigger id="return-qty" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: item.quantity }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Reason" htmlFor="return-reason">
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="return-reason" className="w-full">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Details (optional)" htmlFor="return-details">
            <Textarea id="return-details" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Close
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

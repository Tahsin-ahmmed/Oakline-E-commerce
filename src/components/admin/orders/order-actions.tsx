"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CreditCard, Loader2, RefreshCcw, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAdmin } from "@/components/admin/admin-context";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import {
  allowedTransitions,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatusValue,
  type PaymentMethodValue,
  type PaymentStatusValue,
} from "@/lib/order-status";

export interface OrderActionsProps {
  orderId: string;
  orderNumber: string;
  status: OrderStatusValue;
  paymentStatus: PaymentStatusValue;
  paymentMethod: PaymentMethodValue;
  currency: string;
  refundable: string;
  trackingNumber: string | null;
  courier: string | null;
}

function fieldError(e: unknown, field: string) {
  if (e instanceof ApiClientError && e.details && field in e.details) {
    const v = (e.details as Record<string, string[] | string>)[field];
    return Array.isArray(v) ? v[0] : v;
  }
  return undefined;
}

export function OrderActions(props: OrderActionsProps) {
  const router = useRouter();
  const { can } = useAdmin();
  const transitions = allowedTransitions(props.status, props.paymentStatus).filter((s) => s !== "REFUNDED" && s !== "CANCELLED");
  const canCancel = allowedTransitions(props.status, props.paymentStatus).includes("CANCELLED");
  const canRefund = Number(props.refundable) > 0 && ["PAID", "PARTIALLY_REFUNDED"].includes(props.paymentStatus);

  // Status dialog
  const [statusOpen, setStatusOpen] = useState(false);
  const [to, setTo] = useState<OrderStatusValue | "">(transitions[0] ?? "");
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState(props.trackingNumber ?? "");
  const [courier, setCourier] = useState(props.courier ?? "");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  // Payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payStatus, setPayStatus] = useState<PaymentStatusValue>(props.paymentStatus === "PAID" ? "UNPAID" : "PAID");

  // Refund dialog
  const [refundOpen, setRefundOpen] = useState(false);
  const [amount, setAmount] = useState(props.refundable);
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(false);
  const [refundErrors, setRefundErrors] = useState<Record<string, string | undefined>>({});

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      router.refresh();
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return e;
    } finally {
      setBusy(false);
    }
  };

  const showsTracking = to === "SHIPPED" || to === "OUT_FOR_DELIVERY";

  return (
    <div className="flex flex-wrap gap-2">
      {can("orders.manage") && transitions.length > 0 && (
        <Button
          onClick={() => {
            setTo(transitions[0] ?? "");
            setStatusOpen(true);
          }}
        >
          <Truck /> Update status
        </Button>
      )}
      {can("payments.manage") && props.paymentMethod === "COD" && !["REFUNDED", "PARTIALLY_REFUNDED"].includes(props.paymentStatus) && (
        <Button variant="outline" onClick={() => setPayOpen(true)}>
          <CreditCard /> Payment status
        </Button>
      )}
      {can("payments.manage") && canRefund && (
        <Button variant="outline" onClick={() => setRefundOpen(true)}>
          <RefreshCcw /> Process refund
        </Button>
      )}
      {can("orders.manage") && canCancel && (
        <ConfirmDialog
          trigger={
            <Button variant="destructive">
              <Ban /> Cancel order
            </Button>
          }
          title={`Cancel ${props.orderNumber}?`}
          description="Reserved stock is returned to inventory and the customer is notified. This cannot be undone."
          confirmLabel="Cancel order"
          destructive
          onConfirm={() =>
            run(
              () => api(`/api/admin/orders/${props.orderId}/status`, { body: { status: "CANCELLED", note: "Cancelled by store", notifyCustomer: true } }),
              "Order cancelled and stock restored.",
            )
          }
        />
      )}

      <Dialog open={statusOpen} onOpenChange={(o) => !busy && setStatusOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update order status</DialogTitle>
            <DialogDescription>
              Currently <strong>{ORDER_STATUS_LABELS[props.status]}</strong>. Only valid next steps are listed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="New status" htmlFor="new-status">
              <Select value={to} onValueChange={(v) => setTo(v as OrderStatusValue)}>
                <SelectTrigger id="new-status" className="w-full">
                  <SelectValue placeholder="Choose a status" />
                </SelectTrigger>
                <SelectContent>
                  {transitions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ORDER_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {showsTracking && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tracking number" htmlFor="tracking">
                  <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80} />
                </Field>
                <Field label="Courier" htmlFor="courier">
                  <Input id="courier" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. Pathao, RedX" maxLength={80} />
                </Field>
              </div>
            )}
            <Field label="Note (shown to the customer)" htmlFor="status-note">
              <Textarea id="status-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} /> Email the customer about this update
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)} disabled={busy}>
              Close
            </Button>
            <Button
              disabled={!to || busy}
              onClick={async () => {
                const ok = await run(
                  () =>
                    api(`/api/admin/orders/${props.orderId}/status`, {
                      body: {
                        status: to,
                        note,
                        notifyCustomer: notify,
                        ...(showsTracking ? { trackingNumber: tracking, courier } : {}),
                      },
                    }),
                  `Order marked ${ORDER_STATUS_LABELS[to as OrderStatusValue].toLowerCase()}.`,
                );
                if (ok === true) {
                  setStatusOpen(false);
                  setNote("");
                }
              }}
            >
              {busy && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={(o) => !busy && setPayOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cash on Delivery payment</DialogTitle>
            <DialogDescription>
              Currently <strong>{PAYMENT_STATUS_LABELS[props.paymentStatus]}</strong>. Mark as paid once the courier has remitted the cash.
            </DialogDescription>
          </DialogHeader>
          <Field label="Payment status" htmlFor="pay-status">
            <Select value={payStatus} onValueChange={(v) => setPayStatus(v as PaymentStatusValue)}>
              <SelectTrigger id="pay-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["UNPAID", "PENDING", "PAID", "FAILED", "CANCELLED"] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={busy}>
              Close
            </Button>
            <Button
              disabled={busy || payStatus === props.paymentStatus}
              onClick={async () => {
                const ok = await run(
                  () => api(`/api/admin/orders/${props.orderId}/payment`, { body: { status: payStatus } }),
                  "Payment status updated.",
                );
                if (ok === true) setPayOpen(false);
              }}
            >
              {busy && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={(o) => !busy && setRefundOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process refund</DialogTitle>
            <DialogDescription>
              Up to {formatMoney(props.refundable, props.currency)} can be refunded.{" "}
              {props.paymentMethod === "COD"
                ? "For Cash on Delivery, record the refund after paying the customer (e.g. via bKash or bank)."
                : "The refund is sent through the payment provider."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Amount" htmlFor="refund-amount" error={refundErrors.amount}>
              <Input
                id="refund-amount"
                type="number"
                min="0.01"
                step="0.01"
                max={props.refundable}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Reason" htmlFor="refund-reason" error={refundErrors.reason}>
              <Textarea id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={restock} onCheckedChange={(v) => setRestock(v === true)} /> Return items to inventory
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={busy}>
              Close
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setRefundErrors({});
                const n = Number(amount);
                if (!(n > 0) || n > Number(props.refundable)) {
                  setRefundErrors({ amount: `Enter an amount between 0.01 and ${props.refundable}` });
                  return;
                }
                if (reason.trim().length < 3) {
                  setRefundErrors({ reason: "Give a reason" });
                  return;
                }
                const result = await run(
                  () => api(`/api/admin/orders/${props.orderId}/refund`, { body: { amount: n, reason, restock } }),
                  "Refund recorded.",
                );
                if (result === true) setRefundOpen(false);
                else setRefundErrors({ amount: fieldError(result, "amount"), reason: fieldError(result, "reason") });
              }}
            >
              {busy && <Loader2 className="animate-spin" />} Refund {amount ? formatMoney(amount || 0, props.currency) : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

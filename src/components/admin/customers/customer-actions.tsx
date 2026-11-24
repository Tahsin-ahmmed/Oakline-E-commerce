"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, CheckCircle2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAdmin } from "@/components/admin/admin-context";
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client";
import { customerUpdateSchema, type CustomerUpdateInput } from "@/lib/validations/admin/sales";
import type { z } from "zod";

export function CustomerActions({
  customer,
}: {
  customer: { id: string; name: string; email: string; phone: string | null; marketingOptIn: boolean; status: "ACTIVE" | "BLOCKED" };
}) {
  const router = useRouter();
  const { can } = useAdmin();
  const [open, setOpen] = useState(false);
  const form = useForm<z.input<typeof customerUpdateSchema>, unknown, CustomerUpdateInput>({
    resolver: zodResolver(customerUpdateSchema),
    defaultValues: { name: customer.name, email: customer.email, phone: customer.phone ?? "", marketingOptIn: customer.marketingOptIn },
  });
  if (!can("customers.manage")) return null;
  const blocked = customer.status === "BLOCKED";

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await api(`/api/admin/customers/${customer.id}`, { method: "PATCH", body: values });
      toast.success("Customer updated.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      if (!applyFieldErrors(e, form.setError as never)) toast.error(errorMessage(e));
    }
  });
  const errors = form.formState.errors;

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil /> Edit
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant={blocked ? "outline" : "destructive"}>
            {blocked ? <CheckCircle2 /> : <Ban />} {blocked ? "Unblock" : "Block"}
          </Button>
        }
        title={blocked ? `Unblock ${customer.name}?` : `Block ${customer.name}?`}
        description={
          blocked
            ? "They will be able to sign in and place orders again."
            : "They will be signed out everywhere immediately and won't be able to sign in. Existing orders are unaffected."
        }
        confirmLabel={blocked ? "Unblock" : "Block customer"}
        destructive={!blocked}
        onConfirm={async () => {
          try {
            await api(`/api/admin/customers/${customer.id}/status`, { body: { status: blocked ? "ACTIVE" : "BLOCKED" } });
            toast.success(blocked ? "Customer unblocked." : "Customer blocked and signed out.");
            router.refresh();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
      <Dialog open={open} onOpenChange={(o) => !form.formState.isSubmitting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
            <DialogDescription>Changing the email requires the customer to verify it again.</DialogDescription>
          </DialogHeader>
          <form id="customer-form" onSubmit={onSubmit} className="grid gap-4">
            <Field label="Full name" htmlFor="c-name" error={errors.name?.message} required>
              <Input id="c-name" {...form.register("name")} />
            </Field>
            <Field label="Email" htmlFor="c-email" error={errors.email?.message} required>
              <Input id="c-email" type="email" {...form.register("email")} />
            </Field>
            <Field label="Phone" htmlFor="c-phone" error={errors.phone?.message}>
              <Input id="c-phone" {...form.register("phone")} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Controller
                control={form.control}
                name="marketingOptIn"
                render={({ field }) => <Checkbox checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(v === true)} />}
              />
              Receives marketing emails
            </label>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={form.formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="customer-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

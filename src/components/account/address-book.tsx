"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { AddressFields, formatAddressLines, type SavedAddress } from "@/components/account/address-fields";
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client";
import { addressSchema } from "@/lib/validations/common";

type AddrIn = z.input<typeof addressSchema>;
const KEY = ["account-addresses"];
const EMPTY: AddrIn = { label: "", fullName: "", phone: "", line1: "", line2: "", area: "", division: "", district: "", postalCode: "", isDefault: false };

function toForm(a: SavedAddress): AddrIn {
  return {
    label: a.label ?? "",
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? "",
    area: a.area ?? "",
    division: a.division,
    district: a.district,
    postalCode: a.postalCode ?? "",
    isDefault: a.isDefault,
  };
}

function AddressDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: SavedAddress | null }) {
  const qc = useQueryClient();
  const form = useForm<AddrIn>({ resolver: zodResolver(addressSchema), values: editing ? toForm(editing) : EMPTY });
  const save = form.handleSubmit(async (values) => {
    try {
      await api(editing ? `/api/account/addresses/${editing.id}` : "/api/account/addresses", {
        method: editing ? "PATCH" : "POST",
        body: values,
      });
      await qc.invalidateQueries({ queryKey: KEY });
      toast.success(editing ? "Address updated" : "Address saved");
      onOpenChange(false);
    } catch (e) {
      if (!applyFieldErrors(e, form.setError)) toast.error(errorMessage(e));
    }
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !form.formState.isSubmitting && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit address" : "Add a new address"}</DialogTitle>
          <DialogDescription>Used for faster checkout. You can save up to 10 addresses.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} noValidate className="space-y-5">
          <AddressFields form={form} idPrefix="book" showLabel />
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={Boolean(form.watch("isDefault"))} onCheckedChange={(v) => form.setValue("isDefault", v === true)} />
            Make this my default address
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Save address
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddressBook() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: KEY, queryFn: () => api<SavedAddress[]>("/api/account/addresses") });
  const [dialog, setDialog] = useState<{ open: boolean; editing: SavedAddress | null }>({ open: false, editing: null });
  const makeDefault = useMutation({
    mutationFn: (a: SavedAddress) => api(`/api/account/addresses/${a.id}`, { method: "PATCH", body: { ...toForm(a), isDefault: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success("Default address updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const add = (
    <Button onClick={() => setDialog({ open: true, editing: null })} disabled={(data?.length ?? 0) >= 10}>
      <Plus /> Add address
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-2xl">Saved addresses</h2>
        {data && data.length > 0 && add}
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : isError ? (
        <EmptyState title="Couldn't load your addresses" action={<Button onClick={() => refetch()}>Try again</Button>} />
      ) : !data?.length ? (
        <EmptyState icon={MapPin} title="No saved addresses" description="Save an address for faster checkout." action={add} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.map((a) => (
            <li key={a.id} className="flex flex-col rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <p className="font-medium">{a.label || a.fullName}</p>
                {a.isDefault && <span className="rounded bg-secondary px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">Default</span>}
              </div>
              <div className="mt-2 flex-1 text-sm text-muted-foreground">
                <p className="text-foreground">{a.fullName}</p>
                {formatAddressLines(a).map((l) => (
                  <p key={l}>{l}</p>
                ))}
                <p>{a.phone}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, editing: a })}>
                  <Pencil /> Edit
                </Button>
                {!a.isDefault && (
                  <Button size="sm" variant="ghost" onClick={() => makeDefault.mutate(a)} disabled={makeDefault.isPending}>
                    <Star /> Set default
                  </Button>
                )}
                <ConfirmDialog
                  trigger={
                    <Button size="sm" variant="ghost" className="ml-auto text-destructive">
                      <Trash2 /> Delete
                    </Button>
                  }
                  title="Delete this address?"
                  description="This address will be removed from your account."
                  confirmLabel="Delete"
                  destructive
                  onConfirm={async () => {
                    try {
                      await api(`/api/account/addresses/${a.id}`, { method: "DELETE" });
                      await qc.invalidateQueries({ queryKey: KEY });
                      toast.success("Address deleted");
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <AddressDialog open={dialog.open} editing={dialog.editing} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/form-field";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { couponSchema } from "@/lib/validations/admin/sales";
import type { AdminCouponRow } from "@/services/admin/coupons";

type Option = { id: string; name: string };
interface Options {
  categories: Option[];
  products: { id: string; name: string; sku: string }[];
}

interface FormState {
  code: string;
  description: string;
  type: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  value: string;
  minPurchase: string;
  maxDiscount: string;
  startsAt: string;
  expiresAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  isActive: boolean;
  categories: Option[];
  products: Option[];
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function initialState(c?: AdminCouponRow | null): FormState {
  return {
    code: c?.code ?? "",
    description: c?.description ?? "",
    type: c?.type ?? "PERCENTAGE",
    value: c ? String(Number(c.value)) : "10",
    minPurchase: c?.minPurchase ? String(Number(c.minPurchase)) : "",
    maxDiscount: c?.maxDiscount ? String(Number(c.maxDiscount)) : "",
    startsAt: toLocalInput(c?.startsAt ?? null),
    expiresAt: toLocalInput(c?.expiresAt ?? null),
    usageLimit: c?.usageLimit ? String(c.usageLimit) : "",
    perCustomerLimit: c?.perCustomerLimit ? String(c.perCustomerLimit) : "",
    isActive: c?.isActive ?? true,
    categories: c?.categories ?? [],
    products: c?.products ?? [],
  };
}

function Chips({ items, onRemove }: { items: Option[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
          {i.name}
          <button type="button" onClick={() => onRemove(i.id)} aria-label={`Remove ${i.name}`} className="text-muted-foreground hover:text-foreground">
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function CouponFormDialog({
  open,
  onOpenChange,
  coupon,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  coupon?: AdminCouponRow | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(coupon));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(productQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [productQuery]);

  const { data: options } = useQuery({
    queryKey: ["coupon-options", debouncedQ],
    queryFn: () => api<Options>(`/api/admin/coupons/options${debouncedQ ? `?q=${encodeURIComponent(debouncedQ)}` : ""}`),
    enabled: open,
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: form.code,
      description: form.description,
      type: form.type,
      value: form.type === "FREE_SHIPPING" ? 0 : form.value,
      minPurchase: form.minPurchase,
      maxDiscount: form.type === "PERCENTAGE" ? form.maxDiscount : "",
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : "",
      usageLimit: form.usageLimit,
      perCustomerLimit: form.perCustomerLimit,
      isActive: form.isActive,
      categoryIds: form.categories.map((c) => c.id),
      productIds: form.products.map((p) => p.id),
    };
    const parsed = couponSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await api(coupon ? `/api/admin/coupons/${coupon.id}` : "/api/admin/coupons", { method: coupon ? "PUT" : "POST", body: payload });
      toast.success(coupon ? "Coupon updated." : "Coupon created.");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        const errs: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.details)) errs[k] = Array.isArray(v) ? String(v[0]) : String(v);
        setErrors(errs);
      }
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const availableCategories = (options?.categories ?? []).filter((c) => !form.categories.some((x) => x.id === c.id));
  const productResults = (options?.products ?? []).filter((p) => !form.products.some((x) => x.id === p.id));

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{coupon ? `Edit ${coupon.code}` : "New coupon"}</DialogTitle>
          <DialogDescription>All rules are enforced on the server at checkout.</DialogDescription>
        </DialogHeader>
        <form id="coupon-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="cp-code" error={errors.code} required>
            <Input id="cp-code" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="SUMMER15" maxLength={40} />
          </Field>
          <Field label="Type" htmlFor="cp-type" required>
            <Select value={form.type} onValueChange={(v) => set("type", v as FormState["type"])}>
              <SelectTrigger id="cp-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENTAGE">Percentage off</SelectItem>
                <SelectItem value="FIXED">Fixed amount off</SelectItem>
                <SelectItem value="FREE_SHIPPING">Free shipping</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description" htmlFor="cp-desc" className="sm:col-span-2" error={errors.description}>
            <Textarea id="cp-desc" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={200} />
          </Field>
          {form.type !== "FREE_SHIPPING" && (
            <Field label={form.type === "PERCENTAGE" ? "Percent off" : "Amount off"} htmlFor="cp-value" error={errors.value} required>
              <Input id="cp-value" type="number" min="0" step="0.01" value={form.value} onChange={(e) => set("value", e.target.value)} />
            </Field>
          )}
          {form.type === "PERCENTAGE" && (
            <Field label="Maximum discount" htmlFor="cp-max" error={errors.maxDiscount} hint="Optional cap">
              <Input id="cp-max" type="number" min="0" step="0.01" value={form.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} />
            </Field>
          )}
          <Field label="Minimum purchase" htmlFor="cp-min" error={errors.minPurchase} hint="Of eligible items">
            <Input id="cp-min" type="number" min="0" step="0.01" value={form.minPurchase} onChange={(e) => set("minPurchase", e.target.value)} />
          </Field>
          <Field label="Starts" htmlFor="cp-start" error={errors.startsAt}>
            <Input id="cp-start" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          </Field>
          <Field label="Expires" htmlFor="cp-end" error={errors.expiresAt}>
            <Input id="cp-end" type="datetime-local" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
          </Field>
          <Field label="Total usage limit" htmlFor="cp-limit" error={errors.usageLimit} hint="Blank = unlimited">
            <Input id="cp-limit" type="number" min="1" step="1" value={form.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} />
          </Field>
          <Field label="Per-customer limit" htmlFor="cp-pcl" error={errors.perCustomerLimit} hint="Blank = unlimited">
            <Input id="cp-pcl" type="number" min="1" step="1" value={form.perCustomerLimit} onChange={(e) => set("perCustomerLimit", e.target.value)} />
          </Field>

          <div className="grid gap-2 sm:col-span-2">
            <p className="text-[0.82rem] font-medium text-foreground/80">Applies to categories</p>
            <Chips items={form.categories} onRemove={(id) => set("categories", form.categories.filter((c) => c.id !== id))} />
            <Select
              value=""
              onValueChange={(id) => {
                const c = options?.categories.find((x) => x.id === id);
                if (c) set("categories", [...form.categories, c]);
              }}
            >
              <SelectTrigger className="w-full" aria-label="Add category">
                <SelectValue placeholder="Add a category…" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <p className="text-[0.82rem] font-medium text-foreground/80">Applies to products</p>
            <Chips items={form.products} onRemove={(id) => set("products", form.products.filter((p) => p.id !== id))} />
            <Input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Search products by name or SKU…" aria-label="Search products" />
            {productQuery.trim() && (
              <ul className="max-h-40 overflow-y-auto rounded-md border text-sm">
                {productResults.length === 0 && <li className="px-3 py-2 text-muted-foreground">No matches</li>}
                {productResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-secondary"
                      onClick={() => {
                        set("products", [...form.products, { id: p.id, name: p.name }]);
                        setProductQuery("");
                      }}
                    >
                      {p.name} <span className="text-xs text-muted-foreground">· {p.sku}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">Leave categories and products empty to apply the coupon to the whole cart.</p>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} /> Active
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="coupon-form" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {coupon ? "Save changes" : "Create coupon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Layers, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ActiveBadge, ToneBadge } from "@/components/shared/status-badge";
import { ImageInput } from "@/components/admin/image-input";
import { api } from "@/lib/api-client";
import { collectionSchema, type CollectionInput } from "@/lib/validations/admin/content";
import { MoveButtons, useAdminAction, useFormSubmit } from "@/components/admin/content/shared";

export interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  _count: { products: number };
}

interface PickerProduct {
  id: string;
  name: string;
  sku: string;
  image: string | null;
  status?: string;
}

function ProductPicker({ value, onChange }: { value: PickerProduct[]; onChange: (v: PickerProduct[]) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data = [], isFetching } = useQuery({
    queryKey: ["content-product-search", debounced],
    queryFn: () => api<PickerProduct[]>(`/api/admin/content/products?q=${encodeURIComponent(debounced)}`),
  });
  const selected = new Set(value.map((p) => p.id));
  return (
    <div className="grid gap-3">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-full border bg-secondary/50 py-1 pr-1 pl-1">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <span className="size-6 rounded-full bg-muted" />
              )}
              <span className="max-w-44 truncate text-xs">{p.name}</span>
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== p.id))} className="rounded-full p-1 hover:bg-background" aria-label={`Remove ${p.name}`}>
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No products yet — search below to add some.</p>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products by name or SKU" className="pl-9" aria-label="Search products" />
        {isFetching && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
        {data.length === 0 && <li className="p-3 text-center text-xs text-muted-foreground">No products found.</li>}
        {data.map((p) => {
          const on = selected.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange(on ? value.filter((x) => x.id !== p.id) : [...value, p])}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary/60"
                aria-pressed={on}
              >
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="size-8 rounded object-cover" />
                ) : (
                  <span className="size-8 rounded bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.sku}
                    {p.status && p.status !== "ACTIVE" ? ` · ${p.status.toLowerCase()}` : ""}
                  </span>
                </span>
                <span className={on ? "text-xs font-medium text-success" : "text-xs text-muted-foreground"}>{on ? "Added" : "Add"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type FormValues = Omit<CollectionInput, "productIds">;

function CollectionDialog({ collection, nextSort, onClose }: { collection: CollectionRow | null; nextSort: number; onClose: () => void }) {
  const submit = useFormSubmit();
  const [edited, setProducts] = useState<PickerProduct[] | null>(null);
  const detail = useQuery({
    queryKey: ["admin-collection", collection?.id],
    queryFn: () => api<{ products: PickerProduct[] }>(`/api/admin/content/collections/${collection!.id}`),
    enabled: Boolean(collection),
    gcTime: 0,
  });
  // Until the admin changes the selection, show the collection's saved products.
  const products = edited ?? detail.data?.products ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(collectionSchema.omit({ productIds: true })),
    defaultValues: {
      name: collection?.name ?? "",
      slug: collection?.slug ?? "",
      description: collection?.description ?? "",
      imageUrl: collection?.imageUrl ?? "",
      isFeatured: collection?.isFeatured ?? true,
      isActive: collection?.isActive ?? true,
      sortOrder: collection?.sortOrder ?? nextSort,
    },
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    const body = { ...values, productIds: products.map((p) => p.id) };
    const ok = await submit(
      () => (collection ? api(`/api/admin/content/collections/${collection.id}`, { method: "PUT", body }) : api("/api/admin/content/collections", { body })),
      collection ? "Collection updated" : "Collection created",
      setError,
    );
    if (ok) onClose();
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{collection ? "Edit collection" : "New collection"}</DialogTitle>
          <DialogDescription>Curated product edits shown on the homepage and at /collections/[slug].</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="c-name" error={errors.name?.message} required>
              <Input id="c-name" {...register("name")} />
            </Field>
            <Field label="Slug" htmlFor="c-slug" error={errors.slug?.message} hint="Leave blank to generate from the name">
              <Input id="c-slug" {...register("slug")} placeholder="the-slow-morning" />
            </Field>
          </div>
          <Field label="Description" htmlFor="c-desc" error={errors.description?.message}>
            <Textarea id="c-desc" rows={2} {...register("description")} />
          </Field>
          <Field label="Cover image" error={errors.imageUrl?.message}>
            <Controller control={control} name="imageUrl" render={({ field }) => <ImageInput value={field.value} onChange={field.onChange} folder="collections" aspect="aspect-[16/9]" />} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Display order" htmlFor="c-sort" error={errors.sortOrder?.message}>
              <Input id="c-sort" type="number" min={0} {...register("sortOrder", { valueAsNumber: true })} />
            </Field>
            <label className="flex items-center gap-3 self-end pb-2 text-sm">
              <Controller control={control} name="isFeatured" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              Featured on homepage
            </label>
            <label className="flex items-center gap-3 self-end pb-2 text-sm">
              <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              Active
            </label>
          </div>
          <Field label={`Products (${products.length})`}>
            {collection && detail.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading products…
              </p>
            ) : (
              <ProductPicker value={products} onChange={setProducts} />
            )}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting || (Boolean(collection) && detail.isLoading)}>
              {formState.isSubmitting && <Loader2 className="animate-spin" />}
              {collection ? "Save changes" : "Create collection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionsManager({ collections }: { collections: CollectionRow[] }) {
  const [dialog, setDialog] = useState<{ collection: CollectionRow | null } | null>(null);
  const { run } = useAdminAction();
  const ids = collections.map((c) => c.id);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ collection: null })}>
          <Plus /> New collection
        </Button>
      </div>
      {collections.length === 0 ? (
        <EmptyState icon={Layers} title="No collections yet" description="Group products into curated edits like “Gifts under ৳3,000”." />
      ) : (
        <ul className="divide-y rounded-lg border">
          {collections.map((c, i) => (
            <li key={c.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="aspect-[16/9] w-full rounded-md object-cover sm:w-32" />
              ) : (
                <div className="aspect-[16/9] w-full rounded-md bg-muted sm:w-32" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  /collections/{c.slug} · {c._count.products} products
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  <ActiveBadge active={c.isActive} />
                  {c.isFeatured && <ToneBadge tone="info">Featured</ToneBadge>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <MoveButtons entity="collection" ids={ids} index={i} label={c.name} />
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => setDialog({ collection: c })}>
                  <Pencil />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  }
                  title="Delete this collection?"
                  description={`“${c.name}” will be removed. Products themselves are not affected.`}
                  confirmLabel="Delete"
                  destructive
                  onConfirm={() => run(() => api(`/api/admin/content/collections/${c.id}`, { method: "DELETE" }), "Collection deleted")}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {dialog && <CollectionDialog key={dialog.collection?.id ?? "new"} collection={dialog.collection} nextSort={collections.length} onClose={() => setDialog(null)} />}
    </div>
  );
}

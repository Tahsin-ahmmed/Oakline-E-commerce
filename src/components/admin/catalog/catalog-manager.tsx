"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Boxes, ListTree, Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/form-field";
import { ActiveBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ImageInput } from "@/components/admin/image-input";
import { ControlledConfirm } from "@/components/admin/catalog/products-table";
import { ApiClientError, api, errorMessage } from "@/lib/api-client";
import { slugify } from "@/lib/slug";
import { attributeSchema, brandSchema } from "@/lib/validations/admin/catalog";
import type { AttributeRow, BrandRow } from "@/services/admin/categories";

function applyErrors(e: unknown, setError: (k: never, v: { message: string }) => void) {
  if (e instanceof ApiClientError && e.details) {
    for (const [k, m] of Object.entries(e.details)) {
      if (Array.isArray(m) && typeof m[0] === "string") setError(k as never, { message: m[0] });
    }
  }
}

export function CatalogManager({ brands, attributes }: { brands: BrandRow[]; attributes: AttributeRow[] }) {
  return (
    <Tabs defaultValue="brands">
      <TabsList className="mb-4">
        <TabsTrigger value="brands">
          <Tag /> Brands ({brands.length})
        </TabsTrigger>
        <TabsTrigger value="attributes">
          <ListTree /> Specifications ({attributes.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="brands">
        <BrandsPanel brands={brands} />
      </TabsContent>
      <TabsContent value="attributes">
        <AttributesPanel attributes={attributes} />
      </TabsContent>
    </Tabs>
  );
}

// ───────────── Brands ─────────────

function BrandsPanel({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BrandRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<BrandRow | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus /> Add brand
        </Button>
      </div>
      {brands.length === 0 ? (
        <EmptyState icon={Boxes} title="No brands yet" description="Brands help customers filter and trust your catalog." />
      ) : (
        <div className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Brand</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center overflow-hidden rounded-md border bg-muted text-xs font-semibold">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {b.logoUrl ? <img src={b.logoUrl} alt="" className="size-full object-contain" /> : b.name.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">/{b.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-sm truncate text-sm text-muted-foreground md:table-cell">{b.description}</TableCell>
                  <TableCell className="tabular-nums">{b.productCount}</TableCell>
                  <TableCell>
                    <ActiveBadge active={b.isActive} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(b)} aria-label={`Edit ${b.name}`}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(b)} aria-label={`Delete ${b.name}`}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && (
        <BrandDialog
          brand={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      <ControlledConfirm
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete brand “${deleting?.name ?? ""}”?`}
        description={
          deleting?.productCount
            ? `${deleting.productCount} product(s) use this brand. They will be kept, without a brand.`
            : "This cannot be undone."
        }
        destructive
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api(`/api/admin/brands/${deleting.id}`, { method: "DELETE" });
            toast.success("Brand deleted");
            router.refresh();
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      />
    </>
  );
}

interface BrandForm {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  isActive: boolean;
}

function BrandDialog({ brand, onClose, onSaved }: { brand: BrandRow | null; onClose: () => void; onSaved: () => void }) {
  const [slugTouched, setSlugTouched] = useState(Boolean(brand));
  const { register, control, handleSubmit, setValue, setError, formState } = useForm<BrandForm>({
    defaultValues: {
      name: brand?.name ?? "",
      slug: brand?.slug ?? "",
      description: brand?.description ?? "",
      logoUrl: brand?.logoUrl ?? "",
      isActive: brand?.isActive ?? true,
    },
  });
  const { errors, isSubmitting } = formState;
  const submit = handleSubmit(async (v) => {
    const parsed = brandSchema.safeParse({ ...v, description: v.description || null, logoUrl: v.logoUrl || null });
    if (!parsed.success) {
      for (const i of parsed.error.issues) setError(i.path.join(".") as keyof BrandForm, { message: i.message });
      return;
    }
    try {
      if (brand) await api(`/api/admin/brands/${brand.id}`, { method: "PUT", body: parsed.data });
      else await api("/api/admin/brands", { body: parsed.data });
      toast.success(brand ? "Brand updated" : "Brand created");
      onSaved();
    } catch (e) {
      applyErrors(e, setError as never);
      toast.error(errorMessage(e));
    }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{brand ? `Edit ${brand.name}` : "New brand"}</DialogTitle>
          <DialogDescription>Shown on product pages and in listing filters.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="b-name" error={errors.name?.message} required>
              <Input id="b-name" {...register("name", { onChange: (e) => !slugTouched && setValue("slug", slugify(e.target.value)) })} />
            </Field>
            <Field label="Slug" htmlFor="b-slug" error={errors.slug?.message} required>
              <Input id="b-slug" {...register("slug", { onChange: () => setSlugTouched(true) })} />
            </Field>
          </div>
          <Field label="Description" htmlFor="b-desc" error={errors.description?.message}>
            <Textarea id="b-desc" rows={2} {...register("description")} />
          </Field>
          <Controller
            control={control}
            name="logoUrl"
            render={({ field }) => (
              <Field label="Logo" error={errors.logoUrl?.message}>
                <ImageInput value={field.value} onChange={field.onChange} folder="brands" aspect="aspect-[3/1]" />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} /> Active (shown in filters)
              </label>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {brand ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── Attributes ─────────────

function AttributesPanel({ attributes }: { attributes: AttributeRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AttributeRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<AttributeRow | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus /> Add specification
        </Button>
      </div>
      {attributes.length === 0 ? (
        <EmptyState icon={ListTree} title="No specifications yet" description="Create attributes like Material, Care or Origin." />
      ) : (
        <div className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Used by</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {attributes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="pl-4 font-medium">{a.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.slug}</TableCell>
                  <TableCell className="tabular-nums">{a.sortOrder}</TableCell>
                  <TableCell className="text-sm">{a.valueCount} product(s)</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(a)} aria-label={`Delete ${a.name}`}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing && (
        <AttributeDialog
          attribute={editing === "new" ? null : editing}
          nextOrder={attributes.length}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      <ControlledConfirm
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description={
          deleting?.valueCount
            ? `This specification is set on ${deleting.valueCount} product(s). Those values will be removed from the products.`
            : "No products use this specification."
        }
        destructive
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api(`/api/admin/attributes/${deleting.id}`, { method: "DELETE" });
            toast.success("Specification deleted");
            router.refresh();
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      />
    </>
  );
}

interface AttributeForm {
  name: string;
  slug: string;
  sortOrder: string;
}

function AttributeDialog({
  attribute,
  nextOrder,
  onClose,
  onSaved,
}: {
  attribute: AttributeRow | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [slugTouched, setSlugTouched] = useState(Boolean(attribute));
  const { register, handleSubmit, setValue, setError, formState } = useForm<AttributeForm>({
    defaultValues: { name: attribute?.name ?? "", slug: attribute?.slug ?? "", sortOrder: String(attribute?.sortOrder ?? nextOrder) },
  });
  const { errors, isSubmitting } = formState;
  const submit = handleSubmit(async (v) => {
    const parsed = attributeSchema.safeParse({ ...v, sortOrder: Number(v.sortOrder || 0) });
    if (!parsed.success) {
      for (const i of parsed.error.issues) setError(i.path.join(".") as keyof AttributeForm, { message: i.message });
      return;
    }
    try {
      if (attribute) await api(`/api/admin/attributes/${attribute.id}`, { method: "PUT", body: parsed.data });
      else await api("/api/admin/attributes", { body: parsed.data });
      toast.success(attribute ? "Specification updated" : "Specification created");
      onSaved();
    } catch (e) {
      applyErrors(e, setError as never);
      toast.error(errorMessage(e));
    }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{attribute ? `Edit ${attribute.name}` : "New specification"}</DialogTitle>
          <DialogDescription>Appears as a row in product specification tables.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Name" htmlFor="a-name" error={errors.name?.message} required>
            <Input id="a-name" {...register("name", { onChange: (e) => !slugTouched && setValue("slug", slugify(e.target.value)) })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Slug" htmlFor="a-slug" error={errors.slug?.message} required>
              <Input id="a-slug" {...register("slug", { onChange: () => setSlugTouched(true) })} />
            </Field>
            <Field label="Display order" htmlFor="a-order" error={errors.sortOrder?.message}>
              <Input id="a-order" type="number" min="0" {...register("sortOrder")} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {attribute ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

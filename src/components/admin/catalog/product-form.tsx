"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, type Path } from "react-hook-form";
import { ArrowLeft, Eye, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/shared/form-field";
import { Panel } from "@/components/admin/page-header";
import { ImageListInput, type GalleryImage } from "@/components/admin/image-input";
import { useAdmin } from "@/components/admin/admin-context";
import { ApiClientError, api, errorMessage } from "@/lib/api-client";
import { slugify } from "@/lib/slug";
import { formatMoney } from "@/lib/money";
import { productSchema, type ProductInput } from "@/lib/validations/admin/catalog";
import type { ProductFormOptions } from "@/services/admin/products";

interface VariantRow {
  id?: string;
  sku: string;
  color: string;
  colorHex: string;
  size: string;
  price: string;
  salePrice: string;
  stock: string;
  lowStockThreshold: string;
  isActive: boolean;
  imageUrl: string;
}

interface FormValues {
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  extraCategoryIds: string[];
  brandId: string;
  shortDescription: string;
  description: string;
  price: string;
  salePrice: string;
  costPrice: string;
  weightGrams: string;
  dimensions: string;
  tags: string;
  isFeatured: boolean;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  seoTitle: string;
  seoDescription: string;
  images: GalleryImage[];
  attributes: { attributeId: string; value: string }[];
  hasVariants: boolean;
  simpleStock: string;
  simpleThreshold: string;
  variants: VariantRow[];
}

const s = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const n = (v: string) => (v.trim() === "" ? null : Number(v));

function toForm(input: ProductInput | null): FormValues {
  if (!input) {
    return {
      name: "",
      slug: "",
      sku: "",
      categoryId: "",
      extraCategoryIds: [],
      brandId: "",
      shortDescription: "",
      description: "",
      price: "",
      salePrice: "",
      costPrice: "",
      weightGrams: "",
      dimensions: "",
      tags: "",
      isFeatured: false,
      status: "DRAFT",
      seoTitle: "",
      seoDescription: "",
      images: [],
      attributes: [],
      hasVariants: false,
      simpleStock: "0",
      simpleThreshold: "5",
      variants: [],
    };
  }
  const variantRows: VariantRow[] = input.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    color: v.color ?? "",
    colorHex: v.colorHex ?? "",
    size: v.size ?? "",
    price: s(v.price),
    salePrice: s(v.salePrice),
    stock: String(v.stock),
    lowStockThreshold: String(v.lowStockThreshold),
    isActive: v.isActive,
    imageUrl: v.imageUrl ?? "",
  }));
  return {
    name: input.name,
    slug: input.slug,
    sku: input.sku,
    categoryId: input.categoryId,
    extraCategoryIds: input.extraCategoryIds,
    brandId: input.brandId ?? "",
    shortDescription: input.shortDescription ?? "",
    description: input.description,
    price: String(input.price),
    salePrice: s(input.salePrice),
    costPrice: s(input.costPrice),
    weightGrams: s(input.weightGrams),
    dimensions: input.dimensions ?? "",
    tags: input.tags.join(", "),
    isFeatured: input.isFeatured,
    status: input.status,
    seoTitle: input.seoTitle ?? "",
    seoDescription: input.seoDescription ?? "",
    images: input.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
    attributes: input.attributes,
    hasVariants: input.hasVariants,
    simpleStock: input.hasVariants ? "0" : String(input.variants[0]?.stock ?? 0),
    simpleThreshold: input.hasVariants ? "5" : String(input.variants[0]?.lowStockThreshold ?? 5),
    variants: input.hasVariants ? variantRows : [],
  };
}

function toPayload(v: FormValues, existing: ProductInput | null): ProductInput {
  const simpleId = existing && !existing.hasVariants ? existing.variants[0]?.id : undefined;
  return {
    name: v.name,
    slug: v.slug,
    sku: v.sku,
    categoryId: v.categoryId,
    extraCategoryIds: v.extraCategoryIds,
    brandId: v.brandId || null,
    shortDescription: v.shortDescription || null,
    description: v.description,
    price: v.price.trim() === "" ? Number.NaN : Number(v.price),
    salePrice: n(v.salePrice),
    costPrice: n(v.costPrice),
    weightGrams: n(v.weightGrams),
    dimensions: v.dimensions || null,
    tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
    isFeatured: v.isFeatured,
    status: v.status,
    seoTitle: v.seoTitle || null,
    seoDescription: v.seoDescription || null,
    images: v.images.map((i) => ({ url: i.url, alt: i.alt || null })),
    attributes: v.attributes.filter((a) => a.attributeId),
    hasVariants: v.hasVariants,
    variants: v.hasVariants
      ? v.variants.map((r) => ({
          id: r.id,
          sku: r.sku.trim().toUpperCase(),
          color: r.color || null,
          colorHex: r.colorHex || null,
          size: r.size || null,
          price: n(r.price),
          salePrice: n(r.salePrice),
          stock: Number(r.stock || 0),
          lowStockThreshold: Number(r.lowStockThreshold || 0),
          isActive: r.isActive,
          imageUrl: r.imageUrl || null,
        }))
      : [
          {
            id: simpleId,
            sku: v.sku.trim().toUpperCase(),
            color: null,
            colorHex: null,
            size: null,
            price: null,
            salePrice: null,
            stock: Number(v.simpleStock || 0),
            lowStockThreshold: Number(v.simpleThreshold || 0),
            isActive: true,
            imageUrl: null,
          },
        ],
  };
}

/** Map a schema/API error path onto a form field name. */
function fieldFor(path: string, hasVariants: boolean): string {
  if (!hasVariants && path.startsWith("variants.0.")) {
    const f = path.split(".")[2];
    if (f === "stock") return "simpleStock";
    if (f === "lowStockThreshold") return "simpleThreshold";
    if (f === "sku") return "sku";
  }
  return path;
}

export function ProductForm({
  productId,
  initial,
  options,
  storeSlug,
}: {
  productId?: string;
  initial: ProductInput | null;
  options: ProductFormOptions;
  storeSlug?: string;
}) {
  const router = useRouter();
  const { can, currency } = useAdmin();
  const canManage = can("products.manage");
  const [attributes, setAttributes] = useState(options.attributes);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [preview, setPreview] = useState(false);
  const form = useForm<FormValues>({ defaultValues: toForm(initial) });
  const { register, control, handleSubmit, watch, setValue, setError, formState } = form;
  const { errors, isSubmitting, isDirty } = formState;
  const variants = useFieldArray({ control, name: "variants" });
  const attrs = useFieldArray({ control, name: "attributes" });

  const hasVariants = watch("hasVariants");
  const images = watch("images");
  const sku = watch("sku");
  const price = watch("price");
  const salePrice = watch("salePrice");
  const costPrice = watch("costPrice");
  const description = watch("description");

  const categoryNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of options.categories) {
      m.set(c.id, c.name);
      for (const ch of c.children) m.set(ch.id, `${c.name} › ${ch.name}`);
    }
    return m;
  }, [options.categories]);

  const err = (name: string) => {
    const parts = name.split(".");
    let cur: unknown = errors;
    for (const p of parts) cur = (cur as Record<string, unknown> | undefined)?.[p];
    return (cur as { message?: string } | undefined)?.message;
  };

  const margin = (() => {
    const sell = Number(salePrice || price);
    const cost = Number(costPrice);
    if (!sell || !cost) return null;
    return Math.round(((sell - cost) / sell) * 100);
  })();

  const onSubmit = handleSubmit(async (values) => {
    const payload = toPayload(values, initial);
    const parsed = productSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = fieldFor(issue.path.join("."), values.hasVariants);
        setError(path as Path<FormValues>, { type: "zod", message: issue.message });
      }
      toast.error("Please fix the highlighted fields.");
      return;
    }
    try {
      if (productId) {
        await api(`/api/admin/products/${productId}`, { method: "PATCH", body: parsed.data });
        toast.success("Product saved");
        form.reset(values);
        router.refresh();
      } else {
        const res = await api<{ id: string }>("/api/admin/products", { body: parsed.data });
        toast.success("Product created");
        router.push(`/admin/products/${res.id}`);
        router.refresh();
      }
    } catch (e) {
      if (e instanceof ApiClientError && e.details) {
        for (const [k, msgs] of Object.entries(e.details)) {
          const msg = Array.isArray(msgs) ? msgs[0] : msgs;
          if (typeof msg === "string") setError(fieldFor(k, values.hasVariants) as Path<FormValues>, { type: "server", message: msg });
        }
      }
      toast.error(errorMessage(e));
    }
  });

  const suggestSku = (i: number) => {
    const row = form.getValues(`variants.${i}`);
    const parts = [sku || "SKU", row.color, row.size].filter(Boolean).map((p) => slugify(String(p)).toUpperCase().replace(/-/g, ""));
    setValue(`variants.${i}.sku`, parts.join("-"), { shouldDirty: true });
  };

  const toggleVariants = (on: boolean) => {
    setValue("hasVariants", on, { shouldDirty: true });
    if (on && variants.fields.length === 0) {
      variants.append({
        sku: sku ? `${sku}-1` : "",
        color: "",
        colorHex: "#d8cbb4",
        size: "",
        price: "",
        salePrice: "",
        stock: form.getValues("simpleStock") || "0",
        lowStockThreshold: form.getValues("simpleThreshold") || "5",
        isActive: true,
        imageUrl: "",
      });
    }
  };

  const addAttribute = async (name: string) => {
    try {
      const created = await api<{ id: string; name: string }>("/api/admin/attributes", {
        body: { name, slug: slugify(name), sortOrder: attributes.length },
      });
      setAttributes((a) => [...a, { id: created.id, name: created.name }]);
      attrs.append({ attributeId: created.id, value: "" });
      toast.success(`Specification “${created.name}” created`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="sticky top-16 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button variant="ghost" size="icon-sm" asChild aria-label="Back to products">
          <Link href="/admin/products">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate font-heading text-2xl">{initial ? watch("name") || "Edit product" : "New product"}</h1>
        {storeSlug && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/products/${storeSlug}`} target="_blank">
              <Eye /> View on store
            </Link>
          </Button>
        )}
        {canManage && (
          <Button type="submit" disabled={isSubmitting || (Boolean(initial) && !isDirty)}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {initial ? "Save changes" : "Create product"}
          </Button>
        )}
      </div>

      <fieldset disabled={!canManage} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="General">
            <div className="grid gap-4">
              <Field label="Product name" htmlFor="name" error={err("name")} required>
                <Input
                  id="name"
                  {...register("name", {
                    onChange: (e) => {
                      if (!slugTouched) setValue("slug", slugify(e.target.value), { shouldDirty: true });
                    },
                  })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="URL slug" htmlFor="slug" error={err("slug")} hint={`/products/${watch("slug") || "…"}`} required>
                  <Input id="slug" {...register("slug", { onChange: () => setSlugTouched(true) })} />
                </Field>
                <Field label="SKU" htmlFor="sku" error={err("sku")} hint="Unique stock-keeping code" required>
                  <Input id="sku" className="uppercase" {...register("sku")} />
                </Field>
              </div>
              <Field label="Short description" htmlFor="shortDescription" error={err("shortDescription")} hint="Shown under the product name (max 300 characters).">
                <Textarea id="shortDescription" rows={2} {...register("shortDescription")} />
              </Field>
              <Field
                label={
                  <span className="flex w-full items-center justify-between">
                    Full description
                    <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setPreview((p) => !p)}>
                      {preview ? "Edit" : "Preview"}
                    </button>
                  </span>
                }
                htmlFor="description"
                error={err("description")}
                hint="Plain text (blank lines make paragraphs) or simple HTML — p, h2, h3, ul, li, strong, em, a. Unsafe markup is removed on save."
              >
                {preview ? (
                  <iframe
                    title="Description preview"
                    sandbox=""
                    className="h-72 w-full rounded-md border bg-white"
                    srcDoc={`<style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#2a2622;padding:12px}</style>${
                      /<\/?[a-z][\s\S]*>/i.test(description) ? description : description.split(/\n{2,}/).map((p) => `<p>${p.replace(/</g, "&lt;")}</p>`).join("")
                    }`}
                  />
                ) : (
                  <Textarea id="description" rows={10} className="font-mono text-xs" {...register("description")} />
                )}
              </Field>
            </div>
          </Panel>

          <Panel title="Images" description="The first image is the cover. Drag order with the arrows; add alt text for accessibility.">
            <Controller
              control={control}
              name="images"
              render={({ field }) => <ImageListInput value={field.value} onChange={field.onChange} folder="products" max={12} />}
            />
            {images.length > 0 && (
              <div className="mt-4 grid gap-2">
                {images.map((img, i) => (
                  <div key={`${img.url}-${i}`} className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="size-9 rounded object-cover" />
                    <Input
                      value={img.alt ?? ""}
                      placeholder={`Alt text for image ${i + 1}`}
                      aria-label={`Alt text for image ${i + 1}`}
                      className="h-9"
                      onChange={(e) =>
                        setValue(
                          "images",
                          images.map((x, k) => (k === i ? { ...x, alt: e.target.value } : x)),
                          { shouldDirty: true },
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
            {err("images") && <p className="mt-2 text-xs text-destructive">{err("images")}</p>}
          </Panel>

          <Panel title="Pricing" description={`All prices in ${currency}. Sale price must be lower than the regular price.`}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Regular price" htmlFor="price" error={err("price")} required>
                <Input id="price" type="number" step="0.01" min="0" inputMode="decimal" {...register("price")} />
              </Field>
              <Field label="Sale price" htmlFor="salePrice" error={err("salePrice")} hint="Leave empty for no sale">
                <Input id="salePrice" type="number" step="0.01" min="0" inputMode="decimal" {...register("salePrice")} />
              </Field>
              <Field
                label="Cost price"
                htmlFor="costPrice"
                error={err("costPrice")}
                hint={margin !== null ? `Margin ${margin}% · admin only` : "Admin only — never shown to customers"}
              >
                <Input id="costPrice" type="number" step="0.01" min="0" inputMode="decimal" {...register("costPrice")} />
              </Field>
            </div>
            {salePrice && price && Number(salePrice) < Number(price) && (
              <p className="mt-3 text-xs text-muted-foreground">
                Customers pay {formatMoney(salePrice, currency)} ({Math.round(((Number(price) - Number(salePrice)) / Number(price)) * 100)}% off).
              </p>
            )}
          </Panel>

          <Panel
            title="Inventory & variants"
            actions={
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={hasVariants} onCheckedChange={toggleVariants} aria-label="This product has variants" />
                This product has variants
              </label>
            }
          >
            {!hasVariants ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Stock on hand" htmlFor="simpleStock" error={err("simpleStock")} hint="Changes are recorded in the stock movement log.">
                  <Input id="simpleStock" type="number" min="0" step="1" {...register("simpleStock")} />
                </Field>
                <Field label="Low-stock alert at" htmlFor="simpleThreshold" error={err("simpleThreshold")}>
                  <Input id="simpleThreshold" type="number" min="0" step="1" {...register("simpleThreshold")} />
                </Field>
              </div>
            ) : (
              <div className="space-y-3">
                {err("variants") && <p className="text-xs text-destructive">{err("variants")}</p>}
                <div className="overflow-x-auto">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colour</TableHead>
                        <TableHead>Size / option</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Sale</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Alert at</TableHead>
                        <TableHead>Image</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.fields.map((f, i) => (
                        <TableRow key={f.id} className="align-top">
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                aria-label="Colour swatch"
                                className="size-9 shrink-0 cursor-pointer rounded border bg-card p-0.5"
                                {...register(`variants.${i}.colorHex`)}
                              />
                              <Input className="h-9 w-28" placeholder="e.g. Oat" aria-label="Colour name" {...register(`variants.${i}.color`)} />
                            </div>
                            <ErrorText msg={err(`variants.${i}.color`) ?? err(`variants.${i}.colorHex`)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-9 w-24" placeholder="e.g. M" aria-label="Size" {...register(`variants.${i}.size`)} />
                            <ErrorText msg={err(`variants.${i}.size`)} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input className="h-9 w-40 uppercase" aria-label="Variant SKU" {...register(`variants.${i}.sku`)} />
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => suggestSku(i)} aria-label="Suggest SKU" title="Suggest SKU">
                                <Wand2 />
                              </Button>
                            </div>
                            <ErrorText msg={err(`variants.${i}.sku`)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-9 w-24" type="number" step="0.01" placeholder="Default" aria-label="Variant price" {...register(`variants.${i}.price`)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-9 w-24" type="number" step="0.01" aria-label="Variant sale price" {...register(`variants.${i}.salePrice`)} />
                            <ErrorText msg={err(`variants.${i}.salePrice`)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-9 w-20" type="number" min="0" aria-label="Stock" {...register(`variants.${i}.stock`)} />
                            <ErrorText msg={err(`variants.${i}.stock`)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-9 w-16" type="number" min="0" aria-label="Low-stock threshold" {...register(`variants.${i}.lowStockThreshold`)} />
                          </TableCell>
                          <TableCell>
                            <Controller
                              control={control}
                              name={`variants.${i}.imageUrl`}
                              render={({ field }) => (
                                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                                  <SelectTrigger size="sm" className="h-9 w-24" aria-label="Variant image">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {images.map((img, k) => (
                                      <SelectItem key={img.url} value={img.url}>
                                        Image {k + 1}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Controller
                              control={control}
                              name={`variants.${i}.isActive`}
                              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Variant active" />}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={variants.fields.length === 1}
                              onClick={() => variants.remove(i)}
                              aria-label="Remove variant"
                            >
                              <Trash2 />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    variants.append({
                      sku: sku ? `${sku}-${variants.fields.length + 1}` : "",
                      color: "",
                      colorHex: "#d8cbb4",
                      size: "",
                      price: "",
                      salePrice: "",
                      stock: "0",
                      lowStockThreshold: "5",
                      isActive: true,
                      imageUrl: "",
                    })
                  }
                >
                  <Plus /> Add variant
                </Button>
                <p className="text-xs text-muted-foreground">
                  Leave variant price empty to use the product price. Removing a variant that appears in past orders archives it instead of deleting it.
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Specifications" description="Shown in the product's details table.">
            <div className="space-y-3">
              {attrs.fields.map((f, i) => (
                <div key={f.id} className="flex items-start gap-2">
                  <Controller
                    control={control}
                    name={`attributes.${i}.attributeId`}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-48" aria-label="Specification">
                          <SelectValue placeholder="Specification" />
                        </SelectTrigger>
                        <SelectContent>
                          {attributes.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <div className="flex-1">
                    <Input placeholder="Value" aria-label="Specification value" {...register(`attributes.${i}.value`)} />
                    <ErrorText msg={err(`attributes.${i}.value`) ?? err(`attributes.${i}.attributeId`)} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => attrs.remove(i)} aria-label="Remove specification">
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => attrs.append({ attributeId: attributes[0]?.id ?? "", value: "" })}>
                  <Plus /> Add specification
                </Button>
                <NewAttributeButton onCreate={addAttribute} />
              </div>
            </div>
          </Panel>

          <Panel title="Search engine listing" description="Defaults to the product name and short description when empty.">
            <div className="grid gap-4">
              <Field label="SEO title" htmlFor="seoTitle" error={err("seoTitle")} hint={`${watch("seoTitle").length}/160`}>
                <Input id="seoTitle" {...register("seoTitle")} />
              </Field>
              <Field label="SEO description" htmlFor="seoDescription" error={err("seoDescription")} hint={`${watch("seoDescription").length}/320`}>
                <Textarea id="seoDescription" rows={3} {...register("seoDescription")} />
              </Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Status">
            <div className="grid gap-4">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Field label="Visibility" htmlFor="status" hint="Only Active products appear in the store.">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="isFeatured"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      Featured product
                      <span className="block text-xs text-muted-foreground">Prioritised in listings and homepage</span>
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Featured product" />
                  </label>
                )}
              />
            </div>
          </Panel>

          <Panel title="Organisation">
            <div className="grid gap-4">
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Field label="Primary category" htmlFor="categoryId" error={err("categoryId")} required>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="categoryId" className="w-full">
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.categories.map((c) => [
                          <SelectItem key={c.id} value={c.id} className="font-medium">
                            {c.name}
                          </SelectItem>,
                          ...c.children.map((ch) => (
                            <SelectItem key={ch.id} value={ch.id} className="pl-6">
                              {ch.name}
                            </SelectItem>
                          )),
                        ])}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="extraCategoryIds"
                render={({ field }) => (
                  <Field label="Also show in" hint="Optional additional categories">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-start px-3 py-2 text-left font-normal whitespace-normal">
                          {field.value.length ? field.value.map((id) => categoryNames.get(id)).filter(Boolean).join(", ") : <span className="text-muted-foreground">None</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="max-h-80 w-72 overflow-y-auto p-2">
                        {options.categories.flatMap((c) => [
                          { id: c.id, name: c.name, depth: 0 },
                          ...c.children.map((ch) => ({ id: ch.id, name: ch.name, depth: 1 })),
                        ]).map((c) => (
                          <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-secondary" style={{ paddingLeft: 8 + c.depth * 16 }}>
                            <Checkbox
                              checked={field.value.includes(c.id)}
                              disabled={c.id === watch("categoryId")}
                              onCheckedChange={(v) => field.onChange(v ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))}
                            />
                            {c.name}
                          </label>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="brandId"
                render={({ field }) => (
                  <Field label="Brand" htmlFor="brandId" error={err("brandId")}>
                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                      <SelectTrigger id="brandId" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No brand</SelectItem>
                        {options.brands.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Field label="Tags" htmlFor="tags" error={err("tags")} hint="Comma separated, used in search">
                <Input id="tags" placeholder="leather, gift, summer" {...register("tags")} />
              </Field>
            </div>
          </Panel>

          <Panel title="Shipping details">
            <div className="grid gap-4">
              <Field label="Weight (grams)" htmlFor="weightGrams" error={err("weightGrams")}>
                <Input id="weightGrams" type="number" min="0" step="1" {...register("weightGrams")} />
              </Field>
              <Field label="Dimensions" htmlFor="dimensions" error={err("dimensions")} hint="e.g. 30 × 50 cm">
                <Input id="dimensions" {...register("dimensions")} />
              </Field>
            </div>
          </Panel>
        </div>
      </fieldset>
    </form>
  );
}

function ErrorText({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 max-w-40 text-[0.7rem] text-destructive">{msg}</p>;
}

function NewAttributeButton({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Sparkles /> New specification type
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <Label htmlFor="new-attr" className="text-xs">
          Name (e.g. Material, Origin)
        </Label>
        <div className="mt-2 flex gap-2">
          <Input id="new-attr" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          <Button
            type="button"
            size="sm"
            disabled={name.trim().length < 2 || busy}
            onClick={async () => {
              setBusy(true);
              await onCreate(name.trim());
              setBusy(false);
              setName("");
              setOpen(false);
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : "Add"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

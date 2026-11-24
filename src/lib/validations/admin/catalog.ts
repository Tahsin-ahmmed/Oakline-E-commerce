import { z } from "zod";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Required")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

const sku = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, "Required")
  .max(60)
  .regex(/^[A-Z0-9][A-Z0-9._-]*$/, "Letters, numbers, dot, dash or underscore");

const money = z.number({ message: "Enter a price" }).min(0, "Must be 0 or more").max(100_000_000);
const optMoney = money.nullable().optional();
const optText = (max: number) => z.string().trim().max(max).nullable().optional();
const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour")
  .nullable()
  .optional()
  .or(z.literal(""));

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

export const variantSchema = z
  .object({
    id: z.string().max(40).optional(),
    sku,
    color: optText(40),
    colorHex: hex,
    size: optText(40),
    price: optMoney,
    salePrice: optMoney,
    stock: z.number().int("Whole number").min(0, "Cannot be negative").max(1_000_000),
    lowStockThreshold: z.number().int().min(0).max(100_000),
    isActive: z.boolean(),
    imageUrl: optText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.salePrice != null && v.price != null && v.salePrice >= v.price) {
      ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Must be lower than the variant price" });
    }
  });
export type VariantInput = z.infer<typeof variantSchema>;

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a product name").max(160),
    slug,
    sku,
    categoryId: z.string().min(1, "Choose a category").max(40),
    extraCategoryIds: z.array(z.string().max(40)).max(20).default([]),
    brandId: z.string().max(40).nullable().optional(),
    shortDescription: optText(300),
    description: z.string().max(50_000).default(""),
    price: money,
    salePrice: optMoney,
    costPrice: optMoney,
    weightGrams: z.number().int().min(0).max(1_000_000).nullable().optional(),
    dimensions: optText(120),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30).default([]),
    isFeatured: z.boolean().default(false),
    status: z.enum(PRODUCT_STATUSES),
    seoTitle: optText(160),
    seoDescription: optText(320),
    images: z
      .array(z.object({ url: z.string().trim().url("Invalid image URL").max(1000), alt: optText(200) }))
      .max(12)
      .default([]),
    attributes: z
      .array(z.object({ attributeId: z.string().min(1).max(40), value: z.string().trim().min(1, "Enter a value").max(300) }))
      .max(30)
      .default([]),
    hasVariants: z.boolean(),
    variants: z.array(variantSchema).min(1, "Add at least one variant").max(100),
  })
  .superRefine((p, ctx) => {
    if (p.salePrice != null && p.salePrice >= p.price) {
      ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Sale price must be lower than the regular price" });
    }
    if (!p.hasVariants && p.variants.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "A simple product has exactly one stock record" });
    }
    const skus = new Set<string>();
    const combos = new Set<string>();
    p.variants.forEach((v, i) => {
      if (skus.has(v.sku)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Duplicate SKU" });
      skus.add(v.sku);
      if (p.hasVariants) {
        if (!v.color && !v.size) {
          ctx.addIssue({ code: "custom", path: ["variants", i, "color"], message: "Set a colour or size" });
        }
        const key = `${(v.color ?? "").toLowerCase()}|${(v.size ?? "").toLowerCase()}`;
        if (combos.has(key)) ctx.addIssue({ code: "custom", path: ["variants", i, "size"], message: "Duplicate colour/size combination" });
        combos.add(key);
      }
    });
    const attrs = new Set<string>();
    p.attributes.forEach((a, i) => {
      if (attrs.has(a.attributeId)) ctx.addIssue({ code: "custom", path: ["attributes", i, "attributeId"], message: "Duplicate specification" });
      attrs.add(a.attributeId);
    });
  });
export type ProductInput = z.infer<typeof productSchema>;

export const productBulkSchema = z.object({
  ids: z.array(z.string().min(1).max(40)).min(1, "Select at least one product").max(200),
  action: z.enum(["delete", "status", "feature", "unfeature"]),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

export const productPatchSchema = z.object({
  isFeatured: z.boolean().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  slug,
  parentId: z.string().max(40).nullable().optional(),
  description: optText(500),
  imageUrl: optText(1000),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
  seoTitle: optText(160),
  seoDescription: optText(320),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const categoryPatchSchema = z.object({
  isActive: z.boolean().optional(),
  move: z.enum(["up", "down"]).optional(),
});

export const categoryDeleteSchema = z.object({
  /** Move products (and children) to this category before deleting. */
  moveToId: z.string().max(40).optional(),
});

export const brandSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  slug,
  description: optText(500),
  logoUrl: optText(1000),
  isActive: z.boolean().default(true),
});
export type BrandInput = z.infer<typeof brandSchema>;

export const attributeSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(60),
  slug,
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export type AttributeInput = z.infer<typeof attributeSchema>;

export const STOCK_FILTERS = ["in", "low", "out"] as const;

export const stockAdjustSchema = z.object({
  variantId: z.string().min(1).max(40),
  mode: z.enum(["set", "add"]),
  quantity: z.number().int("Whole number").min(-1_000_000).max(1_000_000),
  type: z.enum(["RESTOCK", "ADJUSTMENT", "RETURN"]).optional(),
  reason: z.string().trim().min(3, "Give a short reason").max(300),
  lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
}).superRefine((v, ctx) => {
  if (v.mode === "set" && v.quantity < 0) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Cannot be negative" });
  if (v.mode === "add" && v.quantity === 0) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Enter a non-zero amount" });
});

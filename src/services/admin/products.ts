import "server-only";
import { revalidateTag } from "next/cache";
import { prisma, type Tx } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { ProductStatus } from "@/generated/prisma/enums";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { moneyString } from "@/lib/money";
import { resolvePrice } from "@/lib/pricing";
import { sanitizeRichText } from "@/lib/sanitize";
import { slugify } from "@/lib/slug";
import { CATALOG_TAG } from "@/services/catalog";
import { syncProductStock } from "@/services/inventory";
import type { ProductInput } from "@/lib/validations/admin/catalog";

export function revalidateCatalog() {
  try {
    revalidateTag(CATALOG_TAG, { expire: 0 });
  } catch {
    /* outside request context */
  }
}

// ───────────── Listing ─────────────

export interface AdminProductFilters {
  q?: string;
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus;
  stock?: "in" | "low" | "out";
  featured?: boolean;
  sort?: "updated" | "name" | "price_asc" | "price_desc" | "stock" | "sold";
  skip: number;
  take: number;
}

const LOW_STOCK = 5;

export function adminProductWhere(f: Omit<AdminProductFilters, "skip" | "take" | "sort">): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ deletedAt: null }];
  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { sku: { contains: f.q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: f.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (f.categoryId) {
    and.push({ OR: [{ categoryId: f.categoryId }, { category: { parentId: f.categoryId } }] });
  }
  if (f.brandId) and.push({ brandId: f.brandId });
  if (f.status) and.push({ status: f.status });
  if (f.featured !== undefined) and.push({ isFeatured: f.featured });
  if (f.stock === "out") and.push({ stockQuantity: { lte: 0 } });
  if (f.stock === "low") and.push({ stockQuantity: { gt: 0, lte: LOW_STOCK } });
  if (f.stock === "in") and.push({ stockQuantity: { gt: LOW_STOCK } });
  return { AND: and };
}

const SORTS: Record<NonNullable<AdminProductFilters["sort"]>, Prisma.ProductOrderByWithRelationInput[]> = {
  updated: [{ updatedAt: "desc" }],
  name: [{ name: "asc" }],
  price_asc: [{ effectivePrice: "asc" }],
  price_desc: [{ effectivePrice: "desc" }],
  stock: [{ stockQuantity: "asc" }],
  sold: [{ soldCount: "desc" }],
};

export async function listAdminProducts(f: AdminProductFilters) {
  const where = adminProductWhere(f);
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: SORTS[f.sort ?? "updated"],
      skip: f.skip,
      take: f.take,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        salePrice: true,
        status: true,
        isFeatured: true,
        stockQuantity: true,
        hasVariants: true,
        soldCount: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        _count: { select: { variants: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return {
    total,
    items: rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      price: moneyString(p.price),
      salePrice: p.salePrice ? moneyString(p.salePrice) : null,
      status: p.status,
      isFeatured: p.isFeatured,
      stockQuantity: p.stockQuantity,
      variantCount: p._count.variants,
      hasVariants: p.hasVariants,
      soldCount: p.soldCount,
      image: p.images[0]?.url ?? null,
      category: p.category,
      brand: p.brand,
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
}
export type AdminProductRow = Awaited<ReturnType<typeof listAdminProducts>>["items"][number];

// ───────────── Detail ─────────────

export async function getAdminProduct(id: string) {
  const p = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      attributes: { include: { attribute: true } },
      extraCategories: true,
      variants: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { inventory: true } },
    },
  });
  if (!p) return null;
  const num = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));
  const input: ProductInput = {
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    categoryId: p.categoryId,
    extraCategoryIds: p.extraCategories.map((c) => c.categoryId),
    brandId: p.brandId,
    shortDescription: p.shortDescription,
    description: p.description,
    price: Number(p.price),
    salePrice: num(p.salePrice),
    costPrice: num(p.costPrice),
    weightGrams: p.weightGrams,
    dimensions: p.dimensions,
    tags: p.tags,
    isFeatured: p.isFeatured,
    status: p.status,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
    attributes: p.attributes.map((a) => ({ attributeId: a.attributeId, value: a.value })),
    hasVariants: p.hasVariants,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      color: v.color,
      colorHex: v.colorHex,
      size: v.size,
      price: num(v.price),
      salePrice: num(v.salePrice),
      stock: v.inventory?.quantity ?? 0,
      lowStockThreshold: v.inventory?.lowStockThreshold ?? 5,
      isActive: v.isActive,
      imageUrl: v.imageUrl,
    })),
  };
  return {
    id: p.id,
    input,
    meta: {
      status: p.status,
      slug: p.slug,
      soldCount: p.soldCount,
      ratingAvg: Number(p.ratingAvg),
      reviewCount: p.reviewCount,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      publishedAt: p.publishedAt?.toISOString() ?? null,
    },
  };
}
export type AdminProductDetail = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

// ───────────── Save ─────────────

function variantName(v: { color?: string | null; size?: string | null }) {
  return [v.color, v.size].filter(Boolean).join(" / ") || "Default";
}

async function assertUnique(tx: Tx, input: ProductInput, productId?: string) {
  const errors: Record<string, string[]> = {};
  const slugTaken = await tx.product.findFirst({ where: { slug: input.slug, id: productId ? { not: productId } : undefined }, select: { id: true } });
  if (slugTaken) errors.slug = ["This slug is already used by another product"];
  const skuTaken = await tx.product.findFirst({ where: { sku: input.sku, id: productId ? { not: productId } : undefined }, select: { id: true } });
  if (skuTaken) errors.sku = ["This SKU is already used by another product"];
  const variantSkus = input.variants.map((v) => v.sku);
  const clashes = await tx.productVariant.findMany({
    where: { sku: { in: variantSkus }, productId: productId ? { not: productId } : undefined },
    select: { sku: true },
  });
  for (const c of clashes) {
    const i = input.variants.findIndex((v) => v.sku === c.sku);
    errors[`variants.${i}.sku`] = ["SKU already used by another product"];
  }
  const cat = await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
  if (!cat) errors.categoryId = ["Category not found"];
  if (input.brandId) {
    const b = await tx.brand.findUnique({ where: { id: input.brandId }, select: { id: true } });
    if (!b) errors.brandId = ["Brand not found"];
  }
  if (Object.keys(errors).length) throw conflict("Some values are already in use. Please change them.", errors);
}

function normalize(input: ProductInput): ProductInput {
  const variants = input.hasVariants
    ? input.variants
    : [{ ...input.variants[0], sku: input.sku, color: null, colorHex: null, size: null, price: null, salePrice: null, isActive: true }];
  return {
    ...input,
    description: sanitizeRichText(input.description),
    extraCategoryIds: [...new Set(input.extraCategoryIds)].filter((c) => c !== input.categoryId),
    tags: [...new Set(input.tags.map((t) => t.toLowerCase()))],
    variants: variants.map((v) => ({ ...v, colorHex: v.colorHex || null, color: v.color || null, size: v.size || null, imageUrl: v.imageUrl || null })),
  };
}

function productData(input: ProductInput) {
  const price = resolvePrice({ price: input.price, salePrice: input.salePrice });
  return {
    name: input.name,
    slug: input.slug,
    sku: input.sku,
    categoryId: input.categoryId,
    brandId: input.brandId || null,
    shortDescription: input.shortDescription || null,
    description: input.description,
    price: input.price,
    salePrice: input.salePrice ?? null,
    costPrice: input.costPrice ?? null,
    effectivePrice: price.effective.toFixed(2),
    weightGrams: input.weightGrams ?? null,
    dimensions: input.dimensions || null,
    tags: input.tags,
    isFeatured: input.isFeatured,
    status: input.status,
    hasVariants: input.hasVariants,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
  };
}

async function writeRelations(tx: Tx, productId: string, input: ProductInput) {
  await tx.productImage.deleteMany({ where: { productId } });
  if (input.images.length) {
    await tx.productImage.createMany({
      data: input.images.map((img, i) => ({ productId, url: img.url, alt: img.alt || null, sortOrder: i })),
    });
  }
  await tx.productAttributeValue.deleteMany({ where: { productId } });
  if (input.attributes.length) {
    await tx.productAttributeValue.createMany({
      data: input.attributes.map((a) => ({ productId, attributeId: a.attributeId, value: a.value })),
    });
  }
  await tx.productCategory.deleteMany({ where: { productId } });
  if (input.extraCategoryIds.length) {
    await tx.productCategory.createMany({
      data: input.extraCategoryIds.map((categoryId) => ({ productId, categoryId })),
      skipDuplicates: true,
    });
  }
}

/** Create/update/remove variants and apply stock changes with movement logs. */
async function syncVariants(tx: Tx, productId: string, input: ProductInput, userId: string, isNew: boolean) {
  const existing = await tx.productVariant.findMany({ where: { productId }, include: { inventory: true } });
  const keepIds = new Set(input.variants.map((v) => v.id).filter(Boolean) as string[]);

  // Remove variants no longer present (deactivate those referenced by orders to keep history consistent).
  for (const old of existing) {
    if (keepIds.has(old.id)) continue;
    const used = await tx.orderItem.count({ where: { variantId: old.id } });
    if (used > 0) {
      await tx.productVariant.update({
        where: { id: old.id },
        data: { isActive: false, isDefault: false, sku: `${old.sku}-ARCHIVED-${Date.now().toString(36).toUpperCase()}` },
      });
    } else {
      await tx.productVariant.delete({ where: { id: old.id } });
    }
  }

  // Free SKUs first so swapping SKUs between variants doesn't violate the unique index mid-update.
  for (const v of input.variants) {
    if (!v.id) continue;
    const old = existing.find((e) => e.id === v.id);
    if (old && old.sku !== v.sku) {
      await tx.productVariant.update({ where: { id: v.id }, data: { sku: `TMP-${v.id}` } });
    }
  }

  for (const [i, v] of input.variants.entries()) {
    const data = {
      sku: v.sku,
      name: variantName(v),
      color: v.color ?? null,
      colorHex: v.colorHex || null,
      size: v.size ?? null,
      price: v.price ?? null,
      salePrice: v.salePrice ?? null,
      imageUrl: v.imageUrl ?? null,
      isActive: v.isActive,
      isDefault: i === 0,
      sortOrder: i,
    };
    const old = v.id ? existing.find((e) => e.id === v.id) : undefined;
    if (v.id && !old) throw badRequest("One of the variants no longer exists. Reload the page and try again.");

    if (!old) {
      const created = await tx.productVariant.create({
        data: { ...data, productId, inventory: { create: { quantity: v.stock, lowStockThreshold: v.lowStockThreshold } } },
        include: { inventory: true },
      });
      await tx.stockMovement.create({
        data: {
          inventoryId: created.inventory!.id,
          type: "INITIAL",
          quantityChange: v.stock,
          quantityAfter: v.stock,
          reason: isNew ? "Opening stock" : "New variant opening stock",
          userId,
        },
      });
      continue;
    }

    await tx.productVariant.update({ where: { id: old.id }, data });
    const inventory =
      old.inventory ?? (await tx.inventory.create({ data: { variantId: old.id, quantity: 0, lowStockThreshold: v.lowStockThreshold } }));
    const [locked] = await tx.$queryRaw<{ quantity: number }[]>`
      SELECT "quantity" FROM "Inventory" WHERE "id" = ${inventory.id} FOR UPDATE`;
    const change = v.stock - locked.quantity;
    await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantity: v.stock, lowStockThreshold: v.lowStockThreshold },
    });
    if (change !== 0) {
      await tx.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: "ADJUSTMENT",
          quantityChange: change,
          quantityAfter: v.stock,
          reason: "Edited in product form",
          userId,
        },
      });
    }
  }
}

export async function createProduct(raw: ProductInput, userId: string) {
  const input = normalize(raw);
  const product = await prisma.$transaction(
    async (tx) => {
      await assertUnique(tx, input);
      const created = await tx.product.create({
        data: { ...productData(input), publishedAt: input.status === "ACTIVE" ? new Date() : null },
      });
      await writeRelations(tx, created.id, input);
      await syncVariants(tx, created.id, input, userId, true);
      await syncProductStock(tx, created.id);
      return created;
    },
    { timeout: 20_000 },
  );
  revalidateCatalog();
  return product;
}

export async function updateProduct(id: string, raw: ProductInput, userId: string) {
  const input = normalize(raw);
  const product = await prisma.$transaction(
    async (tx) => {
      const current = await tx.product.findFirst({ where: { id, deletedAt: null } });
      if (!current) throw notFound("Product not found.");
      await assertUnique(tx, input, id);
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...productData(input),
          ...(input.status === "ACTIVE" && !current.publishedAt ? { publishedAt: new Date() } : {}),
        },
      });
      await writeRelations(tx, id, input);
      await syncVariants(tx, id, input, userId, false);
      await syncProductStock(tx, id);
      return updated;
    },
    { timeout: 20_000 },
  );
  revalidateCatalog();
  return product;
}

export async function patchProduct(id: string, data: { isFeatured?: boolean; status?: ProductStatus }) {
  const current = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!current) throw notFound("Product not found.");
  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      ...(data.status === "ACTIVE" && !current.publishedAt ? { publishedAt: new Date() } : {}),
    },
  });
  revalidateCatalog();
  return updated;
}

/** Soft delete: hide everywhere and free the slug/SKUs for reuse. */
async function softDeleteInTx(tx: Tx, id: string) {
  const product = await tx.product.findFirst({ where: { id, deletedAt: null }, include: { variants: true } });
  if (!product) throw notFound("Product not found.");
  const suffix = `-deleted-${Date.now().toString(36)}`;
  for (const v of product.variants) {
    await tx.productVariant.update({ where: { id: v.id }, data: { sku: `${v.sku}${suffix}`.toUpperCase(), isActive: false } });
  }
  await tx.product.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: "ARCHIVED",
      isFeatured: false,
      slug: `${product.slug}${suffix}`.slice(0, 120),
      sku: `${product.sku}${suffix}`.toUpperCase(),
    },
  });
  // Remove from carts, wishlists and collections so customers can't buy deleted items.
  await tx.cartItem.deleteMany({ where: { productId: id } });
  await tx.wishlistItem.deleteMany({ where: { productId: id } });
  await tx.collectionProduct.deleteMany({ where: { productId: id } });
  return product;
}

export async function deleteProduct(id: string) {
  const product = await prisma.$transaction((tx) => softDeleteInTx(tx, id));
  revalidateCatalog();
  return product;
}

export async function bulkProducts(ids: string[], action: "delete" | "status" | "feature" | "unfeature", status?: ProductStatus) {
  let count = 0;
  if (action === "delete") {
    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        const exists = await tx.product.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
        if (!exists) continue;
        await softDeleteInTx(tx, id);
        count++;
      }
    });
  } else if (action === "status") {
    if (!status) throw badRequest("Choose a status.");
    const res = await prisma.product.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { status } });
    if (status === "ACTIVE") {
      await prisma.product.updateMany({ where: { id: { in: ids }, publishedAt: null }, data: { publishedAt: new Date() } });
    }
    count = res.count;
  } else {
    const res = await prisma.product.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { isFeatured: action === "feature" },
    });
    count = res.count;
  }
  revalidateCatalog();
  return { count };
}

async function freeValue(base: string, exists: (v: string) => Promise<boolean>, sep = "-") {
  let candidate = base;
  let n = 2;
  while (await exists(candidate)) candidate = `${base}${sep}${n++}`;
  return candidate;
}

/** Duplicate a product as a DRAFT with fresh slug/SKUs and zero stock. */
export async function duplicateProduct(id: string, userId: string) {
  const src = await getAdminProduct(id);
  if (!src) throw notFound("Product not found.");
  const slug = await freeValue(`${slugify(src.input.slug)}-copy`, async (s) => Boolean(await prisma.product.findUnique({ where: { slug: s } })));
  const sku = await freeValue(`${src.input.sku}-COPY`, async (s) => Boolean(await prisma.product.findUnique({ where: { sku: s } })));
  const variants = [];
  for (const v of src.input.variants) {
    const vsku = src.input.hasVariants
      ? await freeValue(`${v.sku}-COPY`, async (s) => Boolean(await prisma.productVariant.findUnique({ where: { sku: s } })))
      : sku;
    variants.push({ ...v, id: undefined, sku: vsku, stock: 0 });
  }
  return createProduct(
    { ...src.input, name: `${src.input.name} (copy)`, slug, sku, status: "DRAFT", isFeatured: false, variants },
    userId,
  );
}

/** Options for selects in the product form. */
export async function productFormOptions() {
  const [categories, brands, attributes] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, children: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } } },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.productAttribute.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  return { categories, brands, attributes };
}
export type ProductFormOptions = Awaited<ReturnType<typeof productFormOptions>>;

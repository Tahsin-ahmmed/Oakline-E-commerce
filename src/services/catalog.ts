import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { discountPercent, moneyString } from "@/lib/money";
import { resolvePrice, stockState } from "@/lib/pricing";

export const CATALOG_TAG = "catalog";

/** Storefront-visible product filter (never exposes drafts or soft-deleted items). */
export const visibleProduct: Prisma.ProductWhereInput = {
  status: "ACTIVE",
  deletedAt: null,
  category: { isActive: true },
};

const NEW_DAYS = 30;

// ───────────── Product card DTO ─────────────

export const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  salePrice: true,
  effectivePrice: true,
  stockQuantity: true,
  ratingAvg: true,
  reviewCount: true,
  hasVariants: true,
  isFeatured: true,
  createdAt: true,
  publishedAt: true,
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 2 },
  variants: {
    where: { isActive: true },
    select: { id: true, color: true, colorHex: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export interface ProductCardDTO {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  imageAlt: string;
  hoverImage: string | null;
  price: string;
  salePrice: string | null;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  lowStock: boolean;
  isNew: boolean;
  hasVariants: boolean;
  defaultVariantId: string | null;
  brand: string | null;
  category: string;
  colors: { name: string; hex: string | null }[];
}

export function toCard(p: CardRow): ProductCardDTO {
  const price = resolvePrice({ price: p.price, salePrice: p.salePrice });
  const published = p.publishedAt ?? p.createdAt;
  const colors = new Map<string, string | null>();
  for (const v of p.variants) if (v.color && !colors.has(v.color)) colors.set(v.color, v.colorHex);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: p.images[0]?.url ?? null,
    imageAlt: p.images[0]?.alt ?? p.name,
    hoverImage: p.images[1]?.url ?? null,
    price: moneyString(price.regular),
    salePrice: price.sale ? moneyString(price.sale) : null,
    discountPercent: price.sale ? discountPercent(price.regular, price.sale) : 0,
    rating: Number(p.ratingAvg),
    reviewCount: p.reviewCount,
    inStock: p.stockQuantity > 0,
    lowStock: stockState(p.stockQuantity) === "LOW_STOCK",
    isNew: Date.now() - published.getTime() < NEW_DAYS * 86_400_000,
    hasVariants: p.hasVariants,
    defaultVariantId: p.variants[0]?.id ?? null,
    brand: p.brand?.name ?? null,
    category: p.category.name,
    colors: [...colors].map(([name, hex]) => ({ name, hex })),
  };
}

// ───────────── Listing ─────────────

const csv = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    (Array.isArray(v) ? v : (v ?? "").split(","))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20),
  );

const numberish = z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().min(0).optional());

export const SORT_OPTIONS = {
  featured: "Featured",
  newest: "Newest",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  best_selling: "Best Selling",
  rating: "Highest Rated",
} as const;
export type SortKey = keyof typeof SORT_OPTIONS;

export const listingFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  brand: csv,
  color: csv,
  size: csv,
  minPrice: numberish,
  maxPrice: numberish,
  availability: z.enum(["in_stock", "out_of_stock"]).optional().catch(undefined),
  rating: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  onSale: z
    .enum(["1", "true"])
    .optional()
    .catch(undefined)
    .transform((v) => Boolean(v)),
  collection: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(60).optional(),
  sort: z.enum(Object.keys(SORT_OPTIONS) as [SortKey, ...SortKey[]]).catch("featured").default("featured"),
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).catch(24).default(24),
});
export type ListingFilters = z.infer<typeof listingFiltersSchema>;

export function parseListingFilters(params: Record<string, string | string[] | undefined>): ListingFilters {
  return listingFiltersSchema.parse(params);
}

/** Resolve a category slug to its id plus all descendant ids (two levels deep is the catalog maximum). */
async function categoryScope(slug: string) {
  const category = await prisma.category.findFirst({
    where: { slug, isActive: true },
    include: { children: { where: { isActive: true }, select: { id: true } }, parent: true },
  });
  if (!category) return null;
  return { category, ids: [category.id, ...category.children.map((c) => c.id)] };
}

function searchWhere(q: string): Prisma.ProductWhereInput {
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 5);
  return {
    AND: terms.map((term) => ({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { shortDescription: { contains: term, mode: "insensitive" } },
        { sku: { equals: term.toUpperCase() } },
        { tags: { has: term.toLowerCase() } },
        { brand: { name: { contains: term, mode: "insensitive" } } },
        { category: { name: { contains: term, mode: "insensitive" } } },
      ],
    })),
  };
}

function orderByFor(sort: SortKey): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }];
    case "price_asc":
      return [{ effectivePrice: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ effectivePrice: "desc" }, { id: "asc" }];
    case "best_selling":
      return [{ soldCount: "desc" }, { createdAt: "desc" }];
    case "rating":
      return [{ ratingAvg: "desc" }, { reviewCount: "desc" }];
    default:
      return [{ isFeatured: "desc" }, { soldCount: "desc" }, { createdAt: "desc" }];
  }
}

export async function listProducts(filters: ListingFilters) {
  const scope = filters.category ? await categoryScope(filters.category) : null;
  if (filters.category && !scope) return { notFound: true as const };

  const base: Prisma.ProductWhereInput[] = [visibleProduct];
  if (scope) {
    base.push({
      OR: [{ categoryId: { in: scope.ids } }, { extraCategories: { some: { categoryId: { in: scope.ids } } } }],
    });
  }
  if (filters.q) base.push(searchWhere(filters.q));
  if (filters.collection) {
    base.push({ collections: { some: { collection: { slug: filters.collection, isActive: true } } } });
  }
  if (filters.tag) base.push({ tags: { has: filters.tag.toLowerCase() } });

  const refinements: Prisma.ProductWhereInput[] = [];
  if (filters.brand.length) refinements.push({ brand: { slug: { in: filters.brand } } });
  if (filters.color.length) {
    refinements.push({ variants: { some: { isActive: true, color: { in: filters.color, mode: "insensitive" } } } });
  }
  if (filters.size.length) refinements.push({ variants: { some: { isActive: true, size: { in: filters.size } } } });
  if (filters.minPrice !== undefined) refinements.push({ effectivePrice: { gte: filters.minPrice } });
  if (filters.maxPrice !== undefined) refinements.push({ effectivePrice: { lte: filters.maxPrice } });
  if (filters.availability === "in_stock") refinements.push({ stockQuantity: { gt: 0 } });
  if (filters.availability === "out_of_stock") refinements.push({ stockQuantity: { lte: 0 } });
  if (filters.rating) refinements.push({ ratingAvg: { gte: filters.rating } });
  if (filters.onSale) refinements.push({ salePrice: { not: null } });

  const baseWhere: Prisma.ProductWhereInput = { AND: base };
  const where: Prisma.ProductWhereInput = { AND: [...base, ...refinements] };
  const skip = (filters.page - 1) * filters.pageSize;

  const [total, rows, facets] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: productCardSelect,
      orderBy: orderByFor(filters.sort),
      skip,
      take: filters.pageSize,
    }),
    listingFacets(baseWhere),
  ]);

  return {
    notFound: false as const,
    category: scope?.category ?? null,
    products: rows.map(toCard),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    facets,
  };
}

/** Filter options available within the base scope (category/search), with product counts. */
async function listingFacets(baseWhere: Prisma.ProductWhereInput) {
  const [brandGroups, colorRows, sizeRows, priceAgg] = await Promise.all([
    prisma.product.groupBy({ by: ["brandId"], where: { AND: [baseWhere, { brandId: { not: null } }] }, _count: true }),
    prisma.productVariant.groupBy({
      by: ["color", "colorHex"],
      where: { isActive: true, color: { not: null }, product: baseWhere },
      _count: true,
    }),
    prisma.productVariant.groupBy({
      by: ["size"],
      where: { isActive: true, size: { not: null }, product: baseWhere },
      _count: true,
    }),
    prisma.product.aggregate({ where: baseWhere, _min: { effectivePrice: true }, _max: { effectivePrice: true } }),
  ]);
  const brandIds = brandGroups.map((b) => b.brandId!).filter(Boolean);
  const brands = brandIds.length
    ? await prisma.brand.findMany({ where: { id: { in: brandIds }, isActive: true }, orderBy: { name: "asc" } })
    : [];
  const brandCount = new Map(brandGroups.map((b) => [b.brandId, b._count]));
  const colors = new Map<string, { name: string; hex: string | null; count: number }>();
  for (const row of colorRows) {
    const key = row.color!.toLowerCase();
    const existing = colors.get(key);
    if (existing) existing.count += row._count;
    else colors.set(key, { name: row.color!, hex: row.colorHex, count: row._count });
  }
  const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "One Size"];
  const sizes = sizeRows
    .map((s) => ({ name: s.size!, count: s._count }))
    .sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a.name);
      const bi = SIZE_ORDER.indexOf(b.name);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  return {
    brands: brands.map((b) => ({ slug: b.slug, name: b.name, count: brandCount.get(b.id) ?? 0 })),
    colors: [...colors.values()].sort((a, b) => b.count - a.count),
    sizes,
    priceRange: {
      min: Math.floor(Number(priceAgg._min.effectivePrice ?? 0)),
      max: Math.ceil(Number(priceAgg._max.effectivePrice ?? 0)),
    },
  };
}

// ───────────── Product detail ─────────────

export const getProductBySlug = cache(async (slug: string) => {
  const product = await prisma.product.findFirst({
    where: { slug, ...visibleProduct },
    omit: { costPrice: true },
    include: {
      brand: { select: { name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true, parent: { select: { name: true, slug: true } } } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { inventory: { select: { quantity: true, lowStockThreshold: true } } },
      },
      attributes: { include: { attribute: true }, orderBy: { attribute: { sortOrder: "asc" } } },
    },
  });
  if (!product) return null;

  const variants = product.variants.map((v) => {
    const price = resolvePrice({ price: product.price, salePrice: product.salePrice }, v);
    const available = Math.max(0, v.inventory?.quantity ?? 0);
    return {
      id: v.id,
      sku: v.sku,
      name: v.name,
      color: v.color,
      colorHex: v.colorHex,
      size: v.size,
      imageUrl: v.imageUrl,
      price: moneyString(price.regular),
      salePrice: price.sale ? moneyString(price.sale) : null,
      discountPercent: price.sale ? discountPercent(price.regular, price.sale) : 0,
      available,
      stockState: stockState(available, v.inventory?.lowStockThreshold ?? 5),
      isDefault: v.isDefault,
    };
  });
  const basePrice = resolvePrice({ price: product.price, salePrice: product.salePrice });

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    shortDescription: product.shortDescription,
    description: product.description,
    price: moneyString(basePrice.regular),
    salePrice: basePrice.sale ? moneyString(basePrice.sale) : null,
    discountPercent: basePrice.sale ? discountPercent(basePrice.regular, basePrice.sale) : 0,
    rating: Number(product.ratingAvg),
    reviewCount: product.reviewCount,
    stockQuantity: product.stockQuantity,
    hasVariants: product.hasVariants,
    weightGrams: product.weightGrams,
    dimensions: product.dimensions,
    tags: product.tags,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    brand: product.brand,
    category: product.category,
    images: product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt ?? product.name })),
    variants,
    specifications: [
      ...product.attributes.map((a) => ({ name: a.attribute.name, value: a.value })),
      ...(product.dimensions ? [{ name: "Dimensions", value: product.dimensions }] : []),
      ...(product.weightGrams ? [{ name: "Weight", value: `${product.weightGrams} g` }] : []),
    ],
    updatedAt: product.updatedAt,
  };
});
export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export async function getRelatedProducts(productId: string, categoryId: string, limit = 8) {
  const rows = await prisma.product.findMany({
    where: { ...visibleProduct, id: { not: productId }, categoryId },
    select: productCardSelect,
    orderBy: [{ soldCount: "desc" }, { ratingAvg: "desc" }],
    take: limit,
  });
  if (rows.length < limit) {
    const more = await prisma.product.findMany({
      where: { ...visibleProduct, id: { notIn: [productId, ...rows.map((r) => r.id)] } },
      select: productCardSelect,
      orderBy: [{ isFeatured: "desc" }, { soldCount: "desc" }],
      take: limit - rows.length,
    });
    rows.push(...more);
  }
  return rows.map(toCard);
}

export async function getProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.product.findMany({
    where: { ...visibleProduct, id: { in: ids.slice(0, 24) } },
    select: productCardSelect,
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.map(toCard).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getReviewsForProduct(productId: string, page = 1, pageSize = 10) {
  const where = { productId, status: "APPROVED" as const };
  const [reviews, total, distribution] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ["rating"], where, _count: true }),
  ]);
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of distribution) dist[d.rating] = d._count;
  return {
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      author: r.user.name.split(" ")[0] + (r.user.name.includes(" ") ? ` ${r.user.name.split(" ").at(-1)![0]}.` : ""),
      isVerifiedPurchase: r.isVerifiedPurchase,
      adminReply: r.adminReply,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    distribution: dist,
  };
}

// ───────────── Collections of products for homepage & widgets ─────────────

export type ProductSource = "featured" | "trending" | "best_sellers" | "new_arrivals" | "sale";

export async function getProductsBySource(source: ProductSource, limit = 8): Promise<ProductCardDTO[]> {
  if (source === "trending") {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const recent = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, order: { placedAt: { gte: since }, status: { notIn: ["CANCELLED"] } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });
    const cards = await getProductsByIds(recent.map((r) => r.productId!));
    if (cards.length >= limit) return cards.slice(0, limit);
    const filler = await prisma.product.findMany({
      where: { ...visibleProduct, id: { notIn: cards.map((c) => c.id) } },
      select: productCardSelect,
      orderBy: [{ ratingAvg: "desc" }, { reviewCount: "desc" }],
      take: limit - cards.length,
    });
    return [...cards, ...filler.map(toCard)];
  }
  const config: Record<Exclude<ProductSource, "trending">, Prisma.ProductFindManyArgs> = {
    featured: { where: { ...visibleProduct, isFeatured: true }, orderBy: [{ soldCount: "desc" }] },
    best_sellers: { where: visibleProduct, orderBy: [{ soldCount: "desc" }, { ratingAvg: "desc" }] },
    new_arrivals: { where: visibleProduct, orderBy: [{ createdAt: "desc" }] },
    sale: { where: { ...visibleProduct, salePrice: { not: null } }, orderBy: [{ soldCount: "desc" }] },
  };
  const rows = await prisma.product.findMany({ ...config[source], select: productCardSelect, take: limit });
  return rows.map(toCard);
}

// ───────────── Categories ─────────────

async function loadCategoryTree() {
  const categories = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      children: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.imageUrl,
    children: c.children.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
  }));
}
export type CategoryNode = Awaited<ReturnType<typeof loadCategoryTree>>[number];

const cachedTree = unstable_cache(loadCategoryTree, ["category-tree"], { tags: [CATALOG_TAG], revalidate: 600 });

export const getCategoryTree = cache(async () => {
  try {
    return await cachedTree();
  } catch {
    return loadCategoryTree();
  }
});

export async function searchSuggestions(q: string, limit = 6) {
  if (q.trim().length < 2) return { products: [], categories: [] };
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { AND: [visibleProduct, searchWhere(q)] },
      select: productCardSelect,
      orderBy: [{ soldCount: "desc" }],
      take: limit,
    }),
    prisma.category.findMany({
      where: { isActive: true, name: { contains: q.trim(), mode: "insensitive" } },
      select: { name: true, slug: true },
      take: 4,
    }),
  ]);
  return { products: products.map(toCard), categories };
}

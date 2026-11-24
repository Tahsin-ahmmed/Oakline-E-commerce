import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { uniqueSlug } from "@/lib/slug";
import { CATALOG_TAG } from "@/services/catalog";
import {
  sectionConfigSchemas,
  type BannerInput,
  type CollectionInput,
  type SectionConfigType,
  type SectionUpdateInput,
  type TestimonialInput,
} from "@/lib/validations/admin/content";

const orNull = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);
const toDate = (v: string | undefined | null) => (v ? new Date(v) : null);

function refreshStorefront() {
  try {
    revalidatePath("/");
  } catch {
    /* outside request */
  }
}

// ───────────── Banners ─────────────

export function listBanners() {
  return prisma.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
}

function bannerData(input: BannerInput) {
  return {
    title: input.title,
    subtitle: orNull(input.subtitle),
    eyebrow: orNull(input.eyebrow),
    imageUrl: input.imageUrl,
    mobileImageUrl: orNull(input.mobileImageUrl),
    ctaLabel: orNull(input.ctaLabel),
    ctaHref: orNull(input.ctaHref),
    placement: input.placement,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    startsAt: toDate(input.startsAt),
    endsAt: toDate(input.endsAt),
  };
}

export async function createBanner(input: BannerInput) {
  const banner = await prisma.banner.create({ data: bannerData(input) });
  refreshStorefront();
  return banner;
}

export async function updateBanner(id: string, input: BannerInput) {
  await ensure(prisma.banner.findUnique({ where: { id } }), "Banner");
  const banner = await prisma.banner.update({ where: { id }, data: bannerData(input) });
  refreshStorefront();
  return banner;
}

export async function setBannerActive(id: string, isActive: boolean) {
  await ensure(prisma.banner.findUnique({ where: { id } }), "Banner");
  const banner = await prisma.banner.update({ where: { id }, data: { isActive } });
  refreshStorefront();
  return banner;
}

export async function deleteBanner(id: string) {
  const banner = await ensure(prisma.banner.findUnique({ where: { id } }), "Banner");
  await prisma.banner.delete({ where: { id } });
  refreshStorefront();
  return banner;
}

// ───────────── Homepage sections ─────────────

export function listSections() {
  return prisma.homepageSection.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function updateSection(id: string, input: SectionUpdateInput) {
  const section = await ensure(prisma.homepageSection.findUnique({ where: { id } }), "Section");
  let config: object | undefined;
  if (input.config !== undefined) {
    const schema = sectionConfigSchemas[section.type as SectionConfigType];
    if (schema) {
      const parsed = schema.safeParse(input.config);
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) (details[`config.${issue.path.join(".")}`] ??= []).push(issue.message);
        throw badRequest("Please check the section settings.", details);
      }
      config = parsed.data;
    } else {
      config = {};
    }
  }
  const updated = await prisma.homepageSection.update({
    where: { id },
    data: { title: input.title, subtitle: orNull(input.subtitle), isActive: input.isActive, ...(config ? { config } : {}) },
  });
  refreshStorefront();
  return updated;
}

export async function setSectionActive(id: string, isActive: boolean) {
  await ensure(prisma.homepageSection.findUnique({ where: { id } }), "Section");
  const s = await prisma.homepageSection.update({ where: { id }, data: { isActive } });
  refreshStorefront();
  return s;
}

// ───────────── Reordering ─────────────

export async function reorder(entity: "banner" | "section" | "collection" | "testimonial", ids: string[]) {
  if (new Set(ids).size !== ids.length) throw badRequest("Duplicate ids in reorder request.");
  await prisma.$transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      const data = { sortOrder: i };
      if (entity === "banner") await tx.banner.update({ where: { id }, data });
      else if (entity === "section") await tx.homepageSection.update({ where: { id }, data });
      else if (entity === "collection") await tx.collection.update({ where: { id }, data });
      else await tx.testimonial.update({ where: { id }, data });
    }
  });
  refreshStorefront();
  if (entity === "collection") safeCatalogRevalidate();
}

// ───────────── Collections ─────────────

function safeCatalogRevalidate() {
  try {
    revalidateTag(CATALOG_TAG, { expire: 0 });
  } catch {
    /* outside request */
  }
}

export function listCollections() {
  return prisma.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
}

export async function getCollection(id: string) {
  const c = await prisma.collection.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            select: { id: true, name: true, sku: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
          },
        },
      },
    },
  });
  if (!c) throw notFound("Collection not found.");
  return {
    ...c,
    products: c.products.map((p) => ({
      id: p.product.id,
      name: p.product.name,
      sku: p.product.sku,
      image: p.product.images[0]?.url ?? null,
    })),
  };
}

async function resolveCollectionSlug(input: CollectionInput, excludeId?: string) {
  if (input.slug) {
    const existing = await prisma.collection.findUnique({ where: { slug: input.slug } });
    if (existing && existing.id !== excludeId) throw conflict("Another collection already uses this slug.", { slug: ["Slug already in use"] });
    return input.slug;
  }
  return uniqueSlug(input.name, async (s) => {
    const e = await prisma.collection.findUnique({ where: { slug: s } });
    return Boolean(e && e.id !== excludeId);
  });
}

async function validProductIds(ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const found = await prisma.product.findMany({ where: { id: { in: unique }, deletedAt: null }, select: { id: true } });
  const ok = new Set(found.map((f) => f.id));
  return unique.filter((id) => ok.has(id));
}

export async function createCollection(input: CollectionInput) {
  const slug = await resolveCollectionSlug(input);
  const productIds = await validProductIds(input.productIds);
  const c = await prisma.collection.create({
    data: {
      name: input.name,
      slug,
      description: orNull(input.description),
      imageUrl: orNull(input.imageUrl),
      isFeatured: input.isFeatured,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      products: { create: productIds.map((productId, i) => ({ productId, sortOrder: i })) },
    },
  });
  refreshStorefront();
  safeCatalogRevalidate();
  return c;
}

export async function updateCollection(id: string, input: CollectionInput) {
  await ensure(prisma.collection.findUnique({ where: { id } }), "Collection");
  const slug = await resolveCollectionSlug(input, id);
  const productIds = await validProductIds(input.productIds);
  const c = await prisma.$transaction(async (tx) => {
    await tx.collectionProduct.deleteMany({ where: { collectionId: id } });
    return tx.collection.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        description: orNull(input.description),
        imageUrl: orNull(input.imageUrl),
        isFeatured: input.isFeatured,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        products: { create: productIds.map((productId, i) => ({ productId, sortOrder: i })) },
      },
    });
  });
  refreshStorefront();
  safeCatalogRevalidate();
  return c;
}

export async function deleteCollection(id: string) {
  const c = await ensure(prisma.collection.findUnique({ where: { id } }), "Collection");
  await prisma.collection.delete({ where: { id } });
  refreshStorefront();
  safeCatalogRevalidate();
  return c;
}

/** Lightweight product search for pickers. */
export async function searchProductsForPicker(q: string, limit = 12) {
  const rows = await prisma.product.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    select: {
      id: true,
      name: true,
      sku: true,
      status: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: [{ soldCount: "desc" }, { name: "asc" }],
    take: limit,
  });
  return rows.map((r) => ({ id: r.id, name: r.name, sku: r.sku, status: r.status, image: r.images[0]?.url ?? null }));
}

// ───────────── Testimonials ─────────────

export function listTestimonials() {
  return prisma.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

function testimonialData(input: TestimonialInput) {
  return {
    name: input.name,
    location: orNull(input.location),
    quote: input.quote,
    rating: input.rating,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };
}

export async function createTestimonial(input: TestimonialInput) {
  const t = await prisma.testimonial.create({ data: testimonialData(input) });
  refreshStorefront();
  return t;
}

export async function updateTestimonial(id: string, input: TestimonialInput) {
  await ensure(prisma.testimonial.findUnique({ where: { id } }), "Testimonial");
  const t = await prisma.testimonial.update({ where: { id }, data: testimonialData(input) });
  refreshStorefront();
  return t;
}

export async function deleteTestimonial(id: string) {
  const t = await ensure(prisma.testimonial.findUnique({ where: { id } }), "Testimonial");
  await prisma.testimonial.delete({ where: { id } });
  refreshStorefront();
  return t;
}

async function ensure<T>(p: Promise<T | null>, label: string): Promise<T> {
  const v = await p;
  if (!v) throw notFound(`${label} not found.`);
  return v;
}

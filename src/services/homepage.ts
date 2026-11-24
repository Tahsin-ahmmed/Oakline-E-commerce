import "server-only";
import { productTypesFromTree, type ProductType } from "@/lib/product-types";
import { prisma } from "@/lib/prisma";
import { getProductsBySource, getCategoryTree, type ProductCardDTO, type ProductSource } from "@/services/catalog";

const SOURCES: ProductSource[] = ["featured", "trending", "best_sellers", "new_arrivals", "sale"];

type Config = Record<string, unknown>;
const num = (v: unknown, d: number) => (typeof v === "number" && v > 0 ? Math.min(v, 24) : d);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

export interface BannerDTO {
  id: string;
  title: string;
  subtitle: string | null;
  eyebrow: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}

export type HomeSection =
  | { key: string; type: "hero"; banners: BannerDTO[] }
  | { key: string; type: "promo"; banners: BannerDTO[] }
  | {
      key: string;
      type: "categories";
      title: string;
      subtitle: string | null;
      categories: { id: string; name: string; slug: string; imageUrl: string | null; description: string | null }[];
      types: ProductType[];
    }
  | { key: string; type: "products"; title: string; subtitle: string | null; products: ProductCardDTO[]; href: string }
  | {
      key: string;
      type: "collections";
      title: string;
      subtitle: string | null;
      collections: { id: string; name: string; slug: string; description: string | null; imageUrl: string | null; count: number }[];
    }
  | {
      key: string;
      type: "story";
      title: string;
      eyebrow: string | null;
      body: string | null;
      imageUrl: string | null;
      ctaLabel: string | null;
      ctaHref: string | null;
    }
  | {
      key: string;
      type: "testimonials";
      title: string;
      subtitle: string | null;
      items: { id: string; name: string; location: string | null; quote: string; rating: number }[];
    }
  | { key: string; type: "newsletter" }
  | { key: string; type: "instagram"; title: string; subtitle: string | null; handle: string | null; url: string | null; images: string[] };

const SOURCE_HREF: Record<ProductSource, string> = {
  featured: "/products",
  trending: "/products?sort=best_selling",
  best_sellers: "/products?sort=best_selling",
  new_arrivals: "/products?sort=newest",
  sale: "/products?onSale=1",
};

async function activeBanners(placement: "HERO" | "PROMO"): Promise<BannerDTO[]> {
  const now = new Date();
  const rows = await prisma.banner.findMany({
    where: {
      placement,
      isActive: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    eyebrow: b.eyebrow,
    imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl,
    ctaLabel: b.ctaLabel,
    ctaHref: b.ctaHref,
  }));
}

export async function getCollectionBySlug(slug: string) {
  return prisma.collection.findFirst({
    where: { slug, isActive: true },
    select: { id: true, name: true, slug: true, description: true, imageUrl: true },
  });
}

/** Loads every active homepage section, in admin-defined order, with its data. */
export async function getHomepage(): Promise<HomeSection[]> {
  const sections = await prisma.homepageSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const built = await Promise.all(
    sections.map(async (s): Promise<HomeSection | null> => {
      const config = (s.config ?? {}) as Config;
      switch (s.type) {
        case "hero": {
          const banners = await activeBanners("HERO");
          return banners.length ? { key: s.key, type: "hero", banners } : null;
        }
        case "promo": {
          const banners = await activeBanners("PROMO");
          return banners.length ? { key: s.key, type: "promo", banners } : null;
        }
        case "categories": {
          const tree = await getCategoryTree();
          const categories = tree.slice(0, num(config.limit, 6));
          return categories.length
            ? {
                key: s.key,
                type: "categories",
                title: s.title,
                subtitle: s.subtitle,
                categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl, description: c.description })),
                types: productTypesFromTree(tree),
              }
            : null;
        }
        case "products": {
          const source = SOURCES.includes(config.source as ProductSource) ? (config.source as ProductSource) : "featured";
          const products = await getProductsBySource(source, num(config.limit, 8));
          return products.length
            ? { key: s.key, type: "products", title: s.title, subtitle: s.subtitle, products, href: SOURCE_HREF[source] }
            : null;
        }
        case "collections": {
          const rows = await prisma.collection.findMany({
            where: { isActive: true, isFeatured: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            take: num(config.limit, 4),
            include: { _count: { select: { products: true } } },
          });
          return rows.length
            ? {
                key: s.key,
                type: "collections",
                title: s.title,
                subtitle: s.subtitle,
                collections: rows.map((c) => ({
                  id: c.id,
                  name: c.name,
                  slug: c.slug,
                  description: c.description,
                  imageUrl: c.imageUrl,
                  count: c._count.products,
                })),
              }
            : null;
        }
        case "story":
          return {
            key: s.key,
            type: "story",
            title: s.title,
            eyebrow: text(config.eyebrow),
            body: text(config.body),
            imageUrl: text(config.imageUrl),
            ctaLabel: text(config.ctaLabel),
            ctaHref: text(config.ctaHref),
          };
        case "testimonials": {
          const items = await prisma.testimonial.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 6 });
          return items.length
            ? {
                key: s.key,
                type: "testimonials",
                title: s.title,
                subtitle: s.subtitle,
                items: items.map((t) => ({ id: t.id, name: t.name, location: t.location, quote: t.quote, rating: t.rating })),
              }
            : null;
        }
        case "newsletter":
          return { key: s.key, type: "newsletter" };
        case "instagram": {
          const images = Array.isArray(config.images) ? config.images.filter((i): i is string => typeof i === "string").slice(0, 12) : [];
          return images.length
            ? {
                key: s.key,
                type: "instagram",
                title: s.title,
                subtitle: s.subtitle,
                handle: text(config.handle),
                url: text(config.url),
                images,
              }
            : null;
        }
        default:
          return null;
      }
    }),
  );
  return built.filter((s): s is HomeSection => s !== null);
}

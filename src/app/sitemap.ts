import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

// Rendered on request so builds never need database access; CDNs can cache the response.
export const dynamic = "force-dynamic";

const STATIC = ["/about", "/contact", "/faq", "/privacy-policy", "/terms", "/shipping-policy", "/returns-policy", "/blog", "/track-order", "/products"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  const [categories, collections, products, posts] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    prisma.collection.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    prisma.product.findMany({
      where: { status: "ACTIVE", deletedAt: null, category: { isActive: true } },
      select: { slug: true, updatedAt: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
    prisma.blogPost.findMany({
      where: { status: "PUBLISHED", deletedAt: null, publishedAt: { lte: now } },
      select: { slug: true, updatedAt: true },
    }),
  ]);
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...STATIC.map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...categories.map((c) => ({ url: `${base}/categories/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...collections.map((c) => ({ url: `${base}/collections/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: p.images.map((i) => i.url),
    })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}

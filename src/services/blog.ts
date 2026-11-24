import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/** Posts visible to the public: live status, not deleted, publish time reached (covers scheduled posts). */
export function visiblePostWhere(now = new Date()): Prisma.BlogPostWhereInput {
  return { deletedAt: null, status: { in: ["PUBLISHED", "SCHEDULED"] }, publishedAt: { lte: now } };
}

const listSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImageUrl: true,
  publishedAt: true,
  tags: true,
  content: true,
  category: { select: { name: true, slug: true } },
  author: { select: { name: true } },
} satisfies Prisma.BlogPostSelect;

type Row = Prisma.BlogPostGetPayload<{ select: typeof listSelect }>;

export function readingMinutes(html: string) {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function toSummary(p: Row) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    coverImageUrl: p.coverImageUrl,
    publishedAt: p.publishedAt!,
    tags: p.tags,
    category: p.category,
    author: p.author?.name ?? null,
    minutes: readingMinutes(p.content),
  };
}
export type PostSummary = ReturnType<typeof toSummary>;

export async function listPublishedPosts(opts: { category?: string; tag?: string; page: number; pageSize: number }) {
  const where: Prisma.BlogPostWhereInput = {
    ...visiblePostWhere(),
    ...(opts.category ? { category: { slug: opts.category } } : {}),
    ...(opts.tag ? { tags: { has: opts.tag.toLowerCase() } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      select: listSelect,
      orderBy: { publishedAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.blogPost.count({ where }),
  ]);
  return { posts: rows.map(toSummary), total, totalPages: Math.max(1, Math.ceil(total / opts.pageSize)) };
}

export async function listBlogCategoriesWithCounts() {
  const cats = await prisma.blogCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: { where: visiblePostWhere() } } } },
  });
  return cats.filter((c) => c._count.posts > 0).map((c) => ({ name: c.name, slug: c.slug, count: c._count.posts }));
}

export const getPublishedPost = cache(async (slug: string) => {
  return prisma.blogPost.findFirst({
    where: { slug, ...visiblePostWhere() },
    include: { category: { select: { id: true, name: true, slug: true } }, author: { select: { name: true } } },
  });
});

export async function getRelatedPosts(post: { id: string; categoryId: string | null; tags: string[] }, limit = 3) {
  const rows = await prisma.blogPost.findMany({
    where: {
      ...visiblePostWhere(),
      id: { not: post.id },
      OR: [
        ...(post.categoryId ? [{ categoryId: post.categoryId }] : []),
        ...(post.tags.length ? [{ tags: { hasSome: post.tags } }] : []),
      ],
    },
    select: listSelect,
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
  if (rows.length < limit) {
    const more = await prisma.blogPost.findMany({
      where: { ...visiblePostWhere(), id: { notIn: [post.id, ...rows.map((r) => r.id)] } },
      select: listSelect,
      orderBy: { publishedAt: "desc" },
      take: limit - rows.length,
    });
    rows.push(...more);
  }
  return rows.map(toSummary);
}

/** Shipping zones/methods for the public shipping policy page. */
export async function getPublicShippingTable() {
  return prisma.shippingZone.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "asc" }, { sortOrder: "asc" }],
    include: { methods: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { fee: "asc" }] } },
  });
}

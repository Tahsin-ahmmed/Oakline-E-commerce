import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { conflict, notFound } from "@/lib/errors";
import { sanitizeRichText, stripHtml } from "@/lib/sanitize";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { BlogPostInput } from "@/lib/validations/admin/content";

const orNull = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);

function refresh(slug?: string) {
  try {
    revalidatePath("/blog");
    if (slug) revalidatePath(`/blog/${slug}`);
    revalidatePath("/");
  } catch {
    /* outside request */
  }
}

export async function listPostsAdmin(opts: { q?: string; status?: "DRAFT" | "PUBLISHED" | "SCHEDULED"; skip: number; take: number }) {
  const where: Prisma.BlogPostWhereInput = {
    deletedAt: null,
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.q
      ? { OR: [{ title: { contains: opts.q, mode: "insensitive" } }, { slug: { contains: opts.q, mode: "insensitive" } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: opts.skip,
      take: opts.take,
      include: { category: { select: { name: true } }, author: { select: { name: true } } },
    }),
    prisma.blogPost.count({ where }),
  ]);
  return { items, total };
}

export async function getPostAdmin(id: string) {
  const post = await prisma.blogPost.findFirst({ where: { id, deletedAt: null } });
  if (!post) throw notFound("Post not found.");
  return post;
}

async function resolveSlug(input: BlogPostInput, excludeId?: string) {
  if (input.slug) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: input.slug } });
    if (existing && existing.id !== excludeId) throw conflict("Another post already uses this slug.", { slug: ["Slug already in use"] });
    return input.slug;
  }
  return uniqueSlug(input.title, async (s) => {
    const e = await prisma.blogPost.findUnique({ where: { slug: s } });
    return Boolean(e && e.id !== excludeId);
  });
}

async function postData(input: BlogPostInput) {
  if (input.categoryId) {
    const cat = await prisma.blogCategory.findUnique({ where: { id: input.categoryId } });
    if (!cat) throw notFound("Blog category not found.");
  }
  // Published posts without a date go live now; scheduled posts keep their future date.
  let publishedAt: Date | null = input.publishedAt ? new Date(input.publishedAt) : null;
  if (input.status === "PUBLISHED" && !publishedAt) publishedAt = new Date();
  if (input.status === "DRAFT") publishedAt = publishedAt ?? null;
  const tags = [...new Set(input.tags.map((t) => stripHtml(t).toLowerCase()).filter(Boolean))];
  return {
    title: stripHtml(input.title),
    excerpt: orNull(input.excerpt ? stripHtml(input.excerpt) : null),
    content: sanitizeRichText(input.content),
    coverImageUrl: orNull(input.coverImageUrl),
    categoryId: orNull(input.categoryId),
    tags,
    status: input.status,
    publishedAt,
    seoTitle: orNull(input.seoTitle),
    seoDescription: orNull(input.seoDescription),
  };
}

export async function createPost(input: BlogPostInput, authorId: string) {
  const slug = await resolveSlug(input);
  const post = await prisma.blogPost.create({ data: { ...(await postData(input)), slug, authorId } });
  refresh(post.slug);
  return post;
}

export async function updatePost(id: string, input: BlogPostInput) {
  const existing = await getPostAdmin(id);
  const slug = await resolveSlug(input, id);
  const post = await prisma.blogPost.update({ where: { id }, data: { ...(await postData(input)), slug } });
  refresh(existing.slug);
  refresh(post.slug);
  return post;
}

export async function softDeletePost(id: string) {
  const post = await getPostAdmin(id);
  // Free the slug so it can be reused by a new post.
  await prisma.blogPost.update({
    where: { id },
    data: { deletedAt: new Date(), slug: `${post.slug}-deleted-${Date.now().toString(36)}`.slice(0, 190) },
  });
  refresh(post.slug);
  return post;
}

// ───────────── Categories ─────────────

export function listBlogCategories() {
  return prisma.blogCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: { where: { deletedAt: null } } } } },
  });
}

export async function createBlogCategory(name: string) {
  const dup = await prisma.blogCategory.findUnique({ where: { name } });
  if (dup) throw conflict("A category with this name already exists.", { name: ["Already exists"] });
  const slug = await uniqueSlug(name, async (s) => Boolean(await prisma.blogCategory.findUnique({ where: { slug: s } })));
  const c = await prisma.blogCategory.create({ data: { name, slug } });
  refresh();
  return c;
}

export async function renameBlogCategory(id: string, name: string) {
  const cat = await prisma.blogCategory.findUnique({ where: { id } });
  if (!cat) throw notFound("Category not found.");
  const dup = await prisma.blogCategory.findUnique({ where: { name } });
  if (dup && dup.id !== id) throw conflict("A category with this name already exists.", { name: ["Already exists"] });
  const base = slugify(name);
  const slug = await uniqueSlug(base || name, async (s) => {
    const e = await prisma.blogCategory.findUnique({ where: { slug: s } });
    return Boolean(e && e.id !== id);
  });
  const c = await prisma.blogCategory.update({ where: { id }, data: { name, slug } });
  refresh();
  return c;
}

export async function deleteBlogCategory(id: string) {
  const cat = await prisma.blogCategory.findUnique({ where: { id } });
  if (!cat) throw notFound("Category not found.");
  await prisma.blogCategory.delete({ where: { id } }); // posts keep existing with categoryId = null
  refresh();
  return cat;
}

export function previewContent(html: string) {
  return sanitizeRichText(html);
}

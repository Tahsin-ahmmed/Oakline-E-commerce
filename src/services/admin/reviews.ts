import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { notFound } from "@/lib/errors";
import { stripHtml } from "@/lib/sanitize";
import { recomputeProductRating } from "@/services/reviews";
import { logActivity } from "@/services/audit";

export async function listReviews(opts: { q?: string; status?: ReviewStatus; rating?: number; page: number; pageSize: number }) {
  const and: Prisma.ReviewWhereInput[] = [];
  if (opts.status) and.push({ status: opts.status });
  if (opts.rating) and.push({ rating: opts.rating });
  if (opts.q) {
    const contains = { contains: opts.q, mode: "insensitive" as const };
    and.push({ OR: [{ product: { name: contains } }, { body: contains }, { title: contains }, { user: { name: contains } }] });
  }
  const where = and.length ? { AND: and } : {};
  const [rows, total, counts] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: {
        product: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ["status"], _count: true }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      isVerifiedPurchase: r.isVerifiedPurchase,
      adminReply: r.adminReply,
      repliedAt: r.repliedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      product: r.product,
      user: r.user,
    })),
    total,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Partial<Record<ReviewStatus, number>>,
  };
}
export type AdminReviewRow = Awaited<ReturnType<typeof listReviews>>["items"][number];

export async function updateReview(
  id: string,
  input: { status?: ReviewStatus; adminReply?: string | null },
  actor: { id: string },
  ip?: string,
) {
  const review = await prisma.review.findUnique({ where: { id }, include: { product: { select: { name: true } } } });
  if (!review) throw notFound("Review not found.");
  const data: Prisma.ReviewUpdateInput = {};
  if (input.status) data.status = input.status;
  if (input.adminReply !== undefined) {
    const reply = input.adminReply ? stripHtml(input.adminReply) : "";
    data.adminReply = reply || null;
    data.repliedAt = reply ? new Date() : null;
  }
  const updated = await prisma.review.update({ where: { id }, data });
  if (input.status && input.status !== review.status) await recomputeProductRating(review.productId);
  await logActivity({
    user: actor,
    action: input.status ? `review.${input.status.toLowerCase()}` : "review.reply",
    entityType: "Review",
    entityId: id,
    summary: `${input.status ? `Review ${input.status.toLowerCase()}` : "Replied to review"} on ${review.product.name}`,
    ip,
  });
  return updated;
}

export async function deleteReview(id: string, actor: { id: string }, ip?: string) {
  const review = await prisma.review.findUnique({ where: { id }, include: { product: { select: { name: true } } } });
  if (!review) throw notFound("Review not found.");
  await prisma.review.delete({ where: { id } });
  await recomputeProductRating(review.productId);
  await logActivity({ user: actor, action: "review.delete", entityType: "Review", entityId: id, summary: `Deleted review on ${review.product.name}`, ip });
}

export async function bulkReviewAction(ids: string[], action: "approve" | "reject" | "delete", actor: { id: string }, ip?: string) {
  const reviews = await prisma.review.findMany({ where: { id: { in: ids } }, select: { id: true, productId: true } });
  if (action === "delete") await prisma.review.deleteMany({ where: { id: { in: reviews.map((r) => r.id) } } });
  else {
    await prisma.review.updateMany({
      where: { id: { in: reviews.map((r) => r.id) } },
      data: { status: action === "approve" ? "APPROVED" : "REJECTED" },
    });
  }
  for (const productId of new Set(reviews.map((r) => r.productId))) await recomputeProductRating(productId);
  await logActivity({
    user: actor,
    action: `review.bulk_${action}`,
    entityType: "Review",
    summary: `Bulk ${action} ${reviews.length} review(s)`,
    metadata: { ids: reviews.map((r) => r.id) },
    ip,
  });
  return { count: reviews.length };
}

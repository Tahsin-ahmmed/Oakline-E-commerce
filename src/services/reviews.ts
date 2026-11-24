import "server-only";
import { prisma, type Tx } from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { stripHtml } from "@/lib/sanitize";
import { notifyAdmins } from "@/services/notifications";

/** A customer may review a product once they have a delivered order containing it. */
export async function reviewEligibility(userId: string | null | undefined, productId: string) {
  if (!userId) return { canReview: false as const, reason: "Sign in to write a review." };
  const existing = await prisma.review.findUnique({ where: { productId_userId: { productId, userId } } });
  if (existing) return { canReview: false as const, reason: "You've already reviewed this product.", existing };
  const item = await prisma.orderItem.findFirst({
    where: { productId, order: { userId, status: { in: ["DELIVERED", "RETURNED", "REFUNDED"] } } },
    orderBy: { order: { placedAt: "desc" } },
  });
  if (!item) return { canReview: false as const, reason: "Only customers who received this product can review it." };
  return { canReview: true as const, orderItemId: item.id };
}

export async function submitReview(
  userId: string,
  input: { productId: string; rating: number; title?: string; body: string },
) {
  const product = await prisma.product.findFirst({ where: { id: input.productId, deletedAt: null }, select: { id: true, name: true } });
  if (!product) throw notFound("Product not found.");
  const eligibility = await reviewEligibility(userId, input.productId);
  if (!eligibility.canReview) {
    if ("existing" in eligibility && eligibility.existing) throw conflict(eligibility.reason);
    throw forbidden(eligibility.reason);
  }
  const body = stripHtml(input.body);
  if (body.length < 10) throw badRequest("Please write at least a sentence about the product.");
  const review = await prisma.review.create({
    data: {
      productId: input.productId,
      userId,
      orderItemId: eligibility.orderItemId,
      rating: input.rating,
      title: input.title ? stripHtml(input.title).slice(0, 120) : null,
      body: body.slice(0, 3000),
      isVerifiedPurchase: true,
      status: "PENDING",
    },
  });
  await notifyAdmins({
    type: "review.submitted",
    title: `New ${input.rating}★ review awaiting approval`,
    body: product.name,
    link: "/admin/reviews?status=PENDING",
  });
  return review;
}

/** Recalculate the denormalized rating average and count from approved reviews. */
export async function recomputeProductRating(productId: string, db: Tx | typeof prisma = prisma) {
  const agg = await db.review.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: true,
  });
  await db.product.update({
    where: { id: productId },
    data: { ratingAvg: (agg._avg.rating ?? 0).toFixed(2), reviewCount: agg._count },
  });
}

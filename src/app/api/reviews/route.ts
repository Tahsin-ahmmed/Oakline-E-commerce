import { z } from "zod";
import { route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { getReviewsForProduct } from "@/services/catalog";
import { reviewEligibility, submitReview } from "@/services/reviews";

const submitSchema = z.object({
  productId: z.string().min(1).max(40),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10, "Please write at least 10 characters").max(3000),
});

/** GET /api/reviews?productId=&page= — approved reviews + whether the viewer may review. */
export const GET = route({ auth: "optional" }, async ({ query, user }) => {
  const { productId, page } = query(
    z.object({ productId: z.string().min(1).max(40), page: z.coerce.number().int().min(1).max(500).default(1) }),
  );
  const [reviews, eligibility] = await Promise.all([
    getReviewsForProduct(productId, page),
    reviewEligibility(user?.id, productId),
  ]);
  return { ...reviews, page, canReview: eligibility.canReview, reviewBlockedReason: eligibility.canReview ? null : eligibility.reason };
});

/** POST /api/reviews — verified-purchase review, held for moderation. */
export const POST = route({ auth: "user", rateLimit: RATE_LIMITS.review, rateLimitBy: "user" }, async ({ user, json }) => {
  const input = await json(submitSchema);
  const review = await submitReview(user!.id, input);
  return { id: review.id, status: review.status };
});

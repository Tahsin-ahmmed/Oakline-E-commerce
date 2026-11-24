import { route } from "@/lib/api";
import { reviewUpdateSchema } from "@/lib/validations/admin/sales";
import { deleteReview, updateReview } from "@/services/admin/reviews";

/** PATCH /api/admin/reviews/:id — moderate (status) and/or reply. */
export const PATCH = route<{ id: string }>({ auth: "staff", permission: "reviews.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(reviewUpdateSchema);
  const review = await updateReview(params.id, input, user!, ip);
  return { id: review.id, status: review.status, adminReply: review.adminReply };
});

export const DELETE = route<{ id: string }>({ auth: "staff", permission: "reviews.manage" }, async ({ params, user, ip }) => {
  await deleteReview(params.id, user!, ip);
  return { deleted: true };
});

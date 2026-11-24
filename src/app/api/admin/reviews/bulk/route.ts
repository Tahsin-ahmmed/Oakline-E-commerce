import { route } from "@/lib/api";
import { reviewBulkSchema } from "@/lib/validations/admin/sales";
import { bulkReviewAction } from "@/services/admin/reviews";

export const POST = route({ auth: "staff", permission: "reviews.manage" }, async ({ json, user, ip }) => {
  const { ids, action } = await json(reviewBulkSchema);
  return bulkReviewAction(ids, action, user!, ip);
});

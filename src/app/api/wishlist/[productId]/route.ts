import { route } from "@/lib/api";
import { getWishlistProductIds, removeFromWishlist } from "@/services/wishlist";

export const DELETE = route<{ productId: string }>({ auth: "user" }, async ({ user, params }) => {
  await removeFromWishlist(user!.id, params.productId);
  return getWishlistProductIds(user!.id);
});

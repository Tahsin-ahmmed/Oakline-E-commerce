import { z } from "zod";
import { route } from "@/lib/api";
import { addToWishlist, getWishlistProductIds, getWishlistProducts } from "@/services/wishlist";

/** GET /api/wishlist (?ids=1 for just the product ids). Signed-out visitors get an empty list. */
export const GET = route({ auth: "optional" }, async ({ user, req }) => {
  if (!user) return [];
  if (req.nextUrl.searchParams.get("ids")) return getWishlistProductIds(user.id);
  return getWishlistProducts(user.id);
});

export const POST = route({ auth: "user" }, async ({ user, json }) => {
  const { productId } = await json(z.object({ productId: z.string().min(1).max(40) }));
  await addToWishlist(user!.id, productId);
  return getWishlistProductIds(user!.id);
});

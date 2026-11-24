import { route } from "@/lib/api";
import { getCartView, removeCartItem } from "@/services/cart";

/** DELETE /api/cart/items/:id — remove an item from the cart. */
export const DELETE = route<{ id: string }>({ auth: "optional" }, async ({ params }) => {
  await removeCartItem(params.id);
  return getCartView();
});

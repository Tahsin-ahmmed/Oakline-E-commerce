import { route } from "@/lib/api";
import { cartAddSchema, cartUpdateSchema } from "@/lib/validations/checkout";
import { addToCart, getCartView, updateCartItem } from "@/services/cart";

/** GET /api/cart — the current cart, priced and stock-checked on the server. */
export const GET = route({ auth: "optional" }, async () => getCartView());

/** POST /api/cart — add an item. Body: { productId, variantId?, quantity } */
export const POST = route({ auth: "optional" }, async ({ json }) => {
  const input = await json(cartAddSchema);
  await addToCart(input.productId, input.variantId, input.quantity);
  return getCartView();
});

/** PATCH /api/cart — change an item's quantity (0 removes). Body: { itemId, quantity } */
export const PATCH = route({ auth: "optional" }, async ({ json }) => {
  const input = await json(cartUpdateSchema);
  await updateCartItem(input.itemId, input.quantity);
  return getCartView();
});

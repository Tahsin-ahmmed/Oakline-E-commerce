import { z } from "zod";
import { route } from "@/lib/api";
import { getProductsByIds, listingFiltersSchema, listProducts } from "@/services/catalog";
import { notFound } from "@/lib/errors";

/**
 * GET /api/products — filtered, sorted, paginated catalog listing.
 * GET /api/products?ids=a,b,c — product cards by id (recently viewed, wishlist widgets).
 */
export const GET = route({ auth: "none" }, async ({ req, query }) => {
  const ids = req.nextUrl.searchParams.get("ids");
  if (ids) {
    const list = z.array(z.string().min(1).max(40)).max(24).parse(ids.split(",").filter(Boolean));
    return getProductsByIds(list);
  }
  const filters = query(listingFiltersSchema);
  const result = await listProducts(filters);
  if (result.notFound) throw notFound("Category not found.");
  return result;
});

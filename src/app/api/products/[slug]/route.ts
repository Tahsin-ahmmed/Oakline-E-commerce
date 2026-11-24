import { route } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getProductBySlug } from "@/services/catalog";

export const GET = route<{ slug: string }>({ auth: "none" }, async ({ params }) => {
  const product = await getProductBySlug(params.slug);
  if (!product) throw notFound("Product not found.");
  return product;
});

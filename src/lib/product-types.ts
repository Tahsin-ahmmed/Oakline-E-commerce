import { slugify } from "@/lib/slug";

/**
 * "Product types" are subcategory names shared across top-level departments
 * (e.g. Men › Sunglasses and Women › Sunglasses → type "sunglasses").
 * They power cross-department navigation like /products?type=sunglasses, and are derived
 * from the live category tree — adding a "Watches" subcategory in the admin adds the type automatically.
 */
export interface ProductType {
  slug: string;
  name: string;
  imageUrl: string | null;
}

interface TreeLike {
  children: { name: string; slug: string; imageUrl?: string | null }[];
}

export function productTypesFromTree(tree: TreeLike[]): ProductType[] {
  const seen = new Map<string, ProductType>();
  for (const parent of tree) {
    for (const child of parent.children) {
      const slug = slugify(child.name);
      if (!slug) continue;
      const existing = seen.get(slug);
      if (!existing) seen.set(slug, { slug, name: child.name, imageUrl: child.imageUrl ?? null });
      else if (!existing.imageUrl && child.imageUrl) existing.imageUrl = child.imageUrl;
    }
  }
  return [...seen.values()];
}

export function findProductType(tree: TreeLike[], slug: string | undefined | null) {
  if (!slug) return null;
  return productTypesFromTree(tree).find((t) => t.slug === slug) ?? null;
}

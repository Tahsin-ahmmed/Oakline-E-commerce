import type { CategoryNode } from "@/services/catalog";
import type { CategoryLink } from "@/components/catalog/listing-filters";

export function toCategoryLinks(tree: CategoryNode[]): CategoryLink[] {
  return tree.map((c) => ({ name: c.name, slug: c.slug, children: c.children.map((s) => ({ name: s.name, slug: s.slug })) }));
}

export type PageSearchParams = Record<string, string | string[] | undefined>;

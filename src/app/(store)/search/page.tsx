import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getCategoryTree, getProductsBySource, listProducts, parseListingFilters } from "@/services/catalog";
import { ProductListing } from "@/components/catalog/product-listing";
import { ProductGrid } from "@/components/products/product-card";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { toCategoryLinks, type PageSearchParams } from "@/components/catalog/category-links";

type Props = { searchParams: Promise<PageSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  return { title: q ? `Search: ${q}` : "Search", robots: { index: false, follow: true } };
}

function SearchForm({ q }: { q: string }) {
  return (
    <form action="/search" role="search" className="relative mt-6 max-w-xl">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
      <label htmlFor="search-page-q" className="sr-only">
        Search products
      </label>
      <input
        id="search-page-q"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Search products, brands, categories…"
        className="h-12 w-full rounded-full border border-input bg-card pr-28 pl-11 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
      />
      <button type="submit" className="absolute top-1.5 right-1.5 h-9 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/85">
        Search
      </button>
    </form>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const tree = await getCategoryTree();

  if (!q) {
    const popular = await getProductsBySource("best_sellers", 8);
    return (
      <div className="container-page py-10">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Search" }]} />
        <h1 className="mt-6 font-heading text-4xl sm:text-5xl">Search</h1>
        <SearchForm q="" />
        <div className="mt-8 flex flex-wrap gap-2">
          {tree.map((c) => (
            <Link key={c.id} href={`/categories/${c.slug}`} className="rounded-full border bg-card px-4 py-1.5 text-sm hover:border-foreground/40">
              {c.name}
            </Link>
          ))}
        </div>
        <h2 className="mt-16 mb-8 font-heading text-2xl">Popular right now</h2>
        <ProductGrid products={popular} />
      </div>
    );
  }

  const filters = parseListingFilters({ ...sp, q });
  const result = await listProducts(filters);
  const total = result.notFound ? 0 : result.total;

  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Search" }]} />
      <h1 className="mt-6 font-heading text-3xl sm:text-4xl">
        {total} result{total === 1 ? "" : "s"} for “{q}”
      </h1>
      <SearchForm q={q} />
      <div className="mt-10">
        {result.notFound ? null : (
          <ProductListing
            products={result.products}
            total={result.total}
            page={result.page}
            totalPages={result.totalPages}
            basePath="/search"
            searchParams={sp}
            config={{ facets: result.facets, categories: toCategoryLinks(tree), categoryMode: "param", activeCategory: filters.category ?? null }}
            clearHref={`/search?q=${encodeURIComponent(q)}`}
            emptyTitle={`Nothing found for “${q}”`}
            emptyDescription="Check the spelling, use fewer words, or browse our categories."
          />
        )}
      </div>
    </div>
  );
}

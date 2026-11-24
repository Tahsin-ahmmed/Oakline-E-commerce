import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryTree, listProducts, parseListingFilters } from "@/services/catalog";
import { ProductListing } from "@/components/catalog/product-listing";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { toCategoryLinks, type PageSearchParams } from "@/components/catalog/category-links";

type Props = { searchParams: Promise<PageSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const title = sp.onSale ? "Sale" : sp.sort === "newest" ? "New arrivals" : "Shop all";
  return {
    title,
    description: "Browse home decor, kitchenware, bags, watches and lifestyle essentials.",
    alternates: { canonical: "/products" },
  };
}

export default async function ProductsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters = parseListingFilters(sp);
  const [result, tree] = await Promise.all([listProducts(filters), getCategoryTree()]);
  if (result.notFound) notFound();
  const heading = filters.onSale ? "Sale" : filters.sort === "newest" ? "New arrivals" : "Shop all";
  const intro = filters.onSale
    ? "Limited-time prices on pieces made to last."
    : "Considered goods for every room and every day — designed to be used and loved for years.";

  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: heading }]} />
      <header className="mt-6 mb-10 max-w-2xl">
        <h1 className="font-heading text-4xl sm:text-5xl">{heading}</h1>
        <p className="mt-3 text-muted-foreground">{intro}</p>
      </header>
      <ProductListing
        products={result.products}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        basePath="/products"
        searchParams={sp}
        config={{ facets: result.facets, categories: toCategoryLinks(tree), categoryMode: "param", activeCategory: filters.category ?? null }}
      />
    </div>
  );
}

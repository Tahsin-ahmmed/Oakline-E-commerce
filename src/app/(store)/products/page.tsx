import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryTree, listProducts, parseListingFilters } from "@/services/catalog";
import { ProductListing } from "@/components/catalog/product-listing";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { toCategoryLinks, type PageSearchParams } from "@/components/catalog/category-links";
import { findProductType } from "@/lib/product-types";

type Props = { searchParams: Promise<PageSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const type = typeof sp.type === "string" ? findProductType(await getCategoryTree(), sp.type) : null;
  const title = type ? `${type.name} for Men & Women` : sp.onSale ? "Sale" : sp.sort === "newest" ? "New arrivals" : "Shop all";
  return {
    title,
    description: type
      ? `Shop ${type.name.toLowerCase()} for men and women at Ezyza. Cash on delivery across Bangladesh.`
      : "Shop sunglasses, footwear, bags, belts, wallets, shirts, shorts and underwear for men and women.",
    alternates: { canonical: type ? `/products?type=${type.slug}` : "/products" },
  };
}

export default async function ProductsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters = parseListingFilters(sp);
  const [result, tree] = await Promise.all([listProducts(filters), getCategoryTree()]);
  if (result.notFound) notFound();
  const type = result.productType;
  const heading = type ? type.name : filters.onSale ? "Sale" : filters.sort === "newest" ? "New arrivals" : "Shop all";
  const intro = type
    ? `${type.name} for men and women — browse both edits in one place.`
    : filters.onSale
      ? "Limited-time prices on wardrobe favourites."
      : "Sunglasses, footwear, bags and everyday essentials for men and women.";

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

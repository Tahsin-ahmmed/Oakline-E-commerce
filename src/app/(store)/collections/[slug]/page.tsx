import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryTree, listProducts, parseListingFilters } from "@/services/catalog";
import { getCollectionBySlug } from "@/services/homepage";
import { SmartImage } from "@/components/shared/smart-image";
import { ProductListing } from "@/components/catalog/product-listing";
import { Breadcrumbs } from "@/components/catalog/breadcrumbs";
import { toCategoryLinks, type PageSearchParams } from "@/components/catalog/category-links";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<PageSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.name,
    description: collection.description ?? undefined,
    alternates: { canonical: `/collections/${collection.slug}` },
    openGraph: collection.imageUrl ? { images: [{ url: collection.imageUrl }] } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();
  const filters = parseListingFilters({ ...sp, collection: collection.slug });
  const [result, tree] = await Promise.all([listProducts(filters), getCategoryTree()]);
  if (result.notFound) notFound();

  return (
    <div>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        {collection.imageUrl && (
          <>
            <SmartImage src={collection.imageUrl} alt="" fill priority sizes="100vw" className="object-cover opacity-60" />
            <div className="absolute inset-0 bg-black/35" />
          </>
        )}
        <div className="container-page relative py-20 sm:py-28">
          <div className="[&_a]:text-white/80 [&_a:hover]:text-white [&_span]:text-white/90 [&_svg]:text-white/60">
            <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Collections", href: "/products" }, { name: collection.name }]} />
          </div>
          <p className="mt-6 text-[0.72rem] font-semibold tracking-[0.25em] text-white/80 uppercase">Collection</p>
          <h1 className="mt-3 max-w-2xl font-heading text-4xl text-white sm:text-6xl">{collection.name}</h1>
          {collection.description && <p className="mt-4 max-w-xl text-white/85">{collection.description}</p>}
        </div>
      </section>
      <div className="container-page py-10">
        <ProductListing
          products={result.products}
          total={result.total}
          page={result.page}
          totalPages={result.totalPages}
          basePath={`/collections/${collection.slug}`}
          searchParams={sp}
          config={{ facets: result.facets, categories: toCategoryLinks(tree), categoryMode: "param", activeCategory: filters.category ?? null }}
        />
      </div>
    </div>
  );
}

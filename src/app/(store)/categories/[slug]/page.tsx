import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryTree, listProducts, parseListingFilters } from "@/services/catalog";
import { SmartImage } from "@/components/shared/smart-image";
import { ProductListing } from "@/components/catalog/product-listing";
import { Breadcrumbs, breadcrumbJsonLd, JsonLd, type Crumb } from "@/components/catalog/breadcrumbs";
import { toCategoryLinks, type PageSearchParams } from "@/components/catalog/category-links";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<PageSearchParams> };

async function load(slug: string, sp: PageSearchParams) {
  const filters = parseListingFilters({ ...sp, category: slug });
  const [result, tree] = await Promise.all([listProducts(filters), getCategoryTree()]);
  return { result, tree, filters };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tree = await getCategoryTree();
  const node = tree.find((c) => c.slug === slug);
  const child = tree.flatMap((c) => c.children.map((s) => ({ ...s, parent: c }))).find((s) => s.slug === slug);
  if (!node && !child) return { title: "Category not found" };
  const name = node?.name ?? child!.name;
  return {
    title: name,
    description: node?.description ?? `Shop ${name} at Oakline — ${child?.parent.description ?? "considered goods for everyday living."}`,
    alternates: { canonical: `/categories/${slug}` },
    openGraph: node?.imageUrl ? { images: [{ url: node.imageUrl }] } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const { result, tree } = await load(slug, sp);
  if (result.notFound || !result.category) notFound();
  const category = result.category;
  const parentNode = tree.find((c) => c.slug === (category.parent?.slug ?? category.slug));
  const siblings = parentNode?.children ?? [];
  const image = category.imageUrl ?? (category.parent ? tree.find((c) => c.slug === category.parent!.slug)?.imageUrl : null);
  const description = category.description ?? parentNode?.description ?? null;

  const crumbs: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "Shop", href: "/products" },
    ...(category.parent ? [{ name: category.parent.name, href: `/categories/${category.parent.slug}` }] : []),
    { name: category.name, href: `/categories/${category.slug}` },
  ];
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page" && k !== "category") qs.set(k, v);
  const keep = qs.toString() ? `?${qs.toString()}` : "";

  return (
    <div>
      <JsonLd data={breadcrumbJsonLd(crumbs, base)} />
      <section className="border-b bg-secondary/40">
        <div className="container-page grid items-center gap-8 py-10 md:grid-cols-[1fr_auto] md:py-14">
          <div className="max-w-2xl">
            <Breadcrumbs items={crumbs} />
            <h1 className="mt-5 font-heading text-4xl sm:text-5xl">{category.name}</h1>
            {description && <p className="mt-3 text-muted-foreground">{description}</p>}
            {siblings.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {parentNode && (
                  <Link
                    href={`/categories/${parentNode.slug}${keep}`}
                    className={cn("rounded-full border px-4 py-1.5 text-sm transition", parentNode.slug === category.slug ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground/40")}
                  >
                    All {parentNode.name}
                  </Link>
                )}
                {siblings.map((s) => (
                  <Link
                    key={s.id}
                    href={`/categories/${s.slug}${keep}`}
                    className={cn("rounded-full border px-4 py-1.5 text-sm transition", s.slug === category.slug ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground/40")}
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {image && (
            <div className="relative hidden aspect-[4/3] w-80 overflow-hidden rounded-lg md:block lg:w-96">
              <SmartImage src={image} alt="" fill sizes="384px" className="object-cover" priority />
            </div>
          )}
        </div>
      </section>
      <div className="container-page py-10">
        <ProductListing
          products={result.products}
          total={result.total}
          page={result.page}
          totalPages={result.totalPages}
          basePath={`/categories/${category.slug}`}
          searchParams={sp}
          config={{ facets: result.facets, categories: toCategoryLinks(tree), categoryMode: "path", activeCategory: category.slug }}
          emptyTitle={`No ${category.name.toLowerCase()} match these filters`}
        />
      </div>
    </div>
  );
}

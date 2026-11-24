import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/services/catalog";
import { getSettings } from "@/services/settings";
import { sanitizeRichText, stripHtml } from "@/lib/sanitize";
import { ProductView } from "@/components/products/product-view";
import { ProductReviews } from "@/components/products/product-reviews";
import { RecentlyViewed } from "@/components/products/recently-viewed";
import { ProductGrid } from "@/components/products/product-card";
import { Breadcrumbs, breadcrumbJsonLd, JsonLd, type Crumb } from "@/components/catalog/breadcrumbs";

type Props = { params: Promise<{ slug: string }> };

const BASE = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const description = product.seoDescription ?? product.shortDescription ?? stripHtml(product.description).slice(0, 160);
  const image = product.images[0]?.url;
  return {
    title: product.seoTitle?.replace(/\s*\|\s*Oakline$/i, "") ?? product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: `/products/${product.slug}`,
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: { card: "summary_large_image", title: product.name, description, images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [related, settings] = await Promise.all([getRelatedProducts(product.id, product.category.id, 4), getSettings()]);

  const crumbs: Crumb[] = [
    { name: "Home", href: "/" },
    ...(product.category.parent ? [{ name: product.category.parent.name, href: `/categories/${product.category.parent.slug}` }] : []),
    { name: product.category.name, href: `/categories/${product.category.slug}` },
    { name: product.name, href: `/products/${product.slug}` },
  ];

  const base = BASE();
  const inStock = product.variants.some((v) => v.available > 0);
  const prices = product.variants.map((v) => Number(v.salePrice ?? v.price));
  const lowPrice = prices.length ? Math.min(...prices) : Number(product.salePrice ?? product.price);
  const highPrice = prices.length ? Math.max(...prices) : lowPrice;
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.shortDescription ?? stripHtml(product.description).slice(0, 500),
    image: product.images.map((i) => i.url),
    url: `${base}/products/${product.slug}`,
    category: product.category.name,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
    offers:
      lowPrice === highPrice
        ? {
            "@type": "Offer",
            url: `${base}/products/${product.slug}`,
            priceCurrency: settings.general.currency,
            price: lowPrice.toFixed(2),
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          }
        : {
            "@type": "AggregateOffer",
            priceCurrency: settings.general.currency,
            lowPrice: lowPrice.toFixed(2),
            highPrice: highPrice.toFixed(2),
            offerCount: product.variants.length,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
    ...(product.reviewCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating.toFixed(1), reviewCount: product.reviewCount } }
      : {}),
  };

  return (
    <div className="container-page py-8">
      <JsonLd data={productLd} />
      <JsonLd data={breadcrumbJsonLd(crumbs, base)} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-6">
        <ProductView
          product={product}
          descriptionHtml={sanitizeRichText(product.description)}
          shippingInfo={settings.policies.shippingInfo}
          returnInfo={settings.policies.returnInfo}
          returnWindowDays={settings.commerce.returnWindowDays}
        />
      </div>
      <div className="mt-20">
        <ProductReviews productId={product.id} rating={product.rating} reviewCount={product.reviewCount} />
      </div>
      {related.length > 0 && (
        <section className="border-t py-16" aria-labelledby="related-heading">
          <h2 id="related-heading" className="mb-8 font-heading text-3xl">
            You may also like
          </h2>
          <ProductGrid products={related} />
        </section>
      )}
      <RecentlyViewed productId={product.id} />
    </div>
  );
}

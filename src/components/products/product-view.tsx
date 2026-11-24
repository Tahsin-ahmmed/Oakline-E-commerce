"use client";

import Link from "next/link";
import { useState } from "react";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RatingStars } from "@/components/shared/rating-stars";
import { AddToCartPanel } from "@/components/products/add-to-cart-panel";
import { ProductGallery } from "@/components/products/product-gallery";
import type { ProductDetail } from "@/services/catalog";

type Variant = ProductDetail["variants"][number];

export function ProductView({
  product,
  descriptionHtml,
  shippingInfo,
  returnInfo,
  returnWindowDays,
}: {
  product: ProductDetail;
  descriptionHtml: string;
  shippingInfo: string;
  returnInfo: string;
  returnWindowDays: number;
}) {
  const initial = product.variants.find((v) => v.isDefault && v.available > 0) ?? product.variants.find((v) => v.available > 0) ?? product.variants[0] ?? null;
  const [variant, setVariant] = useState<Variant | null>(initial);
  const sku = variant?.sku ?? product.sku;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
      <div className="lg:sticky lg:top-32 lg:self-start">
        <ProductGallery images={product.images} activeUrl={variant?.imageUrl ?? null} name={product.name} />
      </div>

      <div>
        {product.brand && (
          <Link href={`/products?brand=${product.brand.slug}`} className="eyebrow hover:text-foreground">
            {product.brand.name}
          </Link>
        )}
        <h1 className="mt-3 font-heading text-3xl leading-tight sm:text-[2.6rem]">{product.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {product.reviewCount > 0 ? (
            <a href="#reviews" className="flex items-center gap-2 hover:text-foreground">
              <RatingStars rating={product.rating} />
              <span>
                {product.rating.toFixed(1)} · {product.reviewCount} review{product.reviewCount === 1 ? "" : "s"}
              </span>
            </a>
          ) : (
            <a href="#reviews" className="hover:text-foreground">
              No reviews yet
            </a>
          )}
          <span>
            SKU: <span className="font-mono text-xs text-foreground/80" data-testid="product-sku">{sku}</span>
          </span>
        </div>
        {product.shortDescription && <p className="mt-6 text-[1.02rem] leading-7 text-foreground/80">{product.shortDescription}</p>}

        <div className="mt-8 border-t pt-8">
          <AddToCartPanel product={product} onVariantChange={setVariant} />
        </div>

        <ul className="mt-8 grid gap-3 rounded-lg bg-secondary/50 p-5 text-sm sm:grid-cols-3 sm:gap-4">
          <li className="flex items-start gap-2.5">
            <Truck className="mt-0.5 size-4 shrink-0" /> Fast nationwide delivery
          </li>
          <li className="flex items-start gap-2.5">
            <RotateCcw className="mt-0.5 size-4 shrink-0" /> {returnWindowDays}-day returns
          </li>
          <li className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Cash on delivery available
          </li>
        </ul>

        <Accordion type="multiple" defaultValue={["description"]} className="mt-8 border-t">
          <AccordionItem value="description">
            <AccordionTrigger className="py-5 text-[0.95rem] font-medium hover:no-underline">Description</AccordionTrigger>
            <AccordionContent>
              {descriptionHtml ? (
                <div className="prose-oak" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
              ) : (
                <p className="text-sm text-muted-foreground">No description available.</p>
              )}
            </AccordionContent>
          </AccordionItem>
          {product.specifications.length > 0 && (
            <AccordionItem value="specs">
              <AccordionTrigger className="py-5 text-[0.95rem] font-medium hover:no-underline">Specifications</AccordionTrigger>
              <AccordionContent>
                <dl className="divide-y rounded-lg border bg-card text-sm">
                  {product.specifications.map((s) => (
                    <div key={s.name} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 px-4 py-3">
                      <dt className="text-muted-foreground">{s.name}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 px-4 py-3">
                    <dt className="text-muted-foreground">SKU</dt>
                    <dd className="font-mono text-xs">{sku}</dd>
                  </div>
                </dl>
              </AccordionContent>
            </AccordionItem>
          )}
          <AccordionItem value="shipping">
            <AccordionTrigger className="py-5 text-[0.95rem] font-medium hover:no-underline">Shipping information</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm leading-6 text-foreground/80">
              <p>{shippingInfo}</p>
              <Link href="/shipping-policy" className="underline underline-offset-4">
                Read our shipping policy
              </Link>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="returns">
            <AccordionTrigger className="py-5 text-[0.95rem] font-medium hover:no-underline">Returns & refunds</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm leading-6 text-foreground/80">
              <p>{returnInfo}</p>
              <p>You can request a return from your account within {returnWindowDays} days of delivery.</p>
              <Link href="/returns-policy" className="underline underline-offset-4">
                Read our return policy
              </Link>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, Loader2, Plus } from "lucide-react";
import { Price } from "@/components/shared/price";
import { RatingStars } from "@/components/shared/rating-stars";
import { SmartImage } from "@/components/shared/smart-image";
import { WishlistButton } from "@/components/products/wishlist-button";
import { QuickView } from "@/components/products/quick-view";
import { useAddToCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import type { ProductCardDTO } from "@/services/catalog";

export function ProductCard({ product, priority, className }: { product: ProductCardDTO; priority?: boolean; className?: string }) {
  const [quickView, setQuickView] = useState(false);
  const add = useAddToCart({ openDrawer: true });
  const needsOptions = product.hasVariants;

  return (
    <article className={cn("group relative flex flex-col", className)} data-testid="product-card">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
        <Link href={`/products/${product.slug}`} aria-label={product.name} className="absolute inset-0">
          {product.image ? (
            <>
              <SmartImage
                src={product.image}
                alt={product.imageAlt}
                fill
                priority={priority}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={cn("object-cover transition duration-700 ease-out group-hover:scale-[1.03]", product.hoverImage && "group-hover:opacity-0")}
              />
              {product.hoverImage && (
                <SmartImage
                  src={product.hoverImage}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover opacity-0 transition duration-700 ease-out group-hover:scale-[1.03] group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">No image</div>
          )}
        </Link>

        <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1.5">
          {product.discountPercent > 0 && (
            <span className="rounded-full bg-clay px-2.5 py-1 text-[0.68rem] font-semibold text-clay-foreground">-{product.discountPercent}%</span>
          )}
          {product.isNew && product.discountPercent === 0 && (
            <span className="rounded-full bg-card px-2.5 py-1 text-[0.68rem] font-semibold">New</span>
          )}
          {!product.inStock && <span className="rounded-full bg-foreground/80 px-2.5 py-1 text-[0.68rem] font-semibold text-background">Sold out</span>}
        </div>

        <WishlistButton productId={product.id} productName={product.name} className="absolute top-3 right-3" />

        <div className="absolute inset-x-3 bottom-3 flex translate-y-2 gap-2 opacity-0 transition duration-300 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 max-lg:translate-y-0 max-lg:opacity-100">
          <button
            type="button"
            onClick={() => setQuickView(true)}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-card/95 text-xs font-medium shadow-sm backdrop-blur transition hover:bg-card max-lg:hidden"
          >
            <Eye className="size-3.5" /> Quick view
          </button>
          {product.inStock && (
            <button
              type="button"
              onClick={() =>
                needsOptions
                  ? setQuickView(true)
                  : product.defaultVariantId && add.mutate({ productId: product.id, variantId: product.defaultVariantId, quantity: 1 })
              }
              disabled={add.isPending}
              className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary/85 max-lg:ml-auto max-lg:size-9 max-lg:px-0"
              aria-label={needsOptions ? `Choose options for ${product.name}` : `Add ${product.name} to bag`}
            >
              {add.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              <span className="max-lg:sr-only">{needsOptions ? "Options" : "Add"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-3.5 flex flex-1 flex-col gap-1">
        {product.brand && <p className="text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase">{product.brand}</p>}
        <h3 className="font-sans text-[0.92rem] leading-snug font-normal tracking-normal">
          <Link href={`/products/${product.slug}`} className="hover:underline hover:underline-offset-4">
            {product.name}
          </Link>
        </h3>
        {product.reviewCount > 0 && <RatingStars rating={product.rating} count={product.reviewCount} size={12} />}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <Price price={product.price} salePrice={product.salePrice} size="sm" />
          {product.colors.length > 1 && (
            <div className="flex -space-x-1" aria-label={`${product.colors.length} colours`}>
              {product.colors.slice(0, 4).map((c) => (
                <span key={c.name} title={c.name} className="size-3.5 rounded-full border border-card ring-1 ring-black/10" style={{ backgroundColor: c.hex ?? "#ccc" }} />
              ))}
            </div>
          )}
        </div>
        {product.inStock && product.lowStock && <p className="text-xs text-warning">Only a few left</p>}
      </div>
      {quickView && <QuickView slug={product.slug} open={quickView} onOpenChange={setQuickView} />}
    </article>
  );
}

export function ProductGrid({ products, className, priorityCount = 0 }: { products: ProductCardDTO[]; className?: string; priorityCount?: number }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-[4/5] animate-pulse rounded-lg bg-muted" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

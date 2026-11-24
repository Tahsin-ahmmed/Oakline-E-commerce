"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingStars } from "@/components/shared/rating-stars";
import { SmartImage } from "@/components/shared/smart-image";
import { AddToCartPanel } from "@/components/products/add-to-cart-panel";
import { api } from "@/lib/api-client";
import type { ProductDetail } from "@/services/catalog";

export function QuickView({ slug, open, onOpenChange }: { slug: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api<ProductDetail>(`/api/products/${slug}`),
    enabled: open,
  });
  const [image, setImage] = useState<string | null>(null);
  const shown = image ?? product?.images[0]?.url ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-4xl">
        {isLoading || !product ? (
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <DialogTitle className="sr-only">Loading product</DialogTitle>
            {isError ? (
              <p className="text-sm text-muted-foreground">This product could not be loaded.</p>
            ) : (
              <>
                <Skeleton className="aspect-square w-full" />
                <div className="space-y-3">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2">
            <div className="bg-muted">
              <div className="relative aspect-square">
                {shown && <SmartImage src={shown} alt={product.name} fill sizes="(max-width:768px) 100vw, 450px" className="object-cover" />}
              </div>
              {product.images.length > 1 && (
                <div className="flex gap-2 p-3">
                  {product.images.slice(0, 5).map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setImage(img.url)}
                      className="relative size-14 overflow-hidden rounded border-2 border-transparent data-[active=true]:border-foreground"
                      data-active={shown === img.url}
                      aria-label="Show image"
                    >
                      <SmartImage src={img.url} alt="" fill sizes="56px" className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 md:p-8">
              {product.brand && <p className="eyebrow">{product.brand.name}</p>}
              <DialogTitle className="mt-2 font-heading text-2xl font-normal">{product.name}</DialogTitle>
              {product.reviewCount > 0 && <RatingStars rating={product.rating} count={product.reviewCount} className="mt-2" />}
              <DialogDescription className="mt-3 text-sm leading-6">{product.shortDescription}</DialogDescription>
              <div className="mt-6">
                <AddToCartPanel
                  product={product}
                  compact
                  onVariantChange={(v) => v?.imageUrl && setImage(v.imageUrl)}
                  onAdded={() => onOpenChange(false)}
                />
              </div>
              <Link href={`/products/${product.slug}`} className="mt-6 inline-block text-sm underline underline-offset-4" onClick={() => onOpenChange(false)}>
                View full details
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

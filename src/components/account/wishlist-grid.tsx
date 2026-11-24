"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Price } from "@/components/shared/price";
import { SmartImage } from "@/components/shared/smart-image";
import { QuickView } from "@/components/products/quick-view";
import { useAddToCart } from "@/hooks/use-cart";
import { WISHLIST_IDS_KEY } from "@/hooks/use-wishlist";
import { api, errorMessage } from "@/lib/api-client";
import type { ProductCardDTO } from "@/services/catalog";

export function WishlistGrid({ initial }: { initial: ProductCardDTO[] }) {
  const qc = useQueryClient();
  const { data: products = initial } = useQuery({
    queryKey: ["wishlist-products"],
    queryFn: () => api<ProductCardDTO[]>("/api/wishlist"),
    initialData: initial,
  });
  const add = useAddToCart({ openDrawer: true });
  const [busy, setBusy] = useState<string | null>(null);
  const [quickView, setQuickView] = useState<string | null>(null);

  const remove = async (productId: string, silent = false) => {
    const ids = await api<string[]>(`/api/wishlist/${productId}`, { method: "DELETE" });
    qc.setQueryData(WISHLIST_IDS_KEY, ids);
    qc.setQueryData<ProductCardDTO[]>(["wishlist-products"], (prev) => (prev ?? []).filter((p) => p.id !== productId));
    if (!silent) toast.success("Removed from your wishlist");
  };

  const moveToBag = async (p: ProductCardDTO) => {
    if (p.hasVariants || !p.defaultVariantId) {
      setQuickView(p.slug);
      return;
    }
    setBusy(p.id);
    try {
      await add.mutateAsync({ productId: p.id, variantId: p.defaultVariantId, quantity: 1 });
      await remove(p.id, true);
    } catch {
      /* add-to-cart errors are toasted by the hook */
    } finally {
      setBusy(null);
    }
  };

  if (!products.length) {
    return (
      <EmptyState
        icon={Heart}
        title="Your wishlist is empty"
        description="Tap the heart on any product to save it for later."
        action={
          <Button asChild>
            <Link href="/products">Discover products</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => (
          <li key={p.id} className="flex flex-col">
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
              <Link href={`/products/${p.slug}`} className="absolute inset-0" aria-label={p.name}>
                {p.image && <SmartImage src={p.image} alt={p.imageAlt} fill sizes="(max-width:768px) 50vw, 25vw" className="object-cover" />}
              </Link>
              <button
                type="button"
                onClick={() => remove(p.id).catch((e) => toast.error(errorMessage(e)))}
                className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-card/90 shadow-sm hover:bg-card"
                aria-label={`Remove ${p.name} from wishlist`}
              >
                <X className="size-4" />
              </button>
              {!p.inStock && (
                <span className="absolute top-3 left-3 rounded-full bg-foreground/80 px-2.5 py-1 text-[0.68rem] font-semibold text-background">Sold out</span>
              )}
            </div>
            <div className="mt-3 flex flex-1 flex-col gap-1">
              {p.brand && <p className="text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase">{p.brand}</p>}
              <Link href={`/products/${p.slug}`} className="text-[0.92rem] hover:underline">
                {p.name}
              </Link>
              <Price price={p.price} salePrice={p.salePrice} size="sm" />
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={!p.inStock || busy === p.id}
                onClick={() => moveToBag(p)}
              >
                {busy === p.id ? <Loader2 className="animate-spin" /> : <ShoppingBag />}
                {p.inStock ? (p.hasVariants ? "Choose options" : "Move to bag") : "Out of stock"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {quickView && <QuickView slug={quickView} open onOpenChange={(o) => !o && setQuickView(null)} />}
    </>
  );
}

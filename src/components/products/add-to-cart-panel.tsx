"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShoppingBag, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/shared/price";
import { QuantityInput } from "@/components/cart/quantity-input";
import { WishlistButton } from "@/components/products/wishlist-button";
import { useAddToCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import type { ProductDetail } from "@/services/catalog";

type Variant = ProductDetail["variants"][number];

function unique<T>(arr: (T | null)[]) {
  return [...new Set(arr.filter((x): x is T => x !== null))];
}

/** Variant selection + stock-validated quantity + Add to bag / Buy now. Used on the PDP and in Quick View. */
export function AddToCartPanel({
  product,
  onVariantChange,
  onAdded,
  compact,
}: {
  product: Pick<ProductDetail, "id" | "name" | "variants" | "hasVariants" | "price" | "salePrice">;
  onVariantChange?: (variant: Variant | null) => void;
  onAdded?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const variants = product.variants;
  const colors = unique(variants.map((v) => v.color));
  const sizes = unique(variants.map((v) => v.size));
  const initial = variants.find((v) => v.isDefault && v.available > 0) ?? variants.find((v) => v.available > 0) ?? variants[0];
  const [color, setColor] = useState<string | null>(colors.length ? (initial?.color ?? null) : null);
  const [size, setSize] = useState<string | null>(sizes.length ? (initial?.size ?? null) : null);
  const [qty, setQty] = useState(1);
  const add = useAddToCart({ openDrawer: true });
  const [buying, setBuying] = useState(false);

  const selected: Variant | null = useMemo(() => {
    if (!product.hasVariants || variants.length === 1) return variants[0] ?? null;
    return (
      variants.find((v) => (colors.length ? v.color === color : true) && (sizes.length ? v.size === size : true)) ?? null
    );
  }, [product.hasVariants, variants, colors.length, sizes.length, color, size]);

  const choose = (next: { color?: string | null; size?: string | null }) => {
    const c = next.color !== undefined ? next.color : color;
    const s = next.size !== undefined ? next.size : size;
    setColor(c);
    setSize(s);
    setQty(1);
    const v = variants.find((x) => (colors.length ? x.color === c : true) && (sizes.length ? x.size === s : true)) ?? null;
    onVariantChange?.(v);
  };

  const available = selected?.available ?? 0;
  const maxQty = Math.max(1, Math.min(99, available));
  const canBuy = Boolean(selected) && available > 0;
  const needsSelection = product.hasVariants && !selected;

  const submit = async (buyNow: boolean) => {
    if (!selected) return;
    if (buyNow) setBuying(true);
    try {
      await add.mutateAsync({ productId: product.id, variantId: selected.id, quantity: qty });
      onAdded?.();
      if (buyNow) router.push("/checkout");
    } catch {
      /* toast already shown */
    } finally {
      setBuying(false);
    }
  };

  const sizeAvailable = (s: string) =>
    variants.some((v) => v.size === s && (colors.length ? v.color === color : true) && v.available > 0);
  const colorAvailable = (c: string) => variants.some((v) => v.color === c && v.available > 0);

  return (
    <div className={cn("space-y-6", compact && "space-y-5")}>
      <Price
        price={selected?.price ?? product.price}
        salePrice={selected ? selected.salePrice : product.salePrice}
        size="lg"
      />

      {colors.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-sm">
            Colour: <span className="font-medium">{color ?? "Select"}</span>
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {colors.map((c) => {
              const hex = variants.find((v) => v.color === c)?.colorHex;
              const active = c === color;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => choose({ color: c })}
                  aria-pressed={active}
                  aria-label={c}
                  title={c}
                  className={cn(
                    "relative flex h-10 items-center gap-2 rounded-full border px-3 text-sm transition",
                    active ? "border-foreground ring-1 ring-foreground" : "hover:border-foreground/50",
                    !colorAvailable(c) && "opacity-50",
                  )}
                >
                  {hex && <span className="size-5 rounded-full border border-black/10" style={{ backgroundColor: hex }} />}
                  <span>{c}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {sizes.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-sm">
            {sizes.every((s) => /^\d/.test(s) || /g$|mm$/.test(s)) ? "Size" : "Option"}:{" "}
            <span className="font-medium">{size ?? "Select"}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const active = s === size;
              const ok = sizeAvailable(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => choose({ size: s })}
                  aria-pressed={active}
                  className={cn(
                    "h-10 min-w-14 rounded-md border px-4 text-sm transition",
                    active ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground/50",
                    !ok && !active && "text-muted-foreground line-through decoration-1",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="text-sm" aria-live="polite">
        {needsSelection ? (
          <span className="text-muted-foreground">This combination isn&apos;t available — try another option.</span>
        ) : available <= 0 ? (
          <span className="font-medium text-destructive">Out of stock</span>
        ) : selected?.stockState === "LOW_STOCK" ? (
          <span className="font-medium text-warning">Only {available} left — order soon</span>
        ) : (
          <span className="flex items-center gap-1.5 text-success">
            <Check className="size-4" /> In stock, ready to ship
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <QuantityInput value={qty} onChange={setQty} max={maxQty} disabled={!canBuy} />
        <Button
          size="lg"
          className="flex-1"
          disabled={!canBuy || add.isPending}
          onClick={() => submit(false)}
          data-testid="add-to-cart"
        >
          {add.isPending && !buying ? <Loader2 className="animate-spin" /> : <ShoppingBag />}
          {canBuy ? "Add to bag" : "Out of stock"}
        </Button>
        {!compact && <WishlistButton productId={product.id} productName={product.name} variant="button" />}
      </div>
      {!compact && canBuy && (
        <Button size="lg" variant="outline" className="w-full" disabled={add.isPending} onClick={() => submit(true)}>
          {buying ? <Loader2 className="animate-spin" /> : <Zap />} Buy now
        </Button>
      )}
    </div>
  );
}

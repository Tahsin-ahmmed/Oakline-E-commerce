"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToggleWishlist, useWishlistIds } from "@/hooks/use-wishlist";

export function WishlistButton({
  productId,
  productName,
  className,
  variant = "icon",
}: {
  productId: string;
  productName: string;
  className?: string;
  variant?: "icon" | "button";
}) {
  const { data: ids = [] } = useWishlistIds();
  const { toggle, isPending } = useToggleWishlist();
  const saved = ids.includes(productId);
  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={() => toggle(productId, saved)}
        disabled={isPending}
        aria-pressed={saved}
        className={cn(
          "inline-flex h-12 items-center justify-center gap-2 rounded-md border bg-card px-5 text-sm font-medium transition hover:bg-secondary",
          className,
        )}
      >
        <Heart className={cn("size-4", saved && "fill-clay text-clay")} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId, saved);
      }}
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      className={cn(
        "flex size-9 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur transition hover:scale-105 hover:bg-card",
        className,
      )}
    >
      <Heart className={cn("size-4 transition", saved ? "fill-clay text-clay" : "text-foreground/70")} />
    </button>
  );
}

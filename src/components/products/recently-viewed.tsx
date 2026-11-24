"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductGrid } from "@/components/products/product-card";
import { api } from "@/lib/api-client";
import type { ProductCardDTO } from "@/services/catalog";

const KEY = "oak:recently-viewed";
const MAX = 12;

function parseIds(raw: string | null): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  const handler = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/** Records a product view and shows the visitor's other recently viewed products. */
export function RecentlyViewed({ productId }: { productId: string }) {
  // Raw string snapshot is referentially stable; the current product is filtered out, so recording it does not change the list.
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const ids = parseIds(raw)
    .filter((id) => id !== productId)
    .slice(0, 8);

  useEffect(() => {
    const previous = parseIds(readRaw()).filter((id) => id !== productId);
    try {
      window.localStorage.setItem(KEY, JSON.stringify([productId, ...previous].slice(0, MAX)));
    } catch {
      /* storage unavailable (private mode) — feature degrades silently */
    }
  }, [productId]);

  const { data } = useQuery({
    queryKey: ["recently-viewed", ids],
    queryFn: () => api<ProductCardDTO[]>(`/api/products?ids=${ids.map(encodeURIComponent).join(",")}`),
    enabled: ids.length > 0,
  });

  if (!data?.length) return null;
  return (
    <section className="border-t py-16" aria-labelledby="recently-viewed">
      <h2 id="recently-viewed" className="mb-8 font-heading text-3xl">
        Recently viewed
      </h2>
      <ProductGrid products={data.slice(0, 4)} />
    </section>
  );
}

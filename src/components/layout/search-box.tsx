"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Price } from "@/components/shared/price";
import { SmartImage } from "@/components/shared/smart-image";
import type { ProductCardDTO } from "@/services/catalog";

interface Suggestions {
  products: ProductCardDTO[];
  categories: { name: string; slug: string }[];
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const listId = useId();
  const debounced = useDebounced(q.trim(), 220);
  const { data, isFetching } = useQuery({
    queryKey: ["search-suggest", debounced],
    queryFn: ({ signal }) => api<Suggestions>(`/api/search?q=${encodeURIComponent(debounced)}`, { signal }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const showPanel = open && debounced.length >= 2;
  return (
    <div ref={wrapper} className="relative w-full">
      <form role="search" onSubmit={submit} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          role="combobox"
          aria-autocomplete="list"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search sunglasses, sneakers, bags…"
          aria-label="Search products"
          aria-controls={listId}
          aria-expanded={showPanel}
          autoComplete="off"
          className="h-10 w-full rounded-full border border-input bg-card pr-10 pl-10 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Clear search"
          >
            {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          </button>
        )}
      </form>
      {showPanel && (
        <div id={listId} className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover shadow-[var(--shadow-lift)]">
          {data && data.products.length === 0 && data.categories.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No matches for “{debounced}”.</p>
          ) : (
            <>
              {data?.categories.length ? (
                <div className="flex flex-wrap gap-2 border-b px-4 py-3">
                  {data.categories.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/categories/${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="rounded-full bg-secondary px-3 py-1 text-xs hover:bg-sand"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              ) : null}
              <ul className="max-h-96 overflow-y-auto py-1">
                {data?.products.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/products/${p.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary"
                    >
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                        {p.image && <SmartImage src={p.image} alt={p.imageAlt} fill sizes="48px" className="object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.category}</p>
                      </div>
                      <Price price={p.price} salePrice={p.salePrice} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={submit}
                className="w-full border-t px-4 py-3 text-left text-sm font-medium hover:bg-secondary"
              >
                See all results for “{q.trim()}” →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, SlidersHorizontal, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useStore } from "@/components/shared/store-context";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface Facets {
  brands: { slug: string; name: string; count: number }[];
  colors: { name: string; hex: string | null; count: number }[];
  sizes: { name: string; count: number }[];
  priceRange: { min: number; max: number };
}

export interface CategoryLink {
  name: string;
  slug: string;
  children: { name: string; slug: string }[];
}

export interface FilterConfig {
  facets: Facets;
  categories: CategoryLink[];
  /** "param": category is a ?category= filter; "path": category links navigate to /categories/[slug]. */
  categoryMode: "param" | "path" | "none";
  activeCategory?: string | null;
}

const SORTS = [
  ["featured", "Featured"],
  ["newest", "Newest"],
  ["price_asc", "Price: Low to High"],
  ["price_desc", "Price: High to Low"],
  ["best_selling", "Best Selling"],
  ["rating", "Highest Rated"],
] as const;

const FILTER_KEYS = ["category", "brand", "color", "size", "minPrice", "maxPrice", "availability", "rating", "onSale"];

function useListingParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const list = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const update = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete("page");
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  const set = (key: string, value: string | null) =>
    update((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
    });
  const toggle = (key: string, value: string) =>
    update((p) => {
      const cur = (p.get(key) ?? "").split(",").filter(Boolean);
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      if (next.length) p.set(key, next.join(","));
      else p.delete(key);
    });
  return { params, list, set, toggle, update, pending, pathname };
}

export function SortSelect() {
  const { params, set, pending } = useListingParams();
  return (
    <div className="flex items-center gap-2">
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
      <label htmlFor="sort" className="hidden text-sm text-muted-foreground sm:block">
        Sort by
      </label>
      <Select value={params.get("sort") ?? "featured"} onValueChange={(v) => set("sort", v === "featured" ? null : v)}>
        <SelectTrigger id="sort" className="h-10 min-w-48" aria-label="Sort products">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {SORTS.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PriceFilter({ range }: { range: Facets["priceRange"] }) {
  const { params, update } = useListingParams();
  const { currency } = useStore();
  const [min, setMin] = useState(params.get("minPrice") ?? "");
  const [max, setMax] = useState(params.get("maxPrice") ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        update((p) => {
          if (min) p.set("minPrice", String(Math.max(0, Number(min))));
          else p.delete("minPrice");
          if (max) p.set("maxPrice", String(Math.max(0, Number(max))));
          else p.delete("maxPrice");
        });
      }}
    >
      <div className="flex items-center gap-2">
        <Input type="number" min={0} inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder={String(range.min)} aria-label="Minimum price" className="h-9" />
        <span className="text-muted-foreground">–</span>
        <Input type="number" min={0} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder={String(range.max)} aria-label="Maximum price" className="h-9" />
      </div>
      <p className="text-xs text-muted-foreground">
        Range: {formatMoney(range.min, currency)} – {formatMoney(range.max, currency)}
      </p>
      <Button type="submit" variant="outline" size="sm" className="w-full">
        Apply price
      </Button>
    </form>
  );
}

function CheckRow({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: React.ReactNode; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
    </label>
  );
}

function FilterPanel({ config }: { config: FilterConfig }) {
  const { params, list, toggle, set } = useListingParams();
  const { facets } = config;
  const query = new URLSearchParams(params.toString());
  query.delete("page");
  query.delete("category");
  const qs = query.toString();
  const defaults = ["category", "price", "brand", "color", "size", "availability", "rating"];

  return (
    <Accordion type="multiple" defaultValue={defaults} className="w-full">
      {config.categoryMode !== "none" && config.categories.length > 0 && (
        <AccordionItem value="category">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">Category</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1 text-sm">
              {config.categoryMode === "param" && (
                <li>
                  <button type="button" onClick={() => set("category", null)} className={cn("py-1 hover:text-foreground", !config.activeCategory ? "font-medium" : "text-muted-foreground")}>
                    All products
                  </button>
                </li>
              )}
              {config.categories.map((c) => {
                const href = (slug: string) =>
                  config.categoryMode === "path" ? `/categories/${slug}${qs ? `?${qs}` : ""}` : `?${new URLSearchParams({ ...Object.fromEntries(query), category: slug }).toString()}`;
                const activeParent = c.slug === config.activeCategory || c.children.some((s) => s.slug === config.activeCategory);
                return (
                  <li key={c.slug}>
                    <Link href={href(c.slug)} scroll={false} className={cn("block py-1 hover:text-foreground", c.slug === config.activeCategory ? "font-medium text-foreground" : "text-muted-foreground")}>
                      {c.name}
                    </Link>
                    {activeParent && c.children.length > 0 && (
                      <ul className="ml-3 border-l pl-3">
                        {c.children.map((s) => (
                          <li key={s.slug}>
                            <Link href={href(s.slug)} scroll={false} className={cn("block py-1 hover:text-foreground", s.slug === config.activeCategory ? "font-medium text-foreground" : "text-muted-foreground")}>
                              {s.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </AccordionContent>
        </AccordionItem>
      )}

      {facets.priceRange.max > 0 && (
        <AccordionItem value="price">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">Price</AccordionTrigger>
          <AccordionContent>
            <PriceFilter key={`${params.get("minPrice")}-${params.get("maxPrice")}`} range={facets.priceRange} />
          </AccordionContent>
        </AccordionItem>
      )}

      {facets.brands.length > 0 && (
        <AccordionItem value="brand">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">Brand</AccordionTrigger>
          <AccordionContent>
            {facets.brands.map((b) => (
              <CheckRow key={b.slug} checked={list("brand").includes(b.slug)} onChange={() => toggle("brand", b.slug)} label={b.name} count={b.count} />
            ))}
          </AccordionContent>
        </AccordionItem>
      )}

      {facets.colors.length > 0 && (
        <AccordionItem value="color">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">Colour</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2">
              {facets.colors.map((c) => {
                const active = list("color").some((x) => x.toLowerCase() === c.name.toLowerCase());
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => toggle("color", c.name)}
                    aria-pressed={active}
                    title={`${c.name} (${c.count})`}
                    className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition", active ? "border-foreground bg-secondary" : "hover:border-foreground/40")}
                  >
                    <span className="relative size-4 rounded-full border border-black/10" style={{ backgroundColor: c.hex ?? "#ddd" }}>
                      {active && <Check className="absolute inset-0 m-auto size-3 text-white mix-blend-difference" />}
                    </span>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      )}

      {facets.sizes.length > 0 && (
        <AccordionItem value="size">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">Size / option</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2">
              {facets.sizes.map((s) => {
                const active = list("size").includes(s.name);
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => toggle("size", s.name)}
                    aria-pressed={active}
                    className={cn("h-8 rounded-md border px-3 text-xs transition", active ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground/40")}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      )}

      <AccordionItem value="availability">
        <AccordionTrigger className="text-sm font-semibold hover:no-underline">Availability</AccordionTrigger>
        <AccordionContent>
          <CheckRow
            checked={params.get("availability") === "in_stock"}
            onChange={() => set("availability", params.get("availability") === "in_stock" ? null : "in_stock")}
            label="In stock"
          />
          <CheckRow
            checked={params.get("availability") === "out_of_stock"}
            onChange={() => set("availability", params.get("availability") === "out_of_stock" ? null : "out_of_stock")}
            label="Out of stock"
          />
          <CheckRow checked={params.get("onSale") === "1"} onChange={() => set("onSale", params.get("onSale") === "1" ? null : "1")} label="On sale" />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="rating">
        <AccordionTrigger className="text-sm font-semibold hover:no-underline">Rating</AccordionTrigger>
        <AccordionContent>
          {[4, 3, 2].map((r) => (
            <CheckRow
              key={r}
              checked={params.get("rating") === String(r)}
              onChange={() => set("rating", params.get("rating") === String(r) ? null : String(r))}
              label={
                <span className="inline-flex items-center gap-1">
                  {r} <Star className="size-3.5 fill-clay text-clay" /> & up
                </span>
              }
            />
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function FilterSidebar({ config }: { config: FilterConfig }) {
  return (
    <aside className="hidden w-60 shrink-0 lg:block" aria-label="Product filters">
      <div className="sticky top-32">
        <FilterPanel config={config} />
      </div>
    </aside>
  );
}

export function MobileFilters({ config, total }: { config: FilterConfig; total: number }) {
  const [open, setOpen] = useState(false);
  const { params } = useListingParams();
  const activeCount = FILTER_KEYS.filter((k) => params.get(k) && !(k === "category" && config.categoryMode !== "param")).length;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-10 lg:hidden">
          <SlidersHorizontal /> Filters {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[0.65rem] text-primary-foreground">{activeCount}</span>}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5">
          <FilterPanel config={config} />
        </div>
        <div className="border-t p-4">
          <Button className="w-full" onClick={() => setOpen(false)}>
            Show {total} result{total === 1 ? "" : "s"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ActiveFilters({ config }: { config: FilterConfig }) {
  const { params, list, toggle, set, update } = useListingParams();
  const { currency } = useStore();
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (config.categoryMode === "param" && params.get("category")) {
    const slug = params.get("category")!;
    const name =
      config.categories.find((c) => c.slug === slug)?.name ??
      config.categories.flatMap((c) => c.children).find((c) => c.slug === slug)?.name ??
      slug;
    chips.push({ key: "category", label: name, remove: () => set("category", null) });
  }
  for (const b of list("brand")) {
    chips.push({ key: `b-${b}`, label: config.facets.brands.find((x) => x.slug === b)?.name ?? b, remove: () => toggle("brand", b) });
  }
  for (const c of list("color")) chips.push({ key: `c-${c}`, label: c, remove: () => toggle("color", c) });
  for (const s of list("size")) chips.push({ key: `s-${s}`, label: s, remove: () => toggle("size", s) });
  const min = params.get("minPrice");
  const max = params.get("maxPrice");
  if (min || max) {
    chips.push({
      key: "price",
      label: `${min ? formatMoney(min, currency) : "Any"} – ${max ? formatMoney(max, currency) : "Any"}`,
      remove: () =>
        update((p) => {
          p.delete("minPrice");
          p.delete("maxPrice");
        }),
    });
  }
  const availability = params.get("availability");
  if (availability) chips.push({ key: "avail", label: availability === "in_stock" ? "In stock" : "Out of stock", remove: () => set("availability", null) });
  if (params.get("onSale") === "1") chips.push({ key: "sale", label: "On sale", remove: () => set("onSale", null) });
  if (params.get("rating")) chips.push({ key: "rating", label: `${params.get("rating")}★ & up`, remove: () => set("rating", null) });
  if (!chips.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button key={c.key} type="button" onClick={c.remove} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs transition hover:border-foreground/40" aria-label={`Remove filter ${c.label}`}>
          {c.label} <X className="size-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => update((p) => FILTER_KEYS.forEach((k) => (k !== "category" || config.categoryMode === "param") && p.delete(k)))}
        className="text-xs font-medium underline underline-offset-4"
      >
        Clear all
      </button>
    </div>
  );
}

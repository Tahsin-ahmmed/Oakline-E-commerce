import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { ProductGrid, ProductGridSkeleton } from "@/components/products/product-card";
import { ActiveFilters, FilterSidebar, MobileFilters, SortSelect, type FilterConfig } from "@/components/catalog/listing-filters";
import type { ProductCardDTO } from "@/services/catalog";

export function ProductListing({
  products,
  total,
  page,
  totalPages,
  basePath,
  searchParams,
  config,
  emptyTitle = "No products match these filters",
  emptyDescription = "Try removing a filter or browsing another category.",
  clearHref,
}: {
  products: ProductCardDTO[];
  total: number;
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  config: FilterConfig;
  emptyTitle?: string;
  emptyDescription?: string;
  clearHref?: string;
}) {
  return (
    <div className="flex gap-10">
      <FilterSidebar config={config} />
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {total} {total === 1 ? "product" : "products"}
          </p>
          <div className="flex items-center gap-2">
            <MobileFilters config={config} total={total} />
            <SortSelect />
          </div>
        </div>
        <ActiveFilters config={config} />
        {products.length ? (
          <>
            <ProductGrid products={products} className="xl:grid-cols-3" priorityCount={3} />
            <PaginationLinks page={page} totalPages={totalPages} basePath={basePath} searchParams={searchParams} className="mt-14" />
          </>
        ) : (
          <EmptyState
            icon={SearchX}
            title={emptyTitle}
            description={emptyDescription}
            action={
              <Button asChild variant="outline">
                <Link href={clearHref ?? basePath}>Clear filters</Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div className="container-page py-10">
      <div className="mb-10 space-y-3">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex gap-10">
        <div className="hidden w-60 shrink-0 space-y-4 lg:block">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-muted" />
          ))}
        </div>
        <div className="flex-1">
          <div className="mb-6 h-10 animate-pulse rounded bg-muted" />
          <ProductGridSkeleton count={6} />
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { requireStaff, can } from "@/lib/auth/guards";
import { oneOf, pageParams, str, type SearchParams } from "@/lib/admin-params";
import { PRODUCT_STATUSES, STOCK_FILTERS } from "@/lib/validations/admin/catalog";
import { listAdminProducts, productFormOptions } from "@/services/admin/products";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/admin/list-toolbar";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductsTable } from "@/components/admin/catalog/products-table";

export const metadata = { title: "Products" };

const SORTS = ["updated", "name", "price_asc", "price_desc", "stock", "sold"] as const;

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireStaff("products.view", "/admin/products");
  const sp = await searchParams;
  const { page, pageSize, skip, take } = pageParams(sp, 20);
  const featured = oneOf(sp, "featured", ["1", "0"] as const);
  const [{ items, total }, options] = await Promise.all([
    listAdminProducts({
      q: str(sp, "q"),
      categoryId: str(sp, "category"),
      brandId: str(sp, "brand"),
      status: oneOf(sp, "status", PRODUCT_STATUSES),
      stock: oneOf(sp, "stock", STOCK_FILTERS),
      featured: featured === undefined ? undefined : featured === "1",
      sort: oneOf(sp, "sort", SORTS),
      skip,
      take,
    }),
    productFormOptions(),
  ]);
  const canManage = can(user, "products.manage");
  const filterKeys = ["q", "category", "brand", "status", "stock", "featured", "sort"];
  const hasFilters = filterKeys.some((k) => str(sp, k));

  return (
    <>
      <PageHeader
        title="Products"
        description={`${total} product${total === 1 ? "" : "s"} in your catalog`}
        actions={
          canManage && (
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus /> Add product
              </Link>
            </Button>
          )
        }
      />
      <Toolbar>
        <SearchInput placeholder="Search name or SKU…" />
        <FilterSelect
          param="category"
          placeholder="All categories"
          options={options.categories.flatMap((c) => [
            { value: c.id, label: c.name },
            ...c.children.map((s) => ({ value: s.id, label: `— ${s.name}` })),
          ])}
        />
        <FilterSelect param="brand" placeholder="All brands" options={options.brands.map((b) => ({ value: b.id, label: b.name }))} />
        <FilterSelect
          param="status"
          placeholder="Any status"
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "DRAFT", label: "Draft" },
            { value: "ARCHIVED", label: "Archived" },
          ]}
        />
        <FilterSelect
          param="stock"
          placeholder="Any stock"
          options={[
            { value: "in", label: "In stock" },
            { value: "low", label: "Low stock" },
            { value: "out", label: "Out of stock" },
          ]}
        />
        <FilterSelect
          param="featured"
          placeholder="Featured: any"
          options={[
            { value: "1", label: "Featured" },
            { value: "0", label: "Not featured" },
          ]}
        />
        <FilterSelect
          param="sort"
          placeholder="Recently updated"
          options={[
            { value: "name", label: "Name A–Z" },
            { value: "price_asc", label: "Price: low → high" },
            { value: "price_desc", label: "Price: high → low" },
            { value: "stock", label: "Stock: lowest first" },
            { value: "sold", label: "Best selling" },
          ]}
        />
        <ClearFilters keys={filterKeys} />
      </Toolbar>
      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={hasFilters ? "No products match these filters" : "No products yet"}
          description={hasFilters ? "Try a different search or clear the filters." : "Add your first product to start selling."}
          action={
            canManage && !hasFilters ? (
              <Button asChild>
                <Link href="/admin/products/new">
                  <Plus /> Add product
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ProductsTable rows={items} canManage={canManage} />
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Showing {skip + 1}–{Math.min(skip + take, total)} of {total}
            </p>
            <PaginationLinks page={page} totalPages={Math.ceil(total / pageSize)} basePath="/admin/products" searchParams={sp} />
          </div>
        </>
      )}
    </>
  );
}

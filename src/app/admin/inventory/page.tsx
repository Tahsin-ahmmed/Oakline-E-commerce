import Link from "next/link";
import { AlertTriangle, Boxes, Download, PackageX, Coins, Layers } from "lucide-react";
import { can, requireStaff } from "@/lib/auth/guards";
import { oneOf, pageParams, str, type SearchParams } from "@/lib/admin-params";
import { formatMoney } from "@/lib/money";
import { STOCK_FILTERS } from "@/lib/validations/admin/catalog";
import { inventorySummary, listInventory, listMovements, MOVEMENT_TYPES } from "@/services/admin/inventory";
import { productFormOptions } from "@/services/admin/products";
import { getSettings } from "@/services/settings";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/admin/list-toolbar";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { EmptyState } from "@/components/shared/empty-state";
import { InventoryTable } from "@/components/admin/inventory/inventory-table";
import { MovementsTable } from "@/components/admin/inventory/movements-table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Inventory" };

function Stat({ icon: Icon, label, value, tone, href }: { icon: typeof Boxes; label: string; value: string; tone?: string; href?: string }) {
  const body = (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)] transition hover:border-foreground/20">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn("size-4", tone)} /> {label}
      </div>
      <p className="mt-2 font-heading text-2xl tabular-nums">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireStaff("inventory.view", "/admin/inventory");
  const sp = await searchParams;
  const tab = str(sp, "tab") === "movements" ? "movements" : "stock";
  const { page, pageSize, skip, take } = pageParams(sp, tab === "stock" ? 25 : 30);
  const [summary, options, settings] = await Promise.all([inventorySummary(), productFormOptions(), getSettings()]);
  const currency = settings.general.currency;
  const canAdjust = can(user, "inventory.manage");

  const filters = { q: str(sp, "q"), stock: oneOf(sp, "stock", STOCK_FILTERS), categoryId: str(sp, "category") };
  const stock = tab === "stock" ? await listInventory({ ...filters, skip, take }) : null;
  const movements =
    tab === "movements" ? await listMovements({ q: str(sp, "q"), type: oneOf(sp, "type", MOVEMENT_TYPES), skip, take }) : null;
  const total = stock?.total ?? movements?.total ?? 0;
  const exportQs = new URLSearchParams(
    Object.entries({ q: filters.q, stock: filters.stock, category: filters.categoryId }).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock levels per SKU, adjustments and the full movement history."
        actions={
          <Button variant="outline" asChild>
            <a href={`/api/admin/inventory/export${exportQs ? `?${exportQs}` : ""}`} download>
              <Download /> Export CSV
            </a>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={Layers} label="SKUs tracked" value={summary.skus.toLocaleString()} />
        <Stat icon={Boxes} label="Units on hand" value={summary.units.toLocaleString()} />
        <Stat icon={AlertTriangle} label="Low stock" value={String(summary.lowStock)} tone="text-warning" href="/admin/inventory?stock=low" />
        <Stat icon={PackageX} label="Out of stock" value={String(summary.outOfStock)} tone="text-destructive" href="/admin/inventory?stock=out" />
        <Stat icon={Coins} label="Value at cost" value={formatMoney(summary.valueAtCost, currency)} />
      </div>

      <div className="mb-4 flex gap-1 border-b">
        {(["stock", "movements"] as const).map((t) => (
          <Link
            key={t}
            href={t === "stock" ? "/admin/inventory" : "/admin/inventory?tab=movements"}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm transition",
              tab === t ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "stock" ? "Stock levels" : "Movement log"}
          </Link>
        ))}
      </div>

      {tab === "stock" ? (
        <>
          <Toolbar>
            <SearchInput placeholder="Search product or SKU…" />
            <FilterSelect
              param="stock"
              placeholder="Any stock level"
              options={[
                { value: "in", label: "In stock" },
                { value: "low", label: "Low stock" },
                { value: "out", label: "Out of stock" },
              ]}
            />
            <FilterSelect
              param="category"
              placeholder="All categories"
              options={options.categories.flatMap((c) => [{ value: c.id, label: c.name }, ...c.children.map((s) => ({ value: s.id, label: `— ${s.name}` }))])}
            />
            <ClearFilters keys={["q", "stock", "category"]} />
          </Toolbar>
          {stock!.items.length === 0 ? (
            <EmptyState icon={Boxes} title="No stock records match" description="Try a different search or filter." />
          ) : (
            <InventoryTable rows={stock!.items} canAdjust={canAdjust} />
          )}
        </>
      ) : (
        <>
          <Toolbar>
            <SearchInput placeholder="Search product, SKU or reason…" />
            <FilterSelect
              param="type"
              placeholder="All movement types"
              options={MOVEMENT_TYPES.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() }))}
            />
            <ClearFilters keys={["q", "type"]} />
          </Toolbar>
          {movements!.items.length === 0 ? (
            <EmptyState icon={Boxes} title="No stock movements" description="Movements appear when stock is sold, restocked or adjusted." />
          ) : (
            <div className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
              <MovementsTable rows={movements!.items} showProduct />
            </div>
          )}
        </>
      )}
      {total > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Showing {skip + 1}–{Math.min(skip + take, total)} of {total}
          </p>
          <PaginationLinks page={page} totalPages={Math.ceil(total / pageSize)} basePath="/admin/inventory" searchParams={sp} />
        </div>
      )}
    </>
  );
}

import { ShoppingCart } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
} from "@/lib/order-status";
import { orderListQuery } from "@/lib/validations/admin/sales";
import { listAdminOrders } from "@/services/admin/orders";
import { getSettings } from "@/services/settings";
import { PageHeader } from "@/components/admin/page-header";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/admin/list-toolbar";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { EmptyState } from "@/components/shared/empty-state";
import { OrdersTable } from "@/components/admin/orders/orders-table";
import { DateRangeFilter } from "@/components/admin/orders/date-range-filter";
import { ExportButton } from "@/components/admin/orders/export-button";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff("orders.view", "/admin/orders");
  const sp = await searchParams;
  const query = orderListQuery.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [data, { general }] = await Promise.all([listAdminOrders(query), getSettings()]);

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${data.total.toLocaleString()} order${data.total === 1 ? "" : "s"} · ${formatMoney(data.sumTotal, general.currency)} total value`}
        actions={<ExportButton endpoint="/api/admin/orders/export" />}
      />
      <Toolbar>
        <SearchInput placeholder="Order #, name, email or phone" />
        <FilterSelect param="status" placeholder="All statuses" options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))} />
        <FilterSelect param="payment" placeholder="All payments" options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] }))} />
        <FilterSelect param="method" placeholder="All methods" options={PAYMENT_METHODS.map((s) => ({ value: s, label: PAYMENT_METHOD_LABELS[s] }))} />
        <DateRangeFilter />
        <FilterSelect
          param="sort"
          placeholder="Newest first"
          className="min-w-36"
          options={[
            { value: "oldest", label: "Oldest first" },
            { value: "total_desc", label: "Highest total" },
            { value: "total_asc", label: "Lowest total" },
          ]}
        />
        <ClearFilters keys={["q", "status", "payment", "method", "from", "to", "sort"]} />
      </Toolbar>
      {data.items.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No orders found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <OrdersTable orders={data.items} />
          <PaginationLinks page={data.page} totalPages={data.totalPages} basePath="/admin/orders" searchParams={sp} className="mt-6" />
        </>
      )}
    </>
  );
}

import Link from "next/link";
import { format } from "date-fns";
import { Users } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { oneOf, pageParams, str, type SearchParams } from "@/lib/admin-params";
import { formatMoney } from "@/lib/money";
import { listCustomers, type CustomerSort } from "@/services/admin/customers";
import { getSettings } from "@/services/settings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/admin/list-toolbar";
import { ToneBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationLinks } from "@/components/shared/pagination-links";

export const metadata = { title: "Customers" };

const SORTS = ["joined_desc", "joined_asc", "spend_desc", "orders_desc", "name_asc"] as const;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("customers.view", "/admin/customers");
  const sp = await searchParams;
  const { page, pageSize } = pageParams(sp);
  const [data, { general }] = await Promise.all([
    listCustomers({
      q: str(sp, "q"),
      status: oneOf(sp, "status", ["ACTIVE", "BLOCKED"] as const),
      sort: (oneOf(sp, "sort", SORTS) ?? "joined_desc") as CustomerSort,
      page,
      pageSize,
    }),
    getSettings(),
  ]);
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <>
      <PageHeader title="Customers" description={`${data.total.toLocaleString()} customer account${data.total === 1 ? "" : "s"}`} />
      <Toolbar>
        <SearchInput placeholder="Name, email or phone" />
        <FilterSelect param="status" placeholder="All statuses" options={[{ value: "ACTIVE", label: "Active" }, { value: "BLOCKED", label: "Blocked" }]} />
        <FilterSelect
          param="sort"
          placeholder="Newest first"
          options={[
            { value: "joined_asc", label: "Oldest first" },
            { value: "spend_desc", label: "Top spenders" },
            { value: "orders_desc", label: "Most orders" },
            { value: "name_asc", label: "Name A–Z" },
          ]}
        />
        <ClearFilters keys={["q", "status", "sort"]} />
      </Toolbar>
      {data.items.length === 0 ? (
        <EmptyState icon={Users} title="No customers found" description="Try a different search or filter." />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total spent</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-4">
                      <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{c.phone ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.orderCount}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(c.spent, general.currency)}</TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{format(new Date(c.createdAt), "d MMM yyyy")}</TableCell>
                    <TableCell className="pr-4">
                      <ToneBadge tone={c.status === "ACTIVE" ? "success" : "danger"}>{c.status === "ACTIVE" ? "Active" : "Blocked"}</ToneBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationLinks page={page} totalPages={totalPages} basePath="/admin/customers" searchParams={sp} className="mt-6" />
        </>
      )}
    </>
  );
}

import { requireStaff } from "@/lib/auth/guards";
import { oneOf, pageParams, str, type SearchParams } from "@/lib/admin-params";
import { listCoupons } from "@/services/admin/coupons";
import { PageHeader } from "@/components/admin/page-header";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/admin/list-toolbar";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { CouponsTable } from "@/components/admin/coupons/coupons-table";

export const metadata = { title: "Coupons" };

export default async function CouponsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("coupons.manage", "/admin/coupons");
  const sp = await searchParams;
  const { page, pageSize } = pageParams(sp);
  const data = await listCoupons({
    q: str(sp, "q"),
    state: oneOf(sp, "state", ["active", "scheduled", "expired", "inactive"] as const),
    page,
    pageSize,
  });
  return (
    <>
      <PageHeader title="Coupons" description="Percentage, fixed-amount and free-shipping discounts." />
      <Toolbar>
        <SearchInput placeholder="Search code or description" />
        <FilterSelect
          param="state"
          placeholder="All coupons"
          options={[
            { value: "active", label: "Active" },
            { value: "scheduled", label: "Scheduled" },
            { value: "expired", label: "Expired" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
        <ClearFilters keys={["q", "state"]} />
      </Toolbar>
      <CouponsTable coupons={data.items} />
      <PaginationLinks page={page} totalPages={Math.max(1, Math.ceil(data.total / pageSize))} basePath="/admin/coupons" searchParams={sp} className="mt-6" />
    </>
  );
}

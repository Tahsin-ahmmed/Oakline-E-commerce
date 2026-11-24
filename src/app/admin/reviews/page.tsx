import { Star } from "lucide-react";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { requireStaff } from "@/lib/auth/guards";
import { oneOf, pageParams, str, type SearchParams } from "@/lib/admin-params";
import { listReviews } from "@/services/admin/reviews";
import { PageHeader } from "@/components/admin/page-header";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/admin/list-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { ReviewsList } from "@/components/admin/reviews/reviews-list";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("reviews.manage", "/admin/reviews");
  const sp = await searchParams;
  const { page, pageSize } = pageParams(sp);
  const ratingStr = oneOf(sp, "rating", ["1", "2", "3", "4", "5"] as const);
  const data = await listReviews({
    q: str(sp, "q"),
    status: oneOf(sp, "status", ["PENDING", "APPROVED", "REJECTED"] as const) as ReviewStatus | undefined,
    rating: ratingStr ? Number(ratingStr) : undefined,
    page,
    pageSize,
  });
  return (
    <>
      <PageHeader
        title="Reviews"
        description={`${data.counts.PENDING ?? 0} awaiting moderation · ${data.counts.APPROVED ?? 0} published · ${data.counts.REJECTED ?? 0} rejected`}
      />
      <Toolbar>
        <SearchInput placeholder="Product, customer or text" />
        <FilterSelect
          param="status"
          placeholder="All reviews"
          options={[
            { value: "PENDING", label: "Pending" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
        <FilterSelect param="rating" placeholder="Any rating" options={[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r} star${r === 1 ? "" : "s"}` }))} />
        <ClearFilters keys={["q", "status", "rating"]} />
      </Toolbar>
      {data.items.length === 0 ? (
        <EmptyState icon={Star} title="No reviews here" description="Verified-purchase reviews appear here for moderation." />
      ) : (
        <>
          <ReviewsList reviews={data.items} />
          <PaginationLinks page={page} totalPages={Math.max(1, Math.ceil(data.total / pageSize))} basePath="/admin/reviews" searchParams={sp} className="mt-6" />
        </>
      )}
    </>
  );
}

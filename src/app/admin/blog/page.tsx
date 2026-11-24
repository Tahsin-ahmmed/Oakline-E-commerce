import Link from "next/link";
import type { Metadata } from "next";
import { format } from "date-fns";
import { FileText, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { oneOf, pageParams, str, type SearchParams } from "@/lib/admin-params";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { FilterSelect, SearchInput, Toolbar } from "@/components/admin/list-toolbar";
import { ToneBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { PostRowActions } from "@/components/admin/blog/post-row-actions";
import { BlogCategoriesDialog } from "@/components/admin/blog/blog-categories-dialog";
import { listPostsAdmin } from "@/services/admin/blog";
import { POST_STATUSES } from "@/lib/validations/admin/content";

export const metadata: Metadata = { title: "Blog" };

export default async function AdminBlogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("content.manage", "/admin/blog");
  const sp = await searchParams;
  const { page, pageSize, skip, take } = pageParams(sp);
  const status = oneOf(sp, "status", POST_STATUSES);
  const { items, total } = await listPostsAdmin({ q: str(sp, "q"), status, skip, take });
  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Blog"
        description={`${total} post${total === 1 ? "" : "s"}`}
        actions={
          <>
            <BlogCategoriesDialog />
            <Button asChild>
              <Link href="/admin/blog/new">
                <Plus /> New post
              </Link>
            </Button>
          </>
        }
      />
      <Toolbar>
        <SearchInput placeholder="Search posts…" />
        <FilterSelect
          param="status"
          placeholder="All statuses"
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "PUBLISHED", label: "Published" },
            { value: "SCHEDULED", label: "Scheduled" },
          ]}
        />
      </Toolbar>
      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No posts found"
          description={str(sp, "q") || status ? "Try a different search or filter." : "Share stories, guides and news with your customers."}
          action={
            <Button asChild>
              <Link href="/admin/blog/new">Write a post</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Publish date</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => {
                const scheduledFuture = p.publishedAt && p.publishedAt > now && p.status !== "DRAFT";
                const live = p.status !== "DRAFT" && Boolean(p.publishedAt) && !scheduledFuture;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-0 min-w-56">
                      <Link href={`/admin/blog/${p.id}`} className="flex items-center gap-3">
                        {p.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.coverImageUrl} alt="" className="hidden h-10 w-16 shrink-0 rounded object-cover sm:block" />
                        ) : (
                          <span className="hidden h-10 w-16 shrink-0 rounded bg-muted sm:block" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">{p.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">/blog/{p.slug}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{p.category?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {p.status === "DRAFT" ? (
                        <ToneBadge tone="neutral">Draft</ToneBadge>
                      ) : scheduledFuture ? (
                        <ToneBadge tone="warning">Scheduled</ToneBadge>
                      ) : (
                        <ToneBadge tone="success">Published</ToneBadge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {p.publishedAt ? format(p.publishedAt, "d MMM yyyy, HH:mm") : "—"}
                    </TableCell>
                    <TableCell>
                      <PostRowActions id={p.id} title={p.title} slug={p.slug} live={live} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationLinks page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} basePath="/admin/blog" searchParams={sp} className="mt-6" />
    </div>
  );
}

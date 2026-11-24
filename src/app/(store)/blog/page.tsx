import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { PageIntro } from "@/components/content/page-intro";
import { BlogCard } from "@/components/content/blog-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationLinks } from "@/components/shared/pagination-links";
import { listBlogCategoriesWithCounts, listPublishedPosts } from "@/services/blog";
import { cn } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;
const PAGE_SIZE = 9;

function one(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim().slice(0, 80) || undefined;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const category = one(sp.category);
  return {
    title: "Journal",
    description: "Stories on slow living, interiors, care guides and the makers behind our collections.",
    alternates: { canonical: category ? `/blog?category=${category}` : "/blog" },
  };
}

export default async function BlogIndexPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const category = one(sp.category);
  const tag = one(sp.tag);
  const page = Math.max(1, Math.min(500, Number.parseInt(one(sp.page) ?? "1", 10) || 1));
  const [{ posts, totalPages }, categories] = await Promise.all([
    listPublishedPosts({ category, tag, page, pageSize: PAGE_SIZE }),
    listBlogCategoriesWithCounts(),
  ]);
  const showFeatured = page === 1 && !category && !tag && posts.length > 0;
  const [featured, ...rest] = showFeatured ? posts : [null, ...posts];

  const pill = (active: boolean) =>
    cn("rounded-full border px-4 py-1.5 text-sm transition", active ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground/40");

  return (
    <div>
      <PageIntro
        eyebrow="The Oakline Journal"
        title="Notes on living well"
        description="Interiors, care guides and stories from the workshops we partner with."
        crumbs={[{ label: "Journal" }]}
      />
      <div className="container-page">
        {categories.length > 0 && (
          <nav aria-label="Blog categories" className="mb-10 flex flex-wrap gap-2">
            <Link href="/blog" className={pill(!category && !tag)} aria-current={!category && !tag ? "page" : undefined}>
              All stories
            </Link>
            {categories.map((c) => (
              <Link key={c.slug} href={`/blog?category=${c.slug}`} className={pill(category === c.slug)} aria-current={category === c.slug ? "page" : undefined}>
                {c.name} <span className="opacity-60">({c.count})</span>
              </Link>
            ))}
            {tag && <span className={pill(true)}>#{tag}</span>}
          </nav>
        )}

        {posts.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No stories here yet"
            description="Check back soon — we're always writing."
            action={
              <Link href="/blog" className="text-sm underline underline-offset-4">
                See all stories
              </Link>
            }
          />
        ) : (
          <>
            {featured && <BlogCard post={featured} featured className="mb-16 border-b pb-16" />}
            <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => p && <BlogCard key={p.id} post={p} />)}
            </div>
          </>
        )}
        <PaginationLinks page={page} totalPages={totalPages} basePath="/blog" searchParams={sp} className="mt-14" />
      </div>
    </div>
  );
}

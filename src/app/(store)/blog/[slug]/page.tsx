import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { SmartImage } from "@/components/shared/smart-image";
import { BlogCard } from "@/components/content/blog-card";
import { Crumbs, JsonLd } from "@/components/content/page-intro";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { getPublishedPost, getRelatedPosts, readingMinutes } from "@/services/blog";
import { getSettings } from "@/services/settings";
import { sanitizeRichText } from "@/lib/sanitize";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Story not found" };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || undefined;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: post.author?.name ? [post.author.name] : undefined,
      tags: post.tags,
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: post.coverImageUrl ? [post.coverImageUrl] : undefined },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();
  const [related, { general, newsletter }] = await Promise.all([getRelatedPosts(post), getSettings()]);
  // Re-sanitize at render time as defence in depth (content may predate sanitization, e.g. imported/seeded).
  const html = sanitizeRichText(post.content);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: post.author?.name ?? general.siteName },
    publisher: { "@type": "Organization", name: general.siteName },
    mainEntityOfPage: `${base}/blog/${post.slug}`,
    keywords: post.tags.join(", ") || undefined,
  };

  return (
    <article>
      <JsonLd data={jsonLd} />
      <header className="container-page max-w-4xl pt-10 text-center sm:pt-14">
        <div className="flex justify-center">
          <Crumbs items={[{ label: "Journal", href: "/blog" }, { label: post.title }]} />
        </div>
        {post.category && (
          <Link href={`/blog?category=${post.category.slug}`} className="text-xs font-semibold tracking-[0.18em] text-clay uppercase hover:underline">
            {post.category.name}
          </Link>
        )}
        <h1 className="mt-4 text-4xl leading-[1.1] sm:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{post.excerpt}</p>}
        <p className="mt-6 text-sm text-muted-foreground">
          {post.author?.name && <>By {post.author.name} · </>}
          {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{format(post.publishedAt, "d MMMM yyyy")}</time>} ·{" "}
          {readingMinutes(post.content)} min read
        </p>
      </header>

      {post.coverImageUrl && (
        <div className="container-page mt-10 max-w-6xl">
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
            <SmartImage src={post.coverImageUrl} alt="" fill priority sizes="(max-width:1280px) 100vw, 1200px" className="object-cover" />
          </div>
        </div>
      )}

      <div className="container-page mt-12 max-w-[44rem]">
        <div className="prose-oak text-[1.05rem] leading-8" dangerouslySetInnerHTML={{ __html: html }} />
        {post.tags.length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-2 border-t pt-6" aria-label="Tags">
            {post.tags.map((t) => (
              <li key={t}>
                <Link href={`/blog?tag=${encodeURIComponent(t)}`} className="rounded-full bg-secondary px-3 py-1 text-xs hover:bg-sand">
                  #{t}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/blog" className="mt-8 inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline">
          <ArrowLeft className="size-4" /> Back to the journal
        </Link>
      </div>

      {newsletter.enabled && (
        <section className="container-page mt-16 max-w-4xl">
          <div className="rounded-2xl bg-secondary/60 px-6 py-10 text-center sm:px-12">
            <h2 className="text-2xl">{newsletter.heading}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{newsletter.subheading}</p>
            <div className="mx-auto mt-6 max-w-md">
              <NewsletterForm source="blog" />
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="container-page mt-20" aria-labelledby="related-heading">
          <h2 id="related-heading" className="mb-8 text-3xl">
            Keep reading
          </h2>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <BlogCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

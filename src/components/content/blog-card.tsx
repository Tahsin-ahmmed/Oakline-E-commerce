import Link from "next/link";
import { format } from "date-fns";
import { SmartImage } from "@/components/shared/smart-image";
import { cn } from "@/lib/utils";
import type { PostSummary } from "@/services/blog";

export function BlogCard({ post, featured, className }: { post: PostSummary; featured?: boolean; className?: string }) {
  return (
    <article className={cn("group", featured && "grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center", className)}>
      <Link
        href={`/blog/${post.slug}`}
        className={cn("relative block overflow-hidden rounded-xl bg-muted", featured ? "aspect-[16/10]" : "aspect-[4/3]")}
        aria-label={post.title}
      >
        {post.coverImageUrl && (
          <SmartImage
            src={post.coverImageUrl}
            alt=""
            fill
            priority={featured}
            sizes={featured ? "(max-width:1024px) 100vw, 60vw" : "(max-width:768px) 100vw, 33vw"}
            className="object-cover transition duration-700 group-hover:scale-[1.03]"
          />
        )}
      </Link>
      <div className={cn(featured ? "" : "mt-4")}>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {post.category && (
            <Link href={`/blog?category=${post.category.slug}`} className="font-semibold tracking-[0.14em] text-clay uppercase hover:underline">
              {post.category.name}
            </Link>
          )}
          <span>{format(post.publishedAt, "d MMM yyyy")}</span>
          <span aria-hidden>·</span>
          <span>{post.minutes} min read</span>
        </p>
        <h2 className={cn("mt-2 leading-snug", featured ? "text-3xl sm:text-4xl" : "text-xl")}>
          <Link href={`/blog/${post.slug}`} className="hover:underline hover:underline-offset-4">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && <p className={cn("mt-3 text-muted-foreground", featured ? "text-base leading-7" : "line-clamp-2 text-sm leading-6")}>{post.excerpt}</p>}
        {featured && (
          <Link href={`/blog/${post.slug}`} className="mt-5 inline-block text-sm font-medium underline underline-offset-4">
            Read the story
          </Link>
        )}
      </div>
    </article>
  );
}

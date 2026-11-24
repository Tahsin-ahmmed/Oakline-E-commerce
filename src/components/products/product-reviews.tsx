"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { BadgeCheck, Loader2, MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "@/components/shared/form-field";
import { RatingStars } from "@/components/shared/rating-stars";
import { useStore } from "@/components/shared/store-context";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ReviewsResponse {
  reviews: {
    id: string;
    rating: number;
    title: string | null;
    body: string;
    author: string;
    isVerifiedPurchase: boolean;
    adminReply: string | null;
    createdAt: string;
  }[];
  total: number;
  page: number;
  distribution: Record<string, number>;
  canReview: boolean;
  reviewBlockedReason: string | null;
}

const PAGE_SIZE = 10;

function ReviewForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = useMutation({
    mutationFn: () => api("/api/reviews", { body: { productId, rating, title: title || undefined, body } }),
    onSuccess: () => {
      toast.success("Thank you! Your review will appear once it's approved.");
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.details) {
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.details)) next[k] = Array.isArray(v) ? String(v[0]) : String(v);
        setErrors(next);
      }
      toast.error(errorMessage(e));
    },
  });
  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const next: Record<string, string> = {};
        if (!rating) next.rating = "Choose a rating";
        if (body.trim().length < 10) next.body = "Please write at least 10 characters";
        setErrors(next);
        if (!Object.keys(next).length) submit.mutate();
      }}
    >
      <h3 className="font-heading text-xl">Write a review</h3>
      <Field label="Your rating" error={errors.rating} required>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              className="p-0.5"
            >
              <Star className={cn("size-6 transition", (hover || rating) >= n ? "fill-clay text-clay" : "text-border")} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Title" htmlFor="review-title" hint="Optional">
        <Input id="review-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Sum it up in a few words" />
      </Field>
      <Field label="Review" htmlFor="review-body" error={errors.body} required>
        <Textarea id="review-body" value={body} maxLength={3000} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="What did you like? How do you use it?" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending && <Loader2 className="animate-spin" />} Submit review
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ProductReviews({ productId, rating, reviewCount }: { productId: string; rating: number; reviewCount: number }) {
  const [page, setPage] = useState(1);
  const [writing, setWriting] = useState(false);
  const { user } = useStore();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["reviews", productId, page, user?.id ?? null],
    queryFn: () => api<ReviewsResponse>(`/api/reviews?productId=${encodeURIComponent(productId)}&page=${page}`),
    placeholderData: (prev) => prev,
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const dist = data?.distribution ?? {};
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0);

  return (
    <section id="reviews" className="scroll-mt-32 border-t py-16" aria-labelledby="reviews-heading">
      <div className="grid gap-12 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div>
          <h2 id="reviews-heading" className="font-heading text-3xl">
            Reviews
          </h2>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-heading text-5xl">{reviewCount ? rating.toFixed(1) : "—"}</span>
            <div className="pb-1.5">
              <RatingStars rating={rating} />
              <p className="mt-1 text-xs text-muted-foreground">
                {reviewCount} review{reviewCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <ul className="mt-6 space-y-2" aria-label="Rating distribution">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = dist[n] ?? 0;
              const pct = distTotal ? Math.round((c / distTotal) * 100) : 0;
              return (
                <li key={n} className="flex items-center gap-3 text-xs">
                  <span className="w-8 tabular-nums">{n} ★</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-clay" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 text-right text-muted-foreground tabular-nums">{c}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-8">
            {!user ? (
              <p className="text-sm text-muted-foreground">
                <Link href={`/login?next=${encodeURIComponent(pathname + "#reviews")}`} className="font-medium text-foreground underline underline-offset-4">
                  Sign in
                </Link>{" "}
                to review a product you&apos;ve purchased.
              </p>
            ) : data?.canReview ? (
              !writing && (
                <Button variant="outline" onClick={() => setWriting(true)}>
                  <MessageSquare /> Write a review
                </Button>
              )
            ) : (
              data?.reviewBlockedReason && <p className="text-sm text-muted-foreground">{data.reviewBlockedReason}</p>
            )}
          </div>
        </div>

        <div className="min-w-0">
          {writing && (
            <div className="mb-10">
              <ReviewForm
                productId={productId}
                onDone={() => {
                  setWriting(false);
                  void qc.invalidateQueries({ queryKey: ["reviews", productId] });
                }}
              />
            </div>
          )}
          {isLoading ? (
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-muted-foreground">Reviews couldn&apos;t be loaded right now.</p>
          ) : !data?.reviews.length ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="font-heading text-xl">No reviews yet</p>
              <p className="mt-2 text-sm text-muted-foreground">Reviews come from verified customers after delivery.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y">
                {data.reviews.map((r) => (
                  <li key={r.id} className="py-7 first:pt-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <RatingStars rating={r.rating} />
                      {r.title && <h3 className="font-sans text-[0.95rem] font-semibold tracking-normal">{r.title}</h3>}
                    </div>
                    <p className="mt-3 text-[0.95rem] leading-7 text-foreground/85">{r.body}</p>
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{r.author}</span>
                      {r.isVerifiedPurchase && (
                        <span className="inline-flex items-center gap-1 text-success">
                          <BadgeCheck className="size-3.5" /> Verified purchase
                        </span>
                      )}
                      <span>· {format(new Date(r.createdAt), "d MMM yyyy")}</span>
                    </p>
                    {r.adminReply && (
                      <div className="mt-4 rounded-lg bg-secondary/60 p-4 text-sm">
                        <p className="text-xs font-semibold tracking-wide uppercase">Response from Ezyza</p>
                        <p className="mt-1.5 text-foreground/80">{r.adminReply}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

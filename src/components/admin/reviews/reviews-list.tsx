"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { BadgeCheck, Check, Loader2, MessageSquareReply, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RatingStars } from "@/components/shared/rating-stars";
import { ToneBadge } from "@/components/shared/status-badge";
import { useSelection } from "@/hooks/use-selection";
import { api, errorMessage } from "@/lib/api-client";
import type { AdminReviewRow } from "@/services/admin/reviews";

const TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;

function ReviewCard({ review, selected, onToggle }: { review: AdminReviewRow; selected: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(review.adminReply ?? "");
  const [busy, setBusy] = useState(false);

  const patch = async (body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      await api(`/api/admin/reviews/${review.id}`, { method: "PATCH", body });
      toast.success(message);
      setReplying(false);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex gap-4 rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
      <Checkbox checked={selected} onCheckedChange={onToggle} aria-label="Select review" className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/products/${review.product.slug}`} target="_blank" className="text-sm font-medium hover:underline">
              {review.product.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <RatingStars rating={review.rating} />
              <span>
                {review.user.name} · {review.user.email} · {format(new Date(review.createdAt), "d MMM yyyy")}
              </span>
              {review.isVerifiedPurchase && (
                <span className="inline-flex items-center gap-1 text-success">
                  <BadgeCheck className="size-3.5" /> Verified purchase
                </span>
              )}
            </div>
          </div>
          <ToneBadge tone={TONE[review.status]}>{review.status.toLowerCase()}</ToneBadge>
        </div>
        {review.title && <p className="mt-3 font-medium">{review.title}</p>}
        <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/85">{review.body}</p>
        {review.adminReply && !replying && (
          <div className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Store reply</p>
            <p className="whitespace-pre-wrap">{review.adminReply}</p>
          </div>
        )}
        {replying && (
          <div className="mt-3 space-y-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={2000} placeholder="Write a public reply…" aria-label="Reply" />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => patch({ adminReply: reply.trim() || null }, reply.trim() ? "Reply saved." : "Reply removed.")}>
                {busy && <Loader2 className="animate-spin" />} Save reply
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {review.status !== "APPROVED" && (
            <Button size="sm" disabled={busy} onClick={() => patch({ status: "APPROVED" }, "Review approved.")}>
              <Check /> Approve
            </Button>
          )}
          {review.status !== "REJECTED" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => patch({ status: "REJECTED" }, "Review rejected.")}>
              <X /> Reject
            </Button>
          )}
          {!replying && (
            <Button size="sm" variant="ghost" onClick={() => setReplying(true)}>
              <MessageSquareReply /> {review.adminReply ? "Edit reply" : "Reply"}
            </Button>
          )}
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost" className="text-destructive">
                <Trash2 /> Delete
              </Button>
            }
            title="Delete this review?"
            description="The review is removed permanently and the product rating is recalculated."
            confirmLabel="Delete"
            destructive
            onConfirm={async () => {
              try {
                await api(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
                toast.success("Review deleted.");
                router.refresh();
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          />
        </div>
      </div>
    </li>
  );
}

export function ReviewsList({ reviews }: { reviews: AdminReviewRow[] }) {
  const router = useRouter();
  const sel = useSelection(reviews.map((r) => r.id));
  const [busy, setBusy] = useState(false);
  const bulk = async (action: "approve" | "reject" | "delete") => {
    setBusy(true);
    try {
      const res = await api<{ count: number }>("/api/admin/reviews/bulk", { body: { ids: sel.selected, action } });
      toast.success(`${res.count} review(s) ${action === "delete" ? "deleted" : action + "d"}.`);
      sel.clear();
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={sel.allSelected ? true : sel.someSelected ? "indeterminate" : false}
            onCheckedChange={sel.toggleAll}
            aria-label="Select all reviews"
          />
          Select all
        </label>
        {sel.selected.length > 0 && (
          <>
            <span className="text-muted-foreground">{sel.selected.length} selected</span>
            <Button size="sm" disabled={busy} onClick={() => bulk("approve")}>
              Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk("reject")}>
              Reject
            </Button>
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="destructive" disabled={busy}>
                  Delete
                </Button>
              }
              title={`Delete ${sel.selected.length} review(s)?`}
              description="This cannot be undone."
              confirmLabel="Delete"
              destructive
              onConfirm={() => bulk("delete")}
            />
          </>
        )}
      </div>
      <ul className="space-y-3">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} selected={sel.isSelected(r.id)} onToggle={() => sel.toggle(r.id)} />
        ))}
      </ul>
    </>
  );
}

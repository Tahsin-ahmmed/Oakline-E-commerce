"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MessageSquareQuote, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ActiveBadge } from "@/components/shared/status-badge";
import { RatingStars } from "@/components/shared/rating-stars";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { testimonialSchema, type TestimonialInput } from "@/lib/validations/admin/content";
import { MoveButtons, useAdminAction, useFormSubmit } from "@/components/admin/content/shared";

export interface TestimonialRow {
  id: string;
  name: string;
  location: string | null;
  quote: string;
  rating: number;
  isActive: boolean;
  sortOrder: number;
}

function TestimonialDialog({ item, nextSort, onClose }: { item: TestimonialRow | null; nextSort: number; onClose: () => void }) {
  const submit = useFormSubmit();
  const { register, control, handleSubmit, setError, formState } = useForm<TestimonialInput>({
    resolver: zodResolver(testimonialSchema),
    defaultValues: {
      name: item?.name ?? "",
      location: item?.location ?? "",
      quote: item?.quote ?? "",
      rating: item?.rating ?? 5,
      isActive: item?.isActive ?? true,
      sortOrder: item?.sortOrder ?? nextSort,
    },
  });
  const errors = formState.errors;
  const onSubmit = handleSubmit(async (values) => {
    const ok = await submit(
      () => (item ? api(`/api/admin/content/testimonials/${item.id}`, { method: "PUT", body: values }) : api("/api/admin/content/testimonials", { body: values })),
      item ? "Testimonial updated" : "Testimonial added",
      setError,
    );
    if (ok) onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit testimonial" : "New testimonial"}</DialogTitle>
          <DialogDescription>Shown in the “Kind words” section of the homepage.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="t-name" error={errors.name?.message} required>
              <Input id="t-name" {...register("name")} placeholder="Nusrat J." />
            </Field>
            <Field label="Location" htmlFor="t-loc" error={errors.location?.message}>
              <Input id="t-loc" {...register("location")} placeholder="Dhaka" />
            </Field>
          </div>
          <Field label="Quote" htmlFor="t-quote" error={errors.quote?.message} required>
            <Textarea id="t-quote" rows={4} {...register("quote")} />
          </Field>
          <Field label="Rating" error={errors.rating?.message}>
            <Controller
              control={control}
              name="rating"
              render={({ field }) => (
                <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={field.value === r} aria-label={`${r} stars`} onClick={() => field.onChange(r)}>
                      <Star className={cn("size-6", r <= field.value ? "fill-clay text-clay" : "text-border")} />
                    </button>
                  ))}
                </div>
              )}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Display order" htmlFor="t-sort" error={errors.sortOrder?.message}>
              <Input id="t-sort" type="number" min={0} {...register("sortOrder", { valueAsNumber: true })} />
            </Field>
            <label className="flex items-center gap-3 self-end pb-2 text-sm">
              <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting && <Loader2 className="animate-spin" />}
              {item ? "Save changes" : "Add testimonial"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TestimonialsManager({ items }: { items: TestimonialRow[] }) {
  const [dialog, setDialog] = useState<{ item: TestimonialRow | null } | null>(null);
  const { run } = useAdminAction();
  const ids = items.map((t) => t.id);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ item: null })}>
          <Plus /> New testimonial
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={MessageSquareQuote} title="No testimonials yet" description="Add quotes from happy customers to build trust on the homepage." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((t, i) => (
            <li key={t.id} className="flex flex-col rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <RatingStars rating={t.rating} />
                <ActiveBadge active={t.isActive} />
              </div>
              <blockquote className="mt-3 flex-1 font-heading text-[1.02rem] leading-relaxed">“{t.quote}”</blockquote>
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-medium">{t.name}</span>
                  {t.location && <span className="text-muted-foreground"> · {t.location}</span>}
                </p>
                <div className="flex items-center">
                  <MoveButtons entity="testimonial" ids={ids} index={i} label={t.name} />
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit testimonial from ${t.name}`} onClick={() => setDialog({ item: t })}>
                    <Pencil />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete testimonial from ${t.name}`}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    }
                    title="Delete this testimonial?"
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => run(() => api(`/api/admin/content/testimonials/${t.id}`, { method: "DELETE" }), "Testimonial deleted")}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {dialog && <TestimonialDialog key={dialog.item?.id ?? "new"} item={dialog.item} nextSort={items.length} onClose={() => setDialog(null)} />}
    </div>
  );
}

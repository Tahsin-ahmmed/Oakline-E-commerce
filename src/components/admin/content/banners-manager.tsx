"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ImageIcon, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ActiveBadge, ToneBadge } from "@/components/shared/status-badge";
import { ImageInput } from "@/components/admin/image-input";
import { api } from "@/lib/api-client";
import { bannerSchema, type BannerInput } from "@/lib/validations/admin/content";
import { MoveButtons, localToIso, toLocalInput, useAdminAction, useFormSubmit } from "@/components/admin/content/shared";

export interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  eyebrow: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  placement: "HERO" | "PROMO" | "SPLIT";
  sortOrder: number;
  isActive: boolean;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
}

const PLACEMENTS = [
  { value: "HERO", label: "Hero carousel" },
  { value: "PROMO", label: "Promotional banner" },
  { value: "SPLIT", label: "Split banner" },
] as const;

function scheduleState(b: BannerRow): { label: string; tone: "success" | "warning" | "neutral" } | null {
  const now = Date.now();
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return { label: `Starts ${format(new Date(b.startsAt), "d MMM")}`, tone: "warning" };
  if (b.endsAt && new Date(b.endsAt).getTime() < now) return { label: "Ended", tone: "neutral" };
  if (b.endsAt) return { label: `Until ${format(new Date(b.endsAt), "d MMM")}`, tone: "success" };
  return null;
}

function BannerDialog({ banner, open, onOpenChange, nextSort }: { banner: BannerRow | null; open: boolean; onOpenChange: (o: boolean) => void; nextSort: number }) {
  const submit = useFormSubmit();
  const form = useForm<BannerInput>({
    resolver: zodResolver(bannerSchema),
    values: {
      title: banner?.title ?? "",
      subtitle: banner?.subtitle ?? "",
      eyebrow: banner?.eyebrow ?? "",
      imageUrl: banner?.imageUrl ?? "",
      mobileImageUrl: banner?.mobileImageUrl ?? "",
      ctaLabel: banner?.ctaLabel ?? "",
      ctaHref: banner?.ctaHref ?? "",
      placement: banner?.placement ?? "HERO",
      sortOrder: banner?.sortOrder ?? nextSort,
      isActive: banner?.isActive ?? true,
      startsAt: toLocalInput(banner?.startsAt),
      endsAt: toLocalInput(banner?.endsAt),
    },
  });
  const { register, control, handleSubmit, formState: { errors }, setError } = form;

  const onSubmit = handleSubmit(async (values) => {
    const body = { ...values, startsAt: localToIso(values.startsAt), endsAt: localToIso(values.endsAt) };
    const ok = await submit(
      () => (banner ? api(`/api/admin/content/banners/${banner.id}`, { method: "PUT", body }) : api("/api/admin/content/banners", { body })),
      banner ? "Banner updated" : "Banner created",
      setError,
    );
    if (ok) onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{banner ? "Edit banner" : "New banner"}</DialogTitle>
          <DialogDescription>Hero banners rotate at the top of the homepage; promo banners appear between sections.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Desktop image" error={errors.imageUrl?.message} required>
            <Controller control={control} name="imageUrl" render={({ field }) => <ImageInput value={field.value} onChange={field.onChange} folder="banners" aspect="aspect-[21/9]" />} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eyebrow" htmlFor="b-eyebrow" error={errors.eyebrow?.message} hint="Small label above the title">
              <Input id="b-eyebrow" {...register("eyebrow")} />
            </Field>
            <Field label="Placement" error={errors.placement?.message}>
              <Controller
                control={control}
                name="placement"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLACEMENTS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <Field label="Title" htmlFor="b-title" error={errors.title?.message} required>
            <Input id="b-title" {...register("title")} />
          </Field>
          <Field label="Subtitle" htmlFor="b-subtitle" error={errors.subtitle?.message}>
            <Textarea id="b-subtitle" rows={2} {...register("subtitle")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Button label" htmlFor="b-cta" error={errors.ctaLabel?.message}>
              <Input id="b-cta" placeholder="Shop now" {...register("ctaLabel")} />
            </Field>
            <Field label="Button link" htmlFor="b-href" error={errors.ctaHref?.message}>
              <Input id="b-href" placeholder="/products?sort=newest" {...register("ctaHref")} />
            </Field>
            <Field label="Starts" htmlFor="b-start" error={errors.startsAt?.message} hint="Optional — schedule ahead">
              <Input id="b-start" type="datetime-local" {...register("startsAt")} />
            </Field>
            <Field label="Ends" htmlFor="b-end" error={errors.endsAt?.message}>
              <Input id="b-end" type="datetime-local" {...register("endsAt")} />
            </Field>
            <Field label="Display order" htmlFor="b-sort" error={errors.sortOrder?.message}>
              <Input id="b-sort" type="number" min={0} {...register("sortOrder", { valueAsNumber: true })} />
            </Field>
            <Field label="Status">
              <label className="flex h-10 items-center gap-3 text-sm">
                <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
                Active
              </label>
            </Field>
          </div>
          <Field label="Mobile image (optional)" error={errors.mobileImageUrl?.message} hint="Portrait crop shown on phones">
            <Controller
              control={control}
              name="mobileImageUrl"
              render={({ field }) => <ImageInput value={field.value} onChange={field.onChange} folder="banners" aspect="aspect-[4/5] max-w-48" />}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {banner ? "Save changes" : "Create banner"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BannersManager({ banners }: { banners: BannerRow[] }) {
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [open, setOpen] = useState(false);
  const { run } = useAdminAction();
  const groups = PLACEMENTS.map((p) => ({ ...p, items: banners.filter((b) => b.placement === p.value) })).filter((g) => g.items.length);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus /> New banner
        </Button>
      </div>
      {banners.length === 0 && (
        <EmptyState icon={ImageIcon} title="No banners yet" description="Create a hero banner to welcome visitors on the homepage." />
      )}
      {groups.map((group) => {
        const ids = group.items.map((b) => b.id);
        return (
          <div key={group.value}>
            <h3 className="mb-3 font-sans text-sm font-semibold tracking-normal">{group.label}</h3>
            <ul className="divide-y rounded-lg border">
              {group.items.map((b, i) => {
                const schedule = scheduleState(b);
                return (
                  <li key={b.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.imageUrl} alt="" className="aspect-[21/9] w-full rounded-md object-cover sm:w-40" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{b.ctaHref ? `${b.ctaLabel ?? "Link"} → ${b.ctaHref}` : "No button"}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <ActiveBadge active={b.isActive} />
                        {schedule && <ToneBadge tone={schedule.tone}>{schedule.label}</ToneBadge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MoveButtons entity="banner" ids={ids} index={i} label={b.title} />
                      <Switch
                        checked={b.isActive}
                        aria-label={b.isActive ? "Disable banner" : "Enable banner"}
                        onCheckedChange={(v) =>
                          run(() => api(`/api/admin/content/banners/${b.id}`, { method: "PATCH", body: { isActive: v } }), v ? "Banner enabled" : "Banner disabled")
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${b.title}`}
                        onClick={() => {
                          setEditing(b);
                          setOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${b.title}`}>
                            <Trash2 className="text-destructive" />
                          </Button>
                        }
                        title="Delete this banner?"
                        description={`“${b.title}” will be removed from the homepage permanently.`}
                        confirmLabel="Delete"
                        destructive
                        onConfirm={() => run(() => api(`/api/admin/content/banners/${b.id}`, { method: "DELETE" }), "Banner deleted")}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <BannerDialog banner={editing} open={open} onOpenChange={setOpen} nextSort={banners.length} />
    </div>
  );
}

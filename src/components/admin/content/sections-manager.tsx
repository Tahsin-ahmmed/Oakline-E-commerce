"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/form-field";
import { ActiveBadge, ToneBadge } from "@/components/shared/status-badge";
import { ImageInput, ImageListInput } from "@/components/admin/image-input";
import { api, ApiClientError } from "@/lib/api-client";
import { PRODUCT_SOURCES } from "@/lib/validations/admin/content";
import { MoveButtons, useAdminAction, useFormSubmit } from "@/components/admin/content/shared";

export interface SectionRow {
  id: string;
  key: string;
  type: string;
  title: string;
  subtitle: string | null;
  isActive: boolean;
  sortOrder: number;
  config: unknown;
}

const TYPE_LABELS: Record<string, string> = {
  hero: "Hero banners",
  categories: "Category grid",
  products: "Product carousel",
  promo: "Promo banner",
  collections: "Featured collections",
  story: "Brand story",
  testimonials: "Testimonials",
  newsletter: "Newsletter",
  instagram: "Instagram",
};

const SOURCE_LABELS: Record<string, string> = {
  featured: "Featured products",
  trending: "Trending (last 30 days)",
  best_sellers: "Best sellers",
  new_arrivals: "New arrivals",
  sale: "On sale",
};

const MANAGED_ELSEWHERE: Record<string, string> = {
  hero: "Content comes from Hero banners on the Banners tab.",
  promo: "Content comes from Promo banners on the Banners tab.",
  testimonials: "Quotes are managed under Testimonials.",
  newsletter: "Heading and text are set in Store settings → Newsletter.",
};

type Cfg = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown, d: number) => (typeof v === "number" ? v : d);

function SectionDialog({ section, onClose }: { section: SectionRow; onClose: () => void }) {
  const submit = useFormSubmit();
  const [title, setTitle] = useState(section.title);
  const [subtitle, setSubtitle] = useState(section.subtitle ?? "");
  const [isActive, setActive] = useState(section.isActive);
  const [cfg, setCfg] = useState<Cfg>(() => ({ ...((section.config as Cfg) ?? {}) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: unknown) => setCfg((c) => ({ ...c, [k]: v }));
  const hasConfig = ["products", "categories", "collections", "story", "instagram"].includes(section.type);

  const save = async () => {
    setErrors({});
    if (!title.trim()) {
      setErrors({ title: "Add a title" });
      return;
    }
    setSaving(true);
    const res = await submit(
      () =>
        api(`/api/admin/content/sections/${section.id}`, {
          method: "PUT",
          body: { title, subtitle, isActive, ...(hasConfig ? { config: cfg } : {}) },
        }).catch((e) => {
          if (e instanceof ApiClientError && e.details) {
            const map: Record<string, string> = {};
            for (const [k, v] of Object.entries(e.details)) map[k.replace(/^config\./, "")] = Array.isArray(v) ? v[0] : String(v);
            setErrors(map);
          }
          throw e;
        }),
      "Section saved",
    );
    setSaving(false);
    if (res) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit “{section.title}”</DialogTitle>
          <DialogDescription>{TYPE_LABELS[section.type] ?? section.type}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Heading" htmlFor="s-title" error={errors.title} required>
            <Input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Subheading" htmlFor="s-sub" error={errors.subtitle}>
            <Input id="s-sub" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={isActive} onCheckedChange={setActive} /> Show on homepage
          </label>

          {MANAGED_ELSEWHERE[section.type] && <p className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">{MANAGED_ELSEWHERE[section.type]}</p>}

          {section.type === "products" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product source" error={errors.source}>
                <Select value={s(cfg.source) || "featured"} onValueChange={(v) => set("source", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_SOURCES.map((src) => (
                      <SelectItem key={src} value={src}>
                        {SOURCE_LABELS[src]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Number of products" htmlFor="s-limit" error={errors.limit} hint="2–24">
                <Input id="s-limit" type="number" min={2} max={24} value={n(cfg.limit, 8)} onChange={(e) => set("limit", e.target.valueAsNumber)} />
              </Field>
            </div>
          )}
          {(section.type === "categories" || section.type === "collections") && (
            <Field label={`Number of ${section.type}`} htmlFor="s-limit" error={errors.limit}>
              <Input
                id="s-limit"
                type="number"
                min={1}
                max={12}
                value={n(cfg.limit, section.type === "categories" ? 6 : 4)}
                onChange={(e) => set("limit", e.target.valueAsNumber)}
              />
            </Field>
          )}
          {section.type === "story" && (
            <>
              <Field label="Eyebrow" htmlFor="s-eyebrow" error={errors.eyebrow}>
                <Input id="s-eyebrow" value={s(cfg.eyebrow)} onChange={(e) => set("eyebrow", e.target.value)} />
              </Field>
              <Field label="Story" htmlFor="s-body" error={errors.body} required>
                <Textarea id="s-body" rows={5} value={s(cfg.body)} onChange={(e) => set("body", e.target.value)} />
              </Field>
              <Field label="Image" error={errors.imageUrl}>
                <ImageInput value={s(cfg.imageUrl)} onChange={(v) => set("imageUrl", v)} folder="banners" aspect="aspect-[4/3]" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Button label" htmlFor="s-cta" error={errors.ctaLabel}>
                  <Input id="s-cta" value={s(cfg.ctaLabel)} onChange={(e) => set("ctaLabel", e.target.value)} />
                </Field>
                <Field label="Button link" htmlFor="s-href" error={errors.ctaHref}>
                  <Input id="s-href" value={s(cfg.ctaHref)} onChange={(e) => set("ctaHref", e.target.value)} placeholder="/about" />
                </Field>
              </div>
            </>
          )}
          {section.type === "instagram" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Handle" htmlFor="s-handle" error={errors.handle} hint="Without @">
                  <Input id="s-handle" value={s(cfg.handle)} onChange={(e) => set("handle", e.target.value)} />
                </Field>
                <Field label="Profile URL" htmlFor="s-url" error={errors.url}>
                  <Input id="s-url" value={s(cfg.url)} onChange={(e) => set("url", e.target.value)} placeholder="https://instagram.com/…" />
                </Field>
              </div>
              <Field label="Images" error={errors.images ?? Object.entries(errors).find(([k]) => k.startsWith("images."))?.[1]}>
                <ImageListInput
                  value={(Array.isArray(cfg.images) ? (cfg.images as string[]) : []).map((url) => ({ url }))}
                  onChange={(imgs) => set("images", imgs.map((i) => i.url))}
                  folder="banners"
                  max={12}
                />
              </Field>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Save section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function configSummary(sec: SectionRow) {
  const c = (sec.config as Cfg) ?? {};
  if (sec.type === "products") return `${SOURCE_LABELS[s(c.source)] ?? "Products"} · ${n(c.limit, 8)} items`;
  if (sec.type === "categories" || sec.type === "collections") return `Shows up to ${n(c.limit, sec.type === "categories" ? 6 : 4)}`;
  if (sec.type === "instagram") return `@${s(c.handle) || "—"} · ${Array.isArray(c.images) ? c.images.length : 0} images`;
  return MANAGED_ELSEWHERE[sec.type] ?? null;
}

export function SectionsManager({ sections }: { sections: SectionRow[] }) {
  const [editing, setEditing] = useState<SectionRow | null>(null);
  const { run } = useAdminAction();
  const ids = sections.map((x) => x.id);
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">Sections appear on the homepage in this order. Hidden sections are skipped.</p>
      <ol className="divide-y rounded-lg border">
        {sections.map((sec, i) => (
          <li key={sec.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{sec.title}</p>
              <p className="text-xs text-muted-foreground">
                {TYPE_LABELS[sec.type] ?? sec.type}
                {configSummary(sec) ? ` · ${configSummary(sec)}` : ""}
              </p>
            </div>
            <ToneBadge tone="neutral" className="hidden sm:inline-flex">
              {sec.key}
            </ToneBadge>
            <ActiveBadge active={sec.isActive} on="Visible" off="Hidden" />
            <MoveButtons entity="section" ids={ids} index={i} label={sec.title} />
            <Switch
              checked={sec.isActive}
              aria-label={sec.isActive ? "Hide section" : "Show section"}
              onCheckedChange={(v) => run(() => api(`/api/admin/content/sections/${sec.id}`, { method: "PATCH", body: { isActive: v } }), v ? "Section shown" : "Section hidden")}
            />
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${sec.title}`} onClick={() => setEditing(sec)}>
              <Pencil />
            </Button>
          </li>
        ))}
      </ol>
      {editing && <SectionDialog key={editing.id} section={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

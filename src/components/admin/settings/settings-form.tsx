"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/form-field";
import { Panel } from "@/components/admin/page-header";
import { ImageInput } from "@/components/admin/image-input";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { CRITICAL_SETTINGS_GROUPS, type Settings, type SettingsGroup } from "@/lib/validations/settings";
import { cn } from "@/lib/utils";

type FieldDef =
  | { name: string; label: string; type: "text" | "email" | "url"; hint?: string; placeholder?: string }
  | { name: string; label: string; type: "textarea"; hint?: string; rows?: number }
  | { name: string; label: string; type: "number"; hint?: string; step?: string }
  | { name: string; label: string; type: "switch"; hint?: string }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; hint?: string }
  | { name: string; label: string; type: "image"; aspect?: string; hint?: string };

const GROUPS: { key: SettingsGroup; title: string; description: string; fields: FieldDef[] }[] = [
  {
    key: "general",
    title: "General",
    description: "Store identity and contact details shown across the site and in emails.",
    fields: [
      { name: "siteName", label: "Website name", type: "text" },
      { name: "tagline", label: "Tagline", type: "text" },
      { name: "contactEmail", label: "Contact email", type: "email" },
      { name: "phone", label: "Phone number", type: "text" },
      { name: "address", label: "Address", type: "textarea", rows: 2 },
      {
        name: "currency",
        label: "Currency",
        type: "select",
        hint: "Changing currency doesn't convert existing prices.",
        options: ["BDT", "USD", "EUR", "GBP", "INR"].map((c) => ({ value: c, label: c })),
      },
      {
        name: "language",
        label: "Default language",
        type: "select",
        options: [
          { value: "en", label: "English" },
          { value: "bn", label: "বাংলা (Bangla)" },
        ],
      },
      { name: "logoUrl", label: "Logo", type: "image", aspect: "aspect-[3/1]", hint: "Leave empty to use the text wordmark." },
      { name: "faviconUrl", label: "Favicon", type: "image", aspect: "aspect-square max-w-32", hint: "Square PNG, at least 64×64." },
    ],
  },
  {
    key: "social",
    title: "Social",
    description: "Links shown in the footer. Leave blank to hide.",
    fields: ["instagram", "facebook", "pinterest", "youtube", "tiktok"].map((n) => ({
      name: n,
      label: n === "tiktok" ? "TikTok" : n === "youtube" ? "YouTube" : n[0].toUpperCase() + n.slice(1),
      type: "url" as const,
      placeholder: "https://",
    })),
  },
  {
    key: "commerce",
    title: "Commerce",
    description: "Tax, delivery thresholds, stock alerts and payment options.",
    fields: [
      { name: "taxEnabled", label: "Charge tax / VAT", type: "switch" },
      { name: "taxRate", label: "Tax rate (%)", type: "number", step: "0.01" },
      { name: "taxInclusive", label: "Prices include tax", type: "switch", hint: "When on, tax is reported on invoices but not added at checkout." },
      { name: "freeShippingThreshold", label: "Free delivery threshold", type: "number", step: "0.01", hint: "Order value (after discounts) for free delivery. 0 disables it." },
      { name: "lowStockThreshold", label: "Low-stock alert threshold", type: "number" },
      { name: "codEnabled", label: "Offer Cash on Delivery", type: "switch" },
      { name: "orderPrefix", label: "Order number prefix", type: "text", hint: "2–6 uppercase letters, e.g. OAK" },
      { name: "returnWindowDays", label: "Return window (days)", type: "number" },
    ],
  },
  {
    key: "policies",
    title: "Policies",
    description: "Short summaries shown on product pages.",
    fields: [
      { name: "shippingInfo", label: "Shipping information", type: "textarea", rows: 3 },
      { name: "returnInfo", label: "Return policy summary", type: "textarea", rows: 3 },
    ],
  },
  {
    key: "seo",
    title: "SEO",
    description: "Defaults for pages without their own SEO metadata.",
    fields: [
      { name: "defaultTitle", label: "Default title", type: "text" },
      { name: "defaultDescription", label: "Default description", type: "textarea", rows: 3 },
      { name: "ogImageUrl", label: "Social sharing image", type: "image", aspect: "aspect-[1200/630]", hint: "1200×630 recommended." },
    ],
  },
  {
    key: "announcement",
    title: "Announcement bar",
    description: "The thin bar above the header.",
    fields: [
      { name: "enabled", label: "Show announcement bar", type: "switch" },
      { name: "text", label: "Text", type: "text" },
      { name: "link", label: "Link", type: "text", placeholder: "/shipping-policy" },
    ],
  },
  {
    key: "newsletter",
    title: "Newsletter",
    description: "Sign-up block on the homepage and in the footer.",
    fields: [
      { name: "enabled", label: "Show newsletter sign-up", type: "switch" },
      { name: "heading", label: "Heading", type: "text" },
      { name: "subheading", label: "Subheading", type: "textarea", rows: 2 },
    ],
  },
  {
    key: "tracking",
    title: "Tracking & ads",
    description: "Visitor analytics and the Meta (Facebook) Pixel for ad measurement and retargeting.",
    fields: [
      { name: "analyticsEnabled", label: "Record visitor analytics", type: "switch", hint: "Powers Admin → Traffic & sources. No IP addresses are stored." },
      { name: "excludeStaff", label: "Exclude staff visits", type: "switch", hint: "Visits while signed in as staff aren't counted." },
      {
        name: "metaPixelId",
        label: "Meta Pixel ID",
        type: "text",
        placeholder: "e.g. 123456789012345",
        hint: "From Meta Events Manager → Data sources. Sends PageView, ViewContent, AddToCart, InitiateCheckout and Purchase events. Leave empty to disable.",
      },
    ],
  },
  {
    key: "maintenance",
    title: "Maintenance",
    description: "Temporarily close the storefront. Staff can still browse the store and use the admin.",
    fields: [
      { name: "enabled", label: "Maintenance mode", type: "switch", hint: "Customers will see the maintenance message instead of the shop." },
      { name: "message", label: "Message", type: "textarea", rows: 2 },
    ],
  },
];

function GroupForm({
  group,
  initial,
  locked,
}: {
  group: (typeof GROUPS)[number];
  initial: Record<string, unknown>;
  locked: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [saved, setSaved] = useState<Record<string, unknown>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await api<Record<string, unknown>>(`/api/admin/settings/${group.key}`, { method: "PATCH", body: values });
      setValues(res);
      setSaved(res);
      toast.success(`${group.title} settings saved`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.details)) out[k] = Array.isArray(v) ? String(v[0]) : String(v);
        setErrors(out);
      }
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={group.title} description={group.description}>
      {locked && (
        <p className="mb-5 flex items-center gap-2 rounded-md bg-secondary/70 px-3 py-2 text-sm">
          <Lock className="size-4 shrink-0" /> Only a Super Admin can change these settings. You can view them.
        </p>
      )}
      <form onSubmit={submit} className="grid gap-5">
        <fieldset disabled={locked || busy} className="grid gap-5 sm:grid-cols-2">
          {group.fields.map((f) => {
            const id = `${group.key}-${f.name}`;
            const error = errors[f.name];
            const full = f.type === "textarea" || f.type === "image" || f.type === "switch";
            const cls = cn(full && "sm:col-span-2");
            switch (f.type) {
              case "switch":
                return (
                  <div key={f.name} className={cn("flex items-start justify-between gap-4 rounded-lg border px-4 py-3", cls)}>
                    <div>
                      <label htmlFor={id} className="text-sm font-medium">
                        {f.label}
                      </label>
                      {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                    </div>
                    <Switch id={id} checked={Boolean(values[f.name])} onCheckedChange={(c) => set(f.name, c)} disabled={locked} />
                  </div>
                );
              case "textarea":
                return (
                  <Field key={f.name} label={f.label} htmlFor={id} error={error} hint={f.hint} className={cls}>
                    <Textarea id={id} rows={f.rows} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />
                  </Field>
                );
              case "select":
                return (
                  <Field key={f.name} label={f.label} htmlFor={id} error={error} hint={f.hint}>
                    <Select value={String(values[f.name] ?? "")} onValueChange={(v) => set(f.name, v)} disabled={locked}>
                      <SelectTrigger id={id} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                );
              case "image":
                return (
                  <Field key={f.name} label={f.label} error={error} hint={f.hint} className={cls}>
                    <div className="max-w-md">
                      <ImageInput folder="branding" value={String(values[f.name] ?? "")} onChange={(url) => set(f.name, url)} aspect={f.aspect} />
                    </div>
                  </Field>
                );
              case "number":
                return (
                  <Field key={f.name} label={f.label} htmlFor={id} error={error} hint={f.hint}>
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      step={f.step ?? "1"}
                      value={String(values[f.name] ?? "")}
                      onChange={(e) => set(f.name, e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </Field>
                );
              default:
                return (
                  <Field key={f.name} label={f.label} htmlFor={id} error={error} hint={f.hint}>
                    <Input
                      id={id}
                      type={f.type}
                      placeholder={"placeholder" in f ? f.placeholder : undefined}
                      value={String(values[f.name] ?? "")}
                      onChange={(e) => set(f.name, f.name === "orderPrefix" ? e.target.value.toUpperCase() : e.target.value)}
                    />
                  </Field>
                );
            }
          })}
        </fieldset>
        {!locked && (
          <div className="flex items-center justify-end gap-3 border-t pt-4">
            {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
            <Button type="button" variant="ghost" disabled={!dirty || busy} onClick={() => (setValues(saved), setErrors({}))}>
              Reset
            </Button>
            <Button type="submit" disabled={!dirty || busy}>
              {busy && <Loader2 className="animate-spin" />}
              Save {group.title.toLowerCase()}
            </Button>
          </div>
        )}
      </form>
    </Panel>
  );
}

const INTEGRATIONS = [
  { key: "cloudinary", label: "Cloudinary image uploads", env: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET" },
  { key: "stripe", label: "Stripe card payments", env: "STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" },
  { key: "stripeWebhook", label: "Stripe webhook", env: "STRIPE_WEBHOOK_SECRET (endpoint: /api/webhooks/stripe)" },
  { key: "smtp", label: "Email delivery (SMTP)", env: "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM" },
] as const;

export function SettingsTabs({
  settings,
  integrations,
  canCritical,
}: {
  settings: Settings;
  integrations: Record<(typeof INTEGRATIONS)[number]["key"], boolean>;
  canCritical: boolean;
}) {
  return (
    <Tabs defaultValue="general" className="gap-5">
      <TabsList className="h-auto flex-wrap">
        {GROUPS.map((g) => (
          <TabsTrigger key={g.key} value={g.key}>
            {g.title}
          </TabsTrigger>
        ))}
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
      </TabsList>
      {GROUPS.map((g) => (
        <TabsContent key={g.key} value={g.key} className="max-w-3xl">
          <GroupForm
            group={g}
            initial={settings[g.key] as Record<string, unknown>}
            locked={CRITICAL_SETTINGS_GROUPS.includes(g.key) && !canCritical}
          />
        </TabsContent>
      ))}
      <TabsContent value="integrations" className="max-w-3xl">
        <Panel title="Integrations" description="Credentials are read from server environment variables and are never shown here.">
          <ul className="divide-y">
            {INTEGRATIONS.map((i) => {
              const on = integrations[i.key];
              return (
                <li key={i.key} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{i.label}</p>
                    <p className="mt-0.5 font-mono text-[0.7rem] text-muted-foreground">{i.env}</p>
                  </div>
                  <span className={cn("flex shrink-0 items-center gap-1 text-sm", on ? "text-success" : "text-muted-foreground")}>
                    {on ? <Check className="size-4" /> : <CircleAlert className="size-4" />}
                    {on ? "Configured" : "Not configured"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Without Cloudinary, paste image URLs instead of uploading. Without Stripe, only Cash on Delivery is offered. Without SMTP,
            emails are written to the server log.
          </p>
        </Panel>
      </TabsContent>
    </Tabs>
  );
}

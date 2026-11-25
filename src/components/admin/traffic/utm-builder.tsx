"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PRESETS = {
  facebook_ads: { label: "Facebook ad", source: "facebook", medium: "paid_social" },
  instagram_ads: { label: "Instagram ad", source: "instagram", medium: "paid_social" },
  facebook_post: { label: "Facebook post / page", source: "facebook", medium: "social" },
  instagram_bio: { label: "Instagram bio / story", source: "instagram", medium: "social" },
  whatsapp: { label: "WhatsApp message", source: "whatsapp", medium: "social" },
  google_ads: { label: "Google Ads", source: "google", medium: "cpc" },
  email: { label: "Email newsletter", source: "newsletter", medium: "email" },
  influencer: { label: "Influencer / partner", source: "influencer", medium: "referral" },
} as const;
type PresetKey = keyof typeof PRESETS;

const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

/** Meta's URL-parameter template: Ads Manager fills campaign/ad names automatically for every ad. */
const META_TEMPLATE =
  "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          toast.success(`${label} copied`);
          setTimeout(() => setDone(false), 1800);
        } catch {
          toast.error("Couldn't copy — select the text and copy it manually.");
        }
      }}
    >
      {done ? <Check /> : <Copy />} Copy
    </Button>
  );
}

export function UtmBuilder({ siteUrl }: { siteUrl: string }) {
  const [preset, setPreset] = useState<PresetKey>("facebook_ads");
  const [page, setPage] = useState("/");
  const [campaign, setCampaign] = useState("eid_sale");
  const [content, setContent] = useState("");

  const url = useMemo(() => {
    const base = siteUrl.replace(/\/$/, "");
    const path = page.startsWith("/") ? page : `/${page}`;
    const u = new URL(base + path);
    u.searchParams.set("utm_source", PRESETS[preset].source);
    u.searchParams.set("utm_medium", PRESETS[preset].medium);
    if (slug(campaign)) u.searchParams.set("utm_campaign", slug(campaign));
    if (slug(content)) u.searchParams.set("utm_content", slug(content));
    return u.toString();
  }, [siteUrl, page, preset, campaign, content]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where will you post this link?" htmlFor="utm-preset">
            <Select value={preset} onValueChange={(v) => setPreset(v as PresetKey)}>
              <SelectTrigger id="utm-preset" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRESETS).map(([k, p]) => (
                  <SelectItem key={k} value={k}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Landing page" htmlFor="utm-page" hint="e.g. / or /categories/women">
            <Input id="utm-page" value={page} onChange={(e) => setPage(e.target.value)} />
          </Field>
          <Field label="Campaign name" htmlFor="utm-campaign" hint="Same name for every ad in the campaign">
            <Input id="utm-campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="eid_sale" />
          </Field>
          <Field label="Ad / creative name (optional)" htmlFor="utm-content" hint="Tells you which ad performed best">
            <Input id="utm-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="carousel_bags_v1" />
          </Field>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Your tracking link</p>
          <p className="font-mono text-xs break-all">{url}</p>
          <div className="mt-3">
            <CopyButton value={url} label="Link" />
          </div>
        </div>
      </div>

      <div className="grid content-start gap-3 text-sm">
        <div className="rounded-lg border p-4">
          <p className="font-medium">Tracking every Facebook &amp; Instagram ad automatically</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>In Meta Ads Manager, open your ad and scroll to <strong>Tracking</strong>.</li>
            <li>
              Under <strong>URL parameters</strong>, paste the text below. Meta fills in your campaign, ad set and ad names for every ad.
            </li>
            <li>Results appear here under <strong>Campaigns</strong> and <strong>Ads</strong>, with orders and revenue per ad.</li>
          </ol>
          <p className="mt-3 rounded-md bg-muted/60 p-2.5 font-mono text-xs break-all">{META_TEMPLATE}</p>
          <div className="mt-3">
            <CopyButton value={META_TEMPLATE} label="URL parameters" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: use short, consistent names in lowercase (e.g. <code>eid_sale</code>, <code>reel_handbags_v2</code>) so results group neatly.
        </p>
      </div>
    </div>
  );
}

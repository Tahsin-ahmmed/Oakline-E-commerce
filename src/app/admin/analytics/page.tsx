import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, CircleAlert, Download, Lightbulb, Minus } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { dashboardQuerySchema } from "@/lib/validations/admin/system";
import { str, type SearchParams } from "@/lib/admin-params";
import { CHANNEL_LABELS, sourceLabel, type Channel } from "@/lib/analytics/attribution";
import { getSettings } from "@/services/settings";
import { resolveRange } from "@/services/admin/dashboard";
import {
  getBreakdown,
  getFunnel,
  getLiveVisitors,
  getTrafficOverview,
  getTrafficSeries,
  type BreakdownRow,
  type Dimension,
} from "@/services/admin/traffic";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { RangeFilter } from "@/components/admin/dashboard/range-filter";
import { TrafficChart } from "@/components/admin/traffic/traffic-chart";
import { LiveVisitors } from "@/components/admin/traffic/live-visitors";
import { UtmBuilder } from "@/components/admin/traffic/utm-builder";
import { channelColor } from "@/components/admin/traffic/channel-colors";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Traffic & sources" };

const VIEWS: { key: string; label: string; by: Dimension; nameHeader: string }[] = [
  { key: "sources", label: "Sources", by: "source", nameHeader: "Source" },
  { key: "campaigns", label: "Campaigns", by: "campaign", nameHeader: "Campaign (utm_campaign)" },
  { key: "ads", label: "Ads", by: "ad", nameHeader: "Campaign › Ad (utm_content)" },
  { key: "landing", label: "Landing pages", by: "landing", nameHeader: "Landing page" },
  { key: "devices", label: "Devices", by: "device", nameHeader: "Device" },
  { key: "browsers", label: "Browsers & apps", by: "browser", nameHeader: "Browser" },
  { key: "cities", label: "Cities", by: "city", nameHeader: "City" },
  { key: "referrers", label: "Referring sites", by: "referrer", nameHeader: "Referrer" },
];

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const ratio = (a: number, b: number) => (b ? a / b : 0);
const nf = (v: number) => v.toLocaleString("en-IN");

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function Delta({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground">New this period</span>;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", value === 0 ? "text-muted-foreground" : good ? "text-success" : "text-destructive")}>
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(value)}%<span className="ml-1 font-normal text-muted-foreground">vs previous</span>
    </span>
  );
}

function Kpi({ label, value, delta, invert, sub }: { label: string; value: string; delta: number | null; invert?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-heading text-[1.75rem] leading-none tabular-nums">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
      <div className="mt-3">
        <Delta value={delta} invert={invert} />
      </div>
    </div>
  );
}

function displayName(by: Dimension, key: string) {
  if (by === "source") return sourceLabel(key);
  if (by === "channel") return CHANNEL_LABELS[key as Channel] ?? key;
  if (by === "device") return key.charAt(0).toUpperCase() + key.slice(1);
  return key;
}

function BreakdownTable({ rows, by, nameHeader, currency }: { rows: BreakdownRow[]; by: Dimension; nameHeader: string; currency: string }) {
  if (!rows.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {by === "campaign" || by === "ad"
          ? "No tagged campaign visits in this period. Use the link builder below to tag your ads."
          : "No visits in this period yet."}
      </p>
    );
  }
  const maxSessions = Math.max(...rows.map((r) => r.sessions));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2.5 pr-3 font-medium">{nameHeader}</th>
            <th className="py-2.5 text-right font-medium">Visits</th>
            <th className="py-2.5 text-right font-medium">Visitors</th>
            <th className="py-2.5 text-right font-medium" title="Visits that viewed only one page">Bounce</th>
            <th className="py-2.5 text-right font-medium" title="Visits that added something to the bag">Add to bag</th>
            <th className="py-2.5 text-right font-medium">Orders</th>
            <th className="py-2.5 text-right font-medium" title="Visits that placed an order">Conv. rate</th>
            <th className="py-2.5 text-right font-medium">Revenue</th>
            <th className="py-2.5 text-right font-medium" title="Revenue per visit — compare with your cost per click">Value / visit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-0 hover:bg-secondary/30">
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  {(by === "channel" || r.channel) && (
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: channelColor(by === "channel" ? r.key : r.channel!) }} />
                  )}
                  <div className="min-w-0">
                    <p className="max-w-[22rem] truncate font-medium" title={r.key}>
                      {displayName(by, r.key)}
                    </p>
                    {r.source && <p className="text-xs text-muted-foreground">{sourceLabel(r.source)}</p>}
                    {by === "source" && r.channel && <p className="text-xs text-muted-foreground">{CHANNEL_LABELS[r.channel as Channel] ?? r.channel}</p>}
                  </div>
                </div>
                <div className="mt-1.5 h-1 max-w-[22rem] rounded-full bg-muted">
                  <div className="h-1 rounded-full bg-clay/70" style={{ width: `${(r.sessions / maxSessions) * 100}%` }} />
                </div>
              </td>
              <td className="py-2.5 text-right tabular-nums">{nf(r.sessions)}</td>
              <td className="py-2.5 text-right tabular-nums">{nf(r.visitors)}</td>
              <td className="py-2.5 text-right tabular-nums">{pct(ratio(r.bounces, r.sessions), 0)}</td>
              <td className="py-2.5 text-right tabular-nums">{pct(ratio(r.addToCart, r.sessions))}</td>
              <td className="py-2.5 text-right tabular-nums">{nf(r.orders)}</td>
              <td className="py-2.5 text-right font-medium tabular-nums">{pct(ratio(r.orders, r.sessions), 2)}</td>
              <td className="py-2.5 text-right tabular-nums">{formatMoney(r.revenue, currency)}</td>
              <td className="py-2.5 text-right tabular-nums">{formatMoney(Math.round(ratio(r.revenue, r.sessions) * 100) / 100, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Plain-language findings from the data, aimed at ad decisions. */
function buildInsights(sources: BreakdownRow[], campaigns: BreakdownRow[], ads: BreakdownRow[], devices: BreakdownRow[], currency: string) {
  const out: string[] = [];
  const MIN = 30;
  const conv = (r: BreakdownRow) => ratio(r.orders, r.sessions);
  const name = (r: BreakdownRow) => (r.channel ? `${sourceLabel(r.key)} (${(CHANNEL_LABELS[r.channel as Channel] ?? r.channel).toLowerCase()})` : sourceLabel(r.key));
  const solid = sources.filter((r) => r.sessions >= MIN);
  if (solid.length) {
    const topRev = [...sources].sort((a, b) => b.revenue - a.revenue)[0];
    if (topRev?.revenue > 0) out.push(`${name(topRev)} brought the most revenue (${formatMoney(topRev.revenue, currency)} from ${nf(topRev.sessions)} visits).`);
    const best = [...solid].sort((a, b) => conv(b) - conv(a))[0];
    if (best && conv(best) > 0) out.push(`${name(best)} visitors convert best at ${pct(conv(best), 2)} — worth more budget or content.`);
    const worst = [...solid].filter((r) => r !== best).sort((a, b) => conv(a) - conv(b))[0];
    if (worst && solid.length > 2) out.push(`${name(worst)} converts lowest (${pct(conv(worst), 2)}). Check the landing page and offer for that audience.`);
  }
  const solidCampaigns = campaigns.filter((r) => r.sessions >= MIN);
  if (solidCampaigns.length) {
    const best = [...solidCampaigns].sort((a, b) => ratio(b.revenue, b.sessions) - ratio(a.revenue, a.sessions))[0];
    out.push(
      `Best campaign by value per visit: “${best.key}” at ${formatMoney(Math.round(ratio(best.revenue, best.sessions) * 100) / 100, currency)}/visit. If your cost per click is below this, the campaign is profitable before product costs.`,
    );
  }
  const solidAds = ads.filter((r) => r.sessions >= MIN);
  if (solidAds.length > 1) {
    const sorted = [...solidAds].sort((a, b) => conv(b) - conv(a));
    out.push(`Top ad creative: ${sorted[0].key.split(" › ")[1]} (${pct(conv(sorted[0]), 2)} conversion) vs weakest ${sorted.at(-1)!.key.split(" › ")[1]} (${pct(conv(sorted.at(-1)!), 2)}).`);
  }
  const mobile = devices.find((d) => d.key === "mobile");
  const total = devices.reduce((s, d) => s + d.sessions, 0);
  if (mobile && total) out.push(`${pct(ratio(mobile.sessions, total), 0)} of visits are on mobile — preview ads and landing pages on a phone first.`);
  return out.slice(0, 5);
}

export default async function TrafficPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("dashboard.view", "/admin/analytics");
  const sp = await searchParams;
  const q = dashboardQuerySchema.parse({ range: str(sp, "range"), from: str(sp, "from"), to: str(sp, "to") });
  const range = resolveRange(q);
  const view = VIEWS.find((v) => v.key === str(sp, "view")) ?? VIEWS[0];

  const [settings, overview, series, live, funnel, channels, sources, campaigns, ads, devices] = await Promise.all([
    getSettings(),
    getTrafficOverview(range),
    getTrafficSeries(range),
    getLiveVisitors(),
    getFunnel(range),
    getBreakdown(range, "channel", 10),
    getBreakdown(range, "source", 25),
    getBreakdown(range, "campaign", 25),
    getBreakdown(range, "ad", 40),
    getBreakdown(range, "device", 5),
  ]);
  const table = view.by === "source" ? sources : view.by === "campaign" ? campaigns : view.by === "ad" ? ads : view.by === "device" ? devices : await getBreakdown(range, view.by, 50);
  const currency = settings.general.currency;
  const { current: c, previous: p } = overview;
  const insights = buildInsights(sources, campaigns, ads, devices, currency);
  const pixelOn = Boolean(settings.tracking.metaPixelId);
  const siteUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const totalChannelSessions = channels.reduce((s, r) => s + r.sessions, 0);
  const qs = (extra: Record<string, string>) => {
    const u = new URLSearchParams();
    if (q.range !== "30d") u.set("range", q.range);
    if (q.from) u.set("from", q.from);
    if (q.to) u.set("to", q.to);
    for (const [k, v] of Object.entries(extra)) u.set(k, v);
    return u.toString();
  };
  const mins = Math.floor(c.avgSessionSeconds / 60);
  const secs = c.avgSessionSeconds % 60;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Traffic & sources"
        description={`Where your visitors come from and which sources turn into orders · ${range.label}`}
        actions={<RangeFilter active={range.key} from={q.from} to={q.to} />}
      />

      {!settings.tracking.analyticsEnabled && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            Visitor analytics is turned off, so new visits aren&apos;t being recorded.{" "}
            <Link href="/admin/settings" className="font-medium underline underline-offset-4">
              Turn it on in Store settings → Tracking &amp; ads
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Visitors" value={nf(c.visitors)} delta={change(c.visitors, p.visitors)} sub="Unique people" />
        <Kpi label="Visits" value={nf(c.sessions)} delta={change(c.sessions, p.sessions)} sub={`${c.pagesPerSession.toFixed(1)} pages per visit`} />
        <Kpi label="Conversion rate" value={pct(c.conversionRate, 2)} delta={change(c.conversionRate, p.conversionRate)} sub="Visits that ordered" />
        <Kpi label="Orders from visits" value={nf(c.orders)} delta={change(c.orders, p.orders)} sub={`${pct(c.addToCartRate)} added to bag`} />
        <Kpi label="Tracked revenue" value={formatMoney(Math.round(c.revenue), currency)} delta={change(c.revenue, p.revenue)} sub={`${formatMoney(Math.round(ratio(c.revenue, c.sessions) * 100) / 100, currency)} per visit`} />
        <Kpi label="Bounce rate" value={pct(c.bounceRate, 0)} delta={change(c.bounceRate, p.bounceRate)} invert sub={`Avg. visit ${mins}m ${String(secs).padStart(2, "0")}s`} />
      </div>

      {insights.length > 0 && (
        <Panel title="Key insights" description="Generated from this period's data — visits with fewer than 30 sessions are ignored.">
          <ul className="grid gap-2.5 md:grid-cols-2">
            {insights.map((i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-clay" />
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TrafficChart points={series.points} channels={series.channels} />
        </div>
        <LiveVisitors initial={live} />
      </div>

      <Panel title="Channels" description="How each type of traffic performs — share of visits, conversion and revenue.">
        {channels.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No visits in this period yet.</p>
        ) : (
          <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
            {channels.map((r) => (
              <div key={r.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="size-2.5 rounded-sm" style={{ backgroundColor: channelColor(r.key) }} />
                    {CHANNEL_LABELS[r.key as Channel] ?? r.key}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {nf(r.sessions)} visits · {pct(ratio(r.orders, r.sessions), 2)} conv. · {formatMoney(Math.round(r.revenue), currency)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full" style={{ width: `${ratio(r.sessions, totalChannelSessions) * 100}%`, backgroundColor: channelColor(r.key) }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <section className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 border-b px-5 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Breakdown">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={`/admin/analytics?${qs({ view: v.key })}`}
                scroll={false}
                aria-current={v.key === view.key ? "page" : undefined}
                className={cn(
                  "shrink-0 border-b-2 px-3 pb-3 text-sm whitespace-nowrap transition",
                  v.key === view.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {v.label}
              </Link>
            ))}
          </nav>
          <Button asChild variant="outline" size="sm" className="mb-3">
            <a href={`/api/admin/traffic/export?${qs({ by: view.by })}`}>
              <Download /> Export CSV
            </a>
          </Button>
        </div>
        <div className="px-5 pb-2">
          <BreakdownTable rows={table} by={view.by} nameHeader={view.nameHeader} currency={currency} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Purchase funnel" description="Where visitors drop off on the way to an order.">
          <ol className="space-y-3">
            {funnel.map((f, i) => {
              const top = funnel[0].value || 1;
              const prev = i > 0 ? funnel[i - 1].value : f.value;
              return (
                <li key={f.step}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{f.step}</span>
                    <span className="tabular-nums">
                      <span className="font-medium">{nf(f.value)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {pct(ratio(f.value, top), 1)}
                        {i > 0 && ` · ${pct(ratio(f.value, prev), 0)} of previous`}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-muted">
                    <div className="h-2.5 rounded-full bg-primary" style={{ width: `${Math.max(1.5, ratio(f.value, top) * 100)}%`, opacity: 1 - i * 0.14 }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel title="Meta Pixel" description="Lets Facebook optimise ads for purchases and build retargeting audiences.">
          {pixelOn ? (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="size-4" /> Connected — Pixel {settings.tracking.metaPixelId}
              </p>
              <p className="text-muted-foreground">
                Sending <strong>PageView</strong>, <strong>ViewContent</strong>, <strong>AddToCart</strong>, <strong>InitiateCheckout</strong> and{" "}
                <strong>Purchase</strong> (with order value). In Ads Manager, choose the <em>Sales</em> objective and optimise for <em>Purchase</em>.
              </p>
              <p className="text-muted-foreground">Check events live in Meta Events Manager → Test events.</p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-warning">
                <CircleAlert className="size-4" /> Not connected
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Open Meta Events Manager → Connect data sources → Web → create a Pixel.</li>
                <li>Copy the Pixel ID (a 15–16 digit number).</li>
                <li>
                  Paste it in{" "}
                  <Link href="/admin/settings" className="font-medium text-foreground underline underline-offset-4">
                    Store settings → Tracking &amp; ads
                  </Link>
                  .
                </li>
              </ol>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Campaign link builder" description="Tag every link you share so its visits, orders and revenue show up in Campaigns and Ads above.">
        <UtmBuilder siteUrl={siteUrl} />
      </Panel>

      <p className="text-xs text-muted-foreground">
        Visits are counted on this website with a first-party cookie; bots and staff are excluded and no IP addresses are stored. Revenue is the value of
        orders placed during tracked visits (before cancellations). Ad platforms may report different numbers because they count clicks and use their own
        attribution windows.
      </p>
    </div>
  );
}

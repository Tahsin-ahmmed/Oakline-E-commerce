import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { DateRange } from "@/services/admin/dashboard";

/**
 * Traffic & attribution reporting. Everything is computed from first-party AnalyticsSession /
 * AnalyticsEvent rows, scoped to sessions that *started* inside the date range.
 */

export const DIMENSIONS = {
  channel: Prisma.raw(`s."channel"`),
  source: Prisma.raw(`s."source"`),
  campaign: Prisma.raw(`COALESCE(s."campaign", '(none)')`),
  ad: Prisma.raw(`COALESCE(s."campaign", '(none)') || ' › ' || COALESCE(s."utmContent", '(no ad name)')`),
  medium: Prisma.raw(`COALESCE(s."utmMedium", '(none)')`),
  landing: Prisma.raw(`s."landingPath"`),
  device: Prisma.raw(`s."device"`),
  browser: Prisma.raw(`COALESCE(s."browser", 'Other')`),
  os: Prisma.raw(`COALESCE(s."os", 'Other')`),
  country: Prisma.raw(`COALESCE(s."country", '??')`),
  city: Prisma.raw(`COALESCE(s."city", 'Unknown')`),
  referrer: Prisma.raw(`COALESCE(s."referrerHost", '(direct)')`),
} as const;
export type Dimension = keyof typeof DIMENSIONS;

/** For dimension "source", rows are split by channel too (Facebook paid vs Facebook organic are separate). */
export interface BreakdownRow {
  key: string;
  source?: string;
  channel?: string;
  sessions: number;
  visitors: number;
  pageviews: number;
  bounces: number;
  addToCart: number;
  orders: number;
  revenue: number;
}

function stats(from: Date, to: Date) {
  return Prisma.sql`
    s AS (SELECT * FROM "AnalyticsSession" WHERE "startedAt" >= ${from} AND "startedAt" < ${to}),
    ev AS (
      SELECT e."sessionId",
        bool_or(e."type" = 'add_to_cart') AS atc,
        count(*) FILTER (WHERE e."type" = 'purchase') AS orders,
        COALESCE(sum(e."value") FILTER (WHERE e."type" = 'purchase'), 0) AS revenue,
        bool_or(e."type" = 'page_view' AND e."path" LIKE '/products/_%') AS viewed_product,
        bool_or(e."type" = 'page_view' AND e."path" = '/checkout') AS checkout
      FROM "AnalyticsEvent" e
      WHERE e."sessionId" IN (SELECT id FROM s)
      GROUP BY e."sessionId"
    )`;
}

type Num = number | bigint | Prisma.Decimal | string | null;
const n = (v: Num) => (v === null ? 0 : Number(v));

export async function getTrafficTotals(from: Date, to: Date) {
  const [row] = await prisma.$queryRaw<
    { sessions: Num; visitors: Num; pageviews: Num; bounces: Num; atc: Num; purchasers: Num; orders: Num; revenue: Num; avg_seconds: Num }[]
  >`
    WITH ${stats(from, to)}
    SELECT count(*) AS sessions,
      count(DISTINCT s."visitorId") AS visitors,
      COALESCE(sum(s."pageViews"), 0) AS pageviews,
      count(*) FILTER (WHERE s."pageViews" <= 1) AS bounces,
      count(*) FILTER (WHERE ev.atc) AS atc,
      count(*) FILTER (WHERE ev.orders > 0) AS purchasers,
      COALESCE(sum(ev.orders), 0) AS orders,
      COALESCE(sum(ev.revenue), 0) AS revenue,
      COALESCE(avg(EXTRACT(EPOCH FROM (s."lastSeenAt" - s."startedAt"))) FILTER (WHERE s."pageViews" > 1), 0) AS avg_seconds
    FROM s LEFT JOIN ev ON ev."sessionId" = s.id`;
  const sessions = n(row.sessions);
  return {
    sessions,
    visitors: n(row.visitors),
    pageviews: n(row.pageviews),
    bounceRate: sessions ? n(row.bounces) / sessions : 0,
    addToCartRate: sessions ? n(row.atc) / sessions : 0,
    conversionRate: sessions ? n(row.purchasers) / sessions : 0,
    orders: n(row.orders),
    revenue: n(row.revenue),
    pagesPerSession: sessions ? n(row.pageviews) / sessions : 0,
    avgSessionSeconds: Math.round(n(row.avg_seconds)),
  };
}
export type TrafficTotals = Awaited<ReturnType<typeof getTrafficTotals>>;

export async function getTrafficOverview(range: DateRange) {
  const [current, previous] = await Promise.all([
    getTrafficTotals(range.from, range.to),
    getTrafficTotals(range.prevFrom, range.prevTo),
  ]);
  return { current, previous };
}

export async function getBreakdown(range: DateRange, dimension: Dimension, limit = 25): Promise<BreakdownRow[]> {
  const dim = DIMENSIONS[dimension];
  const withSource = dimension === "campaign" || dimension === "ad";
  const rows = await prisma.$queryRaw<
    { key: string; source: string | null; channel: string | null; sessions: Num; visitors: Num; pageviews: Num; bounces: Num; atc: Num; orders: Num; revenue: Num }[]
  >`
    WITH ${stats(range.from, range.to)}
    SELECT ${dim} AS key,
      ${withSource ? Prisma.sql`mode() WITHIN GROUP (ORDER BY s."source")` : Prisma.sql`NULL`} AS source,
      ${dimension === "source" ? Prisma.sql`s."channel"` : Prisma.sql`NULL`} AS channel,
      count(*) AS sessions,
      count(DISTINCT s."visitorId") AS visitors,
      COALESCE(sum(s."pageViews"), 0) AS pageviews,
      count(*) FILTER (WHERE s."pageViews" <= 1) AS bounces,
      count(*) FILTER (WHERE ev.atc) AS atc,
      COALESCE(sum(ev.orders), 0) AS orders,
      COALESCE(sum(ev.revenue), 0) AS revenue
    FROM s LEFT JOIN ev ON ev."sessionId" = s.id
    ${dimension === "campaign" || dimension === "ad" ? Prisma.sql`WHERE s."campaign" IS NOT NULL` : Prisma.empty}
    GROUP BY 1${dimension === "source" ? Prisma.sql`, s."channel"` : Prisma.empty}
    ORDER BY sessions DESC, revenue DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    key: r.key,
    source: r.source ?? undefined,
    channel: r.channel ?? undefined,
    sessions: n(r.sessions),
    visitors: n(r.visitors),
    pageviews: n(r.pageviews),
    bounces: n(r.bounces),
    addToCart: n(r.atc),
    orders: n(r.orders),
    revenue: n(r.revenue),
  }));
}

/** Sessions per day (or month) split by channel, plus orders, in Asia/Dhaka time. */
export async function getTrafficSeries(range: DateRange) {
  const unit = range.bucket;
  const rows = await prisma.$queryRaw<{ bucket: string; channel: string; sessions: Num; orders: Num }[]>`
    WITH ${stats(range.from, range.to)}
    SELECT to_char(date_trunc(${unit}::text, (s."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka'),
                   ${unit === "month" ? "YYYY-MM" : "YYYY-MM-DD"}) AS bucket,
      s."channel" AS channel,
      count(*) AS sessions,
      COALESCE(sum(ev.orders), 0) AS orders
    FROM s LEFT JOIN ev ON ev."sessionId" = s.id
    GROUP BY 1, 2
    ORDER BY 1`;

  // Fill every bucket in the range so the chart has no gaps.
  const DHAKA = 6 * 3_600_000;
  const buckets: string[] = [];
  const cursor = new Date(range.from.getTime() + DHAKA);
  const end = new Date(range.to.getTime() + DHAKA);
  while (cursor < end && buckets.length < 400) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    if (unit === "month") {
      buckets.push(`${y}-${m}`);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    } else {
      buckets.push(`${y}-${m}-${String(cursor.getUTCDate()).padStart(2, "0")}`);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  const channels = [...new Set(rows.map((r) => r.channel))];
  const points = buckets.map((bucket) => {
    const point: Record<string, number | string> = { bucket, orders: 0, sessions: 0 };
    for (const c of channels) point[c] = 0;
    for (const r of rows.filter((x) => x.bucket === bucket)) {
      point[r.channel] = n(r.sessions);
      point.sessions = (point.sessions as number) + n(r.sessions);
      point.orders = (point.orders as number) + n(r.orders);
    }
    return point;
  });
  return { bucket: unit, channels, points };
}
export type TrafficSeries = Awaited<ReturnType<typeof getTrafficSeries>>;

/** Visit → product view → add to cart → checkout → purchase. */
export async function getFunnel(range: DateRange) {
  const [row] = await prisma.$queryRaw<{ sessions: Num; viewed: Num; atc: Num; checkout: Num; purchased: Num }[]>`
    WITH ${stats(range.from, range.to)}
    SELECT count(*) AS sessions,
      count(*) FILTER (WHERE ev.viewed_product) AS viewed,
      count(*) FILTER (WHERE ev.atc) AS atc,
      count(*) FILTER (WHERE ev.checkout) AS checkout,
      count(*) FILTER (WHERE ev.orders > 0) AS purchased
    FROM s LEFT JOIN ev ON ev."sessionId" = s.id`;
  return [
    { step: "Visited the store", value: n(row.sessions) },
    { step: "Viewed a product", value: n(row.viewed) },
    { step: "Added to bag", value: n(row.atc) },
    { step: "Reached checkout", value: n(row.checkout) },
    { step: "Placed an order", value: n(row.purchased) },
  ];
}

/** Visitors active in the last 5 minutes and the most recent sessions. */
export async function getLiveVisitors() {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const [activeNow, recent] = await Promise.all([
    prisma.analyticsSession.count({ where: { lastSeenAt: { gte: since } } }),
    prisma.analyticsSession.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: 12,
      select: {
        id: true,
        source: true,
        channel: true,
        campaign: true,
        landingPath: true,
        city: true,
        country: true,
        device: true,
        pageViews: true,
        startedAt: true,
        lastSeenAt: true,
        events: { where: { type: "purchase" }, select: { value: true }, take: 1 },
      },
    }),
  ]);
  return {
    activeNow,
    recent: recent.map((s) => ({
      ...s,
      startedAt: s.startedAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      purchased: s.events.length > 0,
      purchaseValue: s.events[0]?.value ? Number(s.events[0].value) : null,
      events: undefined,
    })),
  };
}

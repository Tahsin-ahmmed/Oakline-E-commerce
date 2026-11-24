import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { dec, moneyString } from "@/lib/money";
import type { DashboardQuery, DashboardRangeKey } from "@/lib/validations/admin/system";
import { getSettings } from "@/services/settings";

/** Bangladesh Standard Time is UTC+6 with no daylight saving, so a fixed offset is exact. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

function dhakaParts(d: Date) {
  const local = new Date(d.getTime() + DHAKA_OFFSET_MS);
  return { y: local.getUTCFullYear(), m: local.getUTCMonth(), day: local.getUTCDate() };
}

/** UTC instant of 00:00 Asia/Dhaka on the given local calendar date. */
function dhakaMidnight(y: number, m: number, day: number) {
  return new Date(Date.UTC(y, m, day) - DHAKA_OFFSET_MS);
}

function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, day: d };
}

export function toYmd(d: Date) {
  const p = dhakaParts(d);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export interface DateRange {
  key: DashboardRangeKey;
  label: string;
  from: Date; // inclusive
  to: Date; // exclusive
  prevFrom: Date;
  prevTo: Date;
  bucket: "day" | "month";
}

const RANGE_LABELS: Record<DashboardRangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  year: "This year",
  custom: "Custom range",
};

export function resolveRange(q: DashboardQuery, now = new Date()): DateRange {
  const t = dhakaParts(now);
  const todayStart = dhakaMidnight(t.y, t.m, t.day);
  const tomorrow = new Date(todayStart.getTime() + DAY_MS);
  let key = q.range;
  let from: Date;
  let to: Date = tomorrow;
  switch (key) {
    case "today":
      from = todayStart;
      break;
    case "7d":
      from = new Date(todayStart.getTime() - 6 * DAY_MS);
      break;
    case "month":
      from = dhakaMidnight(t.y, t.m, 1);
      break;
    case "year":
      from = dhakaMidnight(t.y, 0, 1);
      break;
    case "custom": {
      if (q.from && q.to) {
        const f = parseYmd(q.from);
        const e = parseYmd(q.to);
        from = dhakaMidnight(f.y, f.m, f.day);
        to = new Date(dhakaMidnight(e.y, e.m, e.day).getTime() + DAY_MS);
        if (to <= from) [from, to] = [new Date(to.getTime() - DAY_MS), new Date(from.getTime() + DAY_MS)];
        // Guard against absurd ranges (max ~5 years).
        if (to.getTime() - from.getTime() > 5 * 366 * DAY_MS) from = new Date(to.getTime() - 5 * 366 * DAY_MS);
        break;
      }
      key = "30d";
      from = new Date(todayStart.getTime() - 29 * DAY_MS);
      break;
    }
    default:
      from = new Date(todayStart.getTime() - 29 * DAY_MS);
  }
  const span = to.getTime() - from.getTime();
  return {
    key,
    label: RANGE_LABELS[key],
    from,
    to,
    prevFrom: new Date(from.getTime() - span),
    prevTo: from,
    bucket: span > 92 * DAY_MS ? "month" : "day",
  };
}

const notCancelled: Prisma.OrderWhereInput = { status: { notIn: ["CANCELLED"] } };

async function periodTotals(from: Date, to: Date) {
  const inRange = { placedAt: { gte: from, lt: to } };
  const [orders, paid, newCustomers] = await Promise.all([
    prisma.order.aggregate({ where: { ...inRange, ...notCancelled }, _sum: { grandTotal: true }, _count: true }),
    prisma.order.aggregate({
      where: { ...inRange, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
      _sum: { grandTotal: true },
    }),
    prisma.user.count({ where: { isStaff: false, deletedAt: null, createdAt: { gte: from, lt: to } } }),
  ]);
  const revenue = dec(orders._sum.grandTotal);
  const count = orders._count;
  return {
    revenue: moneyString(revenue),
    paidRevenue: moneyString(paid._sum.grandTotal),
    orders: count,
    aov: moneyString(count ? revenue.div(count) : 0),
    newCustomers,
  };
}

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** KPI cards (with % change vs the previous equal-length period) and store-wide counters. */
export async function getOverview(range: DateRange) {
  const { commerce } = await getSettings();
  const threshold = commerce.lowStockThreshold;
  const visible = { status: "ACTIVE" as const, deletedAt: null };
  const [current, previous, totalProducts, totalCustomers, pendingOrders, deliveredOrders, lowStock, outOfStock] =
    await Promise.all([
      periodTotals(range.from, range.to),
      periodTotals(range.prevFrom, range.prevTo),
      prisma.product.count({ where: visible }),
      prisma.user.count({ where: { isStaff: false, deletedAt: null } }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.product.count({ where: { ...visible, stockQuantity: { gt: 0, lte: threshold } } }),
      prisma.product.count({ where: { ...visible, stockQuantity: { lte: 0 } } }),
    ]);
  return {
    range: { key: range.key, label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
    kpis: {
      revenue: { value: current.revenue, previous: previous.revenue, change: change(Number(current.revenue), Number(previous.revenue)) },
      paidRevenue: { value: current.paidRevenue, previous: previous.paidRevenue, change: change(Number(current.paidRevenue), Number(previous.paidRevenue)) },
      orders: { value: current.orders, previous: previous.orders, change: change(current.orders, previous.orders) },
      aov: { value: current.aov, previous: previous.aov, change: change(Number(current.aov), Number(previous.aov)) },
      newCustomers: { value: current.newCustomers, previous: previous.newCustomers, change: change(current.newCustomers, previous.newCustomers) },
    },
    counters: { totalProducts, totalCustomers, pendingOrders, deliveredOrders, lowStock, outOfStock, lowStockThreshold: threshold },
  };
}
export type DashboardOverview = Awaited<ReturnType<typeof getOverview>>;

/** Revenue and order counts per day (or month) in Asia/Dhaka, with empty buckets filled in. */
export async function getRevenueSeries(range: DateRange) {
  const unit = range.bucket;
  const rows = await prisma.$queryRaw<{ bucket: string; revenue: number; orders: number }[]>`
    SELECT to_char(date_trunc(${unit}::text, ("placedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka'),
                   CASE WHEN ${unit}::text = 'month' THEN 'YYYY-MM' ELSE 'YYYY-MM-DD' END) AS bucket,
           COALESCE(SUM("grandTotal"), 0)::float8 AS revenue,
           COUNT(*)::int AS orders
    FROM "Order"
    WHERE "placedAt" >= ${range.from} AND "placedAt" < ${range.to} AND "status" <> 'CANCELLED'
    GROUP BY 1 ORDER BY 1`;
  const byKey = new Map(rows.map((r) => [r.bucket, r]));
  const points: { bucket: string; revenue: number; orders: number }[] = [];
  if (unit === "day") {
    for (let t = range.from.getTime(); t < range.to.getTime(); t += DAY_MS) {
      const key = toYmd(new Date(t));
      const row = byKey.get(key);
      points.push({ bucket: key, revenue: row ? Number(row.revenue) : 0, orders: row ? Number(row.orders) : 0 });
    }
  } else {
    const start = dhakaParts(range.from);
    const end = dhakaParts(new Date(range.to.getTime() - 1));
    for (let y = start.y, m = start.m; y < end.y || (y === end.y && m <= end.m); m === 11 ? ((m = 0), y++) : m++) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      const row = byKey.get(key);
      points.push({ bucket: key, revenue: row ? Number(row.revenue) : 0, orders: row ? Number(row.orders) : 0 });
    }
  }
  return { bucket: unit, points };
}
export type RevenueSeries = Awaited<ReturnType<typeof getRevenueSeries>>;

/** Orders by status (all statuses, including cancelled) and sales by top-level category. */
export async function getOrderBreakdown(range: DateRange) {
  const [byStatus, byCategory] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { placedAt: { gte: range.from, lt: range.to } },
      _count: true,
    }),
    prisma.$queryRaw<{ category: string; revenue: number; units: number }[]>`
      SELECT COALESCE(parent."name", c."name") AS category,
             COALESCE(SUM(oi."lineTotal"), 0)::float8 AS revenue,
             COALESCE(SUM(oi."quantity"), 0)::int AS units
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Product" p ON p."id" = oi."productId"
      JOIN "Category" c ON c."id" = p."categoryId"
      LEFT JOIN "Category" parent ON parent."id" = c."parentId"
      WHERE o."placedAt" >= ${range.from} AND o."placedAt" < ${range.to} AND o."status" <> 'CANCELLED'
      GROUP BY 1 ORDER BY 2 DESC`,
  ]);
  return {
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byCategory: byCategory.map((c) => ({ category: c.category, revenue: Number(c.revenue), units: Number(c.units) })),
  };
}
export type OrderBreakdown = Awaited<ReturnType<typeof getOrderBreakdown>>;

export async function getTopProducts(range: DateRange, limit = 6) {
  const rows = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, order: { placedAt: { gte: range.from, lt: range.to }, ...notCancelled } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  const products = await prisma.product.findMany({
    where: { id: { in: rows.map((r) => r.productId!) } },
    select: { id: true, name: true, sku: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  return rows.map((r) => {
    const p = products.find((x) => x.id === r.productId);
    return {
      id: r.productId!,
      name: p?.name ?? "Deleted product",
      sku: p?.sku ?? "",
      image: p?.images[0]?.url ?? null,
      units: r._sum.quantity ?? 0,
      revenue: moneyString(r._sum.lineTotal),
    };
  });
}

export async function getRecentActivity() {
  const { commerce } = await getSettings();
  const [orders, customers, lowStock] = await Promise.all([
    prisma.order.findMany({
      orderBy: { placedAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        paymentStatus: true,
        grandTotal: true,
        placedAt: true,
      },
    }),
    prisma.user.findMany({
      where: { isStaff: false, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, email: true, createdAt: true, _count: { select: { orders: true } } },
    }),
    prisma.$queryRaw<{ variantId: string; productId: string; productName: string; variantName: string; sku: string; quantity: number; threshold: number }[]>`
      SELECT v."id" AS "variantId", p."id" AS "productId", p."name" AS "productName", v."name" AS "variantName",
             v."sku", i."quantity"::int AS quantity, i."lowStockThreshold"::int AS threshold
      FROM "Inventory" i
      JOIN "ProductVariant" v ON v."id" = i."variantId"
      JOIN "Product" p ON p."id" = v."productId"
      WHERE p."deletedAt" IS NULL AND p."status" = 'ACTIVE' AND v."isActive" = true
        AND i."quantity" <= GREATEST(i."lowStockThreshold", ${commerce.lowStockThreshold})
      ORDER BY i."quantity" ASC, p."name" ASC
      LIMIT 8`,
  ]);
  return {
    orders: orders.map((o) => ({ ...o, grandTotal: moneyString(o.grandTotal), placedAt: o.placedAt.toISOString() })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, email: c.email, createdAt: c.createdAt.toISOString(), orders: c._count.orders })),
    lowStock,
  };
}

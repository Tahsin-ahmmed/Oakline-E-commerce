import { z } from "zod";
import { route } from "@/lib/api";
import { dashboardQuerySchema } from "@/lib/validations/admin/system";
import { resolveRange, toYmd } from "@/services/admin/dashboard";
import { DIMENSIONS, getBreakdown, type Dimension } from "@/services/admin/traffic";
import { CHANNEL_LABELS, sourceLabel, type Channel } from "@/lib/analytics/attribution";

const csvCell = (v: string | number) => {
  let s = String(v);
  // Prevent spreadsheet formula injection from visitor-controlled values (UTM tags, paths).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET /api/admin/traffic/export?by=source&range=30d — CSV of a traffic breakdown. */
export const GET = route({ auth: "staff", permission: "dashboard.view" }, async ({ query }) => {
  const q = query(dashboardQuerySchema.extend({ by: z.enum(Object.keys(DIMENSIONS) as [Dimension, ...Dimension[]]).catch("source").default("source") }));
  const range = resolveRange(q);
  const rows = await getBreakdown(range, q.by, 1000);
  const head = ["Name", "Channel", "Sessions", "Visitors", "Pageviews", "Bounce rate %", "Add-to-cart rate %", "Orders", "Conversion rate %", "Revenue", "Revenue per session"];
  const name = (key: string) => (q.by === "source" ? sourceLabel(key) : q.by === "channel" ? (CHANNEL_LABELS[key as Channel] ?? key) : key);
  const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) : "0.0");
  const lines = [
    head.join(","),
    ...rows.map((r) =>
      [
        name(r.key),
        r.channel ? (CHANNEL_LABELS[r.channel as Channel] ?? r.channel) : "",
        r.sessions,
        r.visitors,
        r.pageviews,
        pct(r.bounces, r.sessions),
        pct(r.addToCart, r.sessions),
        r.orders,
        pct(r.orders, r.sessions),
        r.revenue.toFixed(2),
        r.sessions ? (r.revenue / r.sessions).toFixed(2) : "0.00",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  const filename = `traffic-${q.by}-${toYmd(range.from)}-to-${toYmd(new Date(range.to.getTime() - 1))}.csv`;
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});

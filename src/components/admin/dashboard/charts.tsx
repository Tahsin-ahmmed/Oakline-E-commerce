"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Table as TableIcon, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-status";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucketLabel(bucket: string, long = false) {
  const [y, m, d] = bucket.split("-").map(Number);
  if (!d) return long ? `${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} '${String(y).slice(2)}`;
  return long ? `${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
}

const compact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
} as const;

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-[var(--shadow-lift)]">
      <p className="mb-1 font-medium text-foreground">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {r.color && <span className="size-2 rounded-full" style={{ backgroundColor: r.color }} />}
            {r.label}
          </span>
          <span className="font-medium text-foreground tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Chart/table toggle so every chart has an accessible tabular view. */
function ChartFrame({
  title,
  description,
  table,
  children,
  empty,
}: {
  title: string;
  description?: string;
  table: React.ReactNode;
  children: React.ReactNode;
  empty?: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-sans text-[0.95rem] font-semibold tracking-normal">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {!empty && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setAsTable((v) => !v)}
            aria-label={asTable ? "Show chart" : "Show data table"}
            title={asTable ? "Show chart" : "Show data table"}
          >
            {asTable ? <BarChart3 /> : <TableIcon />}
          </Button>
        )}
      </div>
      <div className="p-5">
        {empty ? (
          <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">No orders in this period.</p>
        ) : asTable ? (
          <div className="max-h-72 overflow-y-auto">{table}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          {head.map((h, i) => (
            <th key={h} className={i > 0 ? "py-2 text-right font-medium" : "py-2 font-medium"}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b last:border-0">
            {r.map((c, j) => (
              <td key={j} className={j > 0 ? "py-1.5 text-right tabular-nums" : "py-1.5"}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RevenueChart({
  points,
  currency,
}: {
  points: { bucket: string; revenue: number; orders: number }[];
  currency: string;
}) {
  const empty = points.every((p) => p.revenue === 0);
  const fmt = (n: number) => formatMoney(n, currency);
  return (
    <ChartFrame
      title="Revenue"
      description="Gross order value, excluding cancelled orders"
      empty={empty}
      table={<DataTable head={["Period", "Revenue", "Orders"]} rows={points.map((p) => [bucketLabel(p.bucket, true), fmt(p.revenue), p.orders])} />}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey="bucket" {...axisProps} tickFormatter={(b) => bucketLabel(b)} minTickGap={24} />
            <YAxis {...axisProps} width={48} tickFormatter={compact} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={(props) => {
                const p = props.payload?.[0]?.payload as (typeof points)[number] | undefined;
                if (!props.active || !p) return null;
                return (
                  <TooltipBox
                    title={bucketLabel(p.bucket, true)}
                    rows={[
                      { label: "Revenue", value: fmt(p.revenue), color: "var(--chart-1)" },
                      { label: "Orders", value: String(p.orders) },
                    ]}
                  />
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#revFill)"
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function OrdersChart({ points }: { points: { bucket: string; orders: number }[] }) {
  const empty = points.every((p) => p.orders === 0);
  return (
    <ChartFrame
      title="Orders"
      description="Orders placed per period, excluding cancelled"
      empty={empty}
      table={<DataTable head={["Period", "Orders"]} rows={points.map((p) => [bucketLabel(p.bucket, true), p.orders])} />}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={points.length > 40 ? 1 : "20%"}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="bucket" {...axisProps} tickFormatter={(b) => bucketLabel(b)} minTickGap={24} />
            <YAxis {...axisProps} width={32} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={(props) => {
                const p = props.payload?.[0]?.payload as (typeof points)[number] | undefined;
                if (!props.active || !p) return null;
                return <TooltipBox title={bucketLabel(p.bucket, true)} rows={[{ label: "Orders", value: String(p.orders), color: "var(--chart-2)" }]} />;
              }}
            />
            <Bar dataKey="orders" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function StatusChart({ data }: { data: { status: string; count: number }[] }) {
  const order = Object.keys(ORDER_STATUS_LABELS) as OrderStatusValue[];
  const rows = order
    .map((s) => ({ status: s, label: ORDER_STATUS_LABELS[s], count: data.find((d) => d.status === s)?.count ?? 0 }))
    .filter((r) => r.count > 0);
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <ChartFrame
      title="Orders by status"
      description="All orders placed in the period"
      empty={total === 0}
      table={<DataTable head={["Status", "Orders", "Share"]} rows={rows.map((r) => [r.label, r.count, `${Math.round((r.count / total) * 100)}%`])} />}
    >
      <div style={{ height: Math.max(160, rows.length * 34) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={6}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="label" {...axisProps} width={112} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={(props) => {
                const p = props.payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!props.active || !p) return null;
                return <TooltipBox title={p.label} rows={[{ label: "Orders", value: `${p.count} (${Math.round((p.count / total) * 100)}%)` }]} />;
              }}
            />
            <Bar
              dataKey="count"
              fill="var(--chart-2)"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              isAnimationActive={false}
              label={{ position: "right", fill: "var(--muted-foreground)", fontSize: 11 }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function CategoryChart({ data, currency }: { data: { category: string; revenue: number; units: number }[]; currency: string }) {
  const fmt = (n: number) => formatMoney(n, currency);
  const rows = data.slice(0, 8);
  return (
    <ChartFrame
      title="Sales by category"
      description="Merchandise revenue by top-level category"
      empty={rows.length === 0}
      table={<DataTable head={["Category", "Revenue", "Units"]} rows={data.map((r) => [r.category, fmt(r.revenue), r.units])} />}
    >
      <div style={{ height: Math.max(160, rows.length * 34) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap={6}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="category" {...axisProps} width={132} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={(props) => {
                const p = props.payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!props.active || !p) return null;
                return (
                  <TooltipBox
                    title={p.category}
                    rows={[
                      { label: "Revenue", value: fmt(p.revenue), color: "var(--chart-1)" },
                      { label: "Units", value: String(p.units) },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="revenue"
              fill="var(--chart-1)"
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              isAnimationActive={false}
              label={{ position: "right", fill: "var(--muted-foreground)", fontSize: 11, formatter: (v: unknown) => compact(Number(v)) }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

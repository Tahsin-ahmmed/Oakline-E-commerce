"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHANNEL_LABELS, type Channel } from "@/lib/analytics/attribution";
import { channelColor } from "@/components/admin/traffic/channel-colors";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function label(bucket: string, long = false) {
  const [y, m, d] = bucket.split("-").map(Number);
  if (!d) return long ? `${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} '${String(y).slice(2)}`;
  return long ? `${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
}

/** Order channels so the biggest sits at the bottom of the stack. */
function ordered(points: Record<string, number | string>[], channels: string[]) {
  const totals = channels.map((c) => [c, points.reduce((s, p) => s + Number(p[c] ?? 0), 0)] as const);
  return totals.sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

export function TrafficChart({ points, channels }: { points: Record<string, number | string>[]; channels: string[] }) {
  const [asTable, setAsTable] = useState(false);
  const series = ordered(points, channels);
  const empty = points.every((p) => Number(p.sessions) === 0);
  return (
    <section className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-sans text-[0.95rem] font-semibold tracking-normal">Visits over time</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Sessions by channel (Asia/Dhaka time)</p>
        </div>
        {!empty && (
          <Button variant="ghost" size="icon-sm" onClick={() => setAsTable((v) => !v)} aria-label={asTable ? "Show chart" : "Show data table"}>
            {asTable ? <BarChart3 /> : <TableIcon />}
          </Button>
        )}
      </div>
      <div className="p-5">
        {empty ? (
          <p className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
            No visits recorded in this period yet. Visits appear here as soon as people browse the store.
          </p>
        ) : asTable ? (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Date</th>
                  {series.map((c) => (
                    <th key={c} className="py-2 text-right font-medium">
                      {CHANNEL_LABELS[c as Channel] ?? c}
                    </th>
                  ))}
                  <th className="py-2 text-right font-medium">Orders</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={String(p.bucket)} className="border-b last:border-0">
                    <td className="py-1.5">{label(String(p.bucket), true)}</td>
                    {series.map((c) => (
                      <td key={c} className="py-1.5 text-right tabular-nums">
                        {Number(p[c] ?? 0)}
                      </td>
                    ))}
                    <td className="py-1.5 text-right tabular-nums">{Number(p.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="bucket" tickFormatter={(b) => label(String(b))} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={24} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={40} />
                  <Tooltip
                    cursor={{ stroke: "var(--border)" }}
                    content={({ active, payload, label: l }) =>
                      active && payload?.length ? (
                        <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs shadow-[var(--shadow-lift)]">
                          <p className="mb-1 font-medium">{label(String(l), true)}</p>
                          {[...payload].reverse().map((item) => (
                            <p key={String(item.dataKey)} className="flex justify-between gap-4 text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full" style={{ backgroundColor: channelColor(String(item.dataKey)) }} />
                                {CHANNEL_LABELS[item.dataKey as Channel] ?? String(item.dataKey)}
                              </span>
                              <span className="font-medium text-foreground tabular-nums">{Number(item.value)}</span>
                            </p>
                          ))}
                          <p className="mt-1 flex justify-between border-t pt-1 text-muted-foreground">
                            <span>Orders</span>
                            <span className="font-medium text-foreground tabular-nums">{Number((payload[0].payload as { orders: number }).orders)}</span>
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  {series.map((c) => (
                    <Area key={c} type="monotone" dataKey={c} stackId="1" stroke={channelColor(c)} fill={channelColor(c)} fillOpacity={0.75} strokeWidth={1} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Legend">
              {series.map((c) => (
                <li key={c} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: channelColor(c) }} />
                  {CHANNEL_LABELS[c as Channel] ?? c}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

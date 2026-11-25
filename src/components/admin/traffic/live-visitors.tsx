"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { CHANNEL_LABELS, sourceLabel, type Channel } from "@/lib/analytics/attribution";
import { channelColor } from "@/components/admin/traffic/channel-colors";
import { useAdmin } from "@/components/admin/admin-context";

interface Live {
  activeNow: number;
  recent: {
    id: string;
    source: string;
    channel: string;
    campaign: string | null;
    landingPath: string;
    city: string | null;
    country: string | null;
    device: string;
    pageViews: number;
    lastSeenAt: string;
    purchased: boolean;
    purchaseValue: number | null;
  }[];
}

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, desktop: Monitor } as const;

export function LiveVisitors({ initial }: { initial: Live }) {
  const { currency } = useAdmin();
  const { data = initial } = useQuery({
    queryKey: ["traffic-live"],
    queryFn: () => api<Live>("/api/admin/traffic/live"),
    initialData: initial,
    refetchInterval: 30_000,
  });
  return (
    <section className="flex flex-col rounded-xl border bg-card shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="font-sans text-[0.95rem] font-semibold tracking-normal">Live visitors</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Updates every 30 seconds</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            {data.activeNow > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />}
            <span className={`relative inline-flex size-2.5 rounded-full ${data.activeNow > 0 ? "bg-success" : "bg-muted-foreground/40"}`} />
          </span>
          <span className="font-heading text-2xl tabular-nums">{data.activeNow}</span>
          <span className="text-xs text-muted-foreground">online now</span>
        </div>
      </div>
      <ul className="max-h-[22rem] flex-1 divide-y overflow-y-auto">
        {data.recent.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">No visitors yet.</li>}
        {data.recent.map((s) => {
          const Icon = DEVICE_ICON[s.device as keyof typeof DEVICE_ICON] ?? Monitor;
          return (
            <li key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-label={s.device} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: channelColor(s.channel) }} />
                  <span className="font-medium">{sourceLabel(s.source)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {s.campaign ? `· ${s.campaign}` : `· ${CHANNEL_LABELS[s.channel as Channel] ?? s.channel}`}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.landingPath} · {s.pageViews} page{s.pageViews === 1 ? "" : "s"}
                  {s.city ? ` · ${s.city}` : s.country ? ` · ${s.country}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {s.purchased && (
                  <p className="text-xs font-semibold text-success">{s.purchaseValue ? formatMoney(s.purchaseValue, currency) : "Ordered"}</p>
                )}
                <p className="text-[0.7rem] text-muted-foreground">{formatDistanceToNowStrict(new Date(s.lastSeenAt), { addSuffix: true })}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { useState } from "react";
import { CalendarRange, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUrlParams } from "@/components/admin/list-toolbar";
import { cn } from "@/lib/utils";

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
] as const;

export function RangeFilter({ active, from, to }: { active: string; from?: string; to?: string }) {
  const { set, pending } = useUrlParams();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ?? "");
  const valid = Boolean(f && t && f <= t);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Date range" className="inline-flex flex-wrap rounded-lg border bg-card p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => set({ range: p.key === "30d" ? null : p.key, from: null, to: null })}
            aria-pressed={active === p.key}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition",
              active === p.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant={active === "custom" ? "default" : "outline"} size="sm" className="h-8">
            <CalendarRange /> {active === "custom" && from && to ? `${from} → ${to}` : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              set({ range: "custom", from: f, to: t });
              setOpen(false);
            }}
          >
            <label className="grid gap-1 text-xs font-medium">
              From
              <Input type="date" value={f} onChange={(e) => setF(e.target.value)} max={t || undefined} required />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              To
              <Input type="date" value={t} onChange={(e) => setT(e.target.value)} min={f || undefined} required />
            </label>
            <Button type="submit" size="sm" disabled={!valid}>
              Apply range
            </Button>
          </form>
        </PopoverContent>
      </Popover>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />}
    </div>
  );
}

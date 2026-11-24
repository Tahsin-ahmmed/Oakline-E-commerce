"use client";

import { Input } from "@/components/ui/input";
import { useUrlParams } from "@/components/admin/list-toolbar";

/** From/To date inputs bound to ?from=&to= URL params. */
export function DateRangeInputs() {
  const { params, set } = useUrlParams();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Input type="date" aria-label="From date" className="h-9 w-40" value={from} max={to || undefined} onChange={(e) => set({ from: e.target.value || null })} />
      <span>–</span>
      <Input type="date" aria-label="To date" className="h-9 w-40" value={to} min={from || undefined} onChange={(e) => set({ to: e.target.value || null })} />
    </div>
  );
}

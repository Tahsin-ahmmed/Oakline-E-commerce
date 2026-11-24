"use client";

import { Input } from "@/components/ui/input";
import { useUrlParams } from "@/components/admin/list-toolbar";

/** From/To date inputs bound to ?from=&to= search params. */
export function DateRangeFilter() {
  const { params, set } = useUrlParams();
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Input
        type="date"
        aria-label="From date"
        className="h-9 w-38"
        value={params.get("from") ?? ""}
        max={params.get("to") ?? undefined}
        onChange={(e) => set({ from: e.target.value || null })}
      />
      <span className="text-muted-foreground">–</span>
      <Input
        type="date"
        aria-label="To date"
        className="h-9 w-38"
        value={params.get("to") ?? ""}
        min={params.get("from") ?? undefined}
        onChange={(e) => set({ to: e.target.value || null })}
      />
    </div>
  );
}

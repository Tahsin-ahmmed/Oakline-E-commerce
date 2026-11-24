"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Hook to update URL search params (resets pagination). */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const set = (updates: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in updates)) next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { params, set, pending };
}

export function SearchInput({ placeholder = "Search…", param = "q", className }: { placeholder?: string; param?: string; className?: string }) {
  const { params, set, pending } = useUrlParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get(param) ?? "") !== value.trim()) set({ [param]: value.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="h-9 pr-8 pl-9" aria-label={placeholder} />
      {pending ? (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : value ? (
        <button type="button" onClick={() => setValue("")} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground" aria-label="Clear search">
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function FilterSelect({
  param,
  options,
  placeholder,
  className,
}: {
  param: string;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
}) {
  const { params, set } = useUrlParams();
  return (
    <Select value={params.get(param) ?? "all"} onValueChange={(v) => set({ [param]: v })}>
      <SelectTrigger size="sm" className={cn("h-9 min-w-40", className)} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ClearFilters({ keys }: { keys: string[] }) {
  const { params, set } = useUrlParams();
  if (!keys.some((k) => params.get(k))) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(keys.map((k) => [k, null])))}>
      <X /> Clear
    </Button>
  );
}

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

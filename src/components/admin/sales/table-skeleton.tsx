import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholder for admin list pages. */
export function TableSkeleton({ rows = 8, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {title && (
        <div className="mb-6 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      )}
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="space-y-px overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

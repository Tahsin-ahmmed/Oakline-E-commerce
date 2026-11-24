"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface NotificationsResponse {
  unread: number;
  items: { id: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string }[];
}

export function NotificationBell() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => api<NotificationsResponse>("/api/admin/notifications"),
    refetchInterval: 60_000,
  });
  const markRead = useMutation({
    mutationFn: (ids?: string[]) => api("/api/admin/notifications", { method: "POST", body: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });
  const unread = data?.unread ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} unread)`}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[0.6rem] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markRead.mutate(undefined)}>
              <CheckCheck /> Mark all read
            </Button>
          )}
        </div>
        <ul className="max-h-96 divide-y overflow-y-auto">
          {!data?.items.length && <li className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</li>}
          {data?.items.map((n) => {
            const content = (
              <div className={cn("flex gap-3 px-4 py-3 text-sm transition hover:bg-secondary/60", !n.readAt && "bg-secondary/40")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-clay")} />
                <div className="min-w-0">
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} onClick={() => !n.readAt && markRead.mutate([n.id])}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Archive, Mail, MailOpen, Reply, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToneBadge } from "@/components/shared/status-badge";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ContactRow, SubscriberRow } from "@/services/admin/messages";

const CONTACT_TONE = { NEW: "warning", READ: "neutral", REPLIED: "success", ARCHIVED: "neutral" } as const;

export function ContactMessages({ messages }: { messages: ContactRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<ContactRow | null>(null);
  const setStatus = async (id: string, status: ContactRow["status"], quiet = false) => {
    try {
      await api(`/api/admin/messages/${id}`, { method: "PATCH", body: { status } });
      if (!quiet) toast.success(`Marked ${status.toLowerCase()}.`);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  if (!messages.length) {
    return <div className="rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">No messages.</div>;
  }
  return (
    <>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {messages.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className={cn("flex w-full flex-wrap items-start gap-3 px-4 py-3.5 text-left transition hover:bg-secondary/50", m.status === "NEW" && "bg-secondary/30")}
              onClick={() => {
                setOpen(m);
                if (m.status === "NEW") void setStatus(m.id, "READ", true);
              }}
            >
              {m.status === "NEW" ? <Mail className="mt-0.5 size-4 text-clay" /> : <MailOpen className="mt-0.5 size-4 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm", m.status === "NEW" && "font-semibold")}>{m.subject}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.name} · {m.email} — {m.message}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ToneBadge tone={CONTACT_TONE[m.status]}>{m.status.toLowerCase()}</ToneBadge>
                <span className="text-xs text-muted-foreground">{format(new Date(m.createdAt), "d MMM")}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{open.subject}</DialogTitle>
                <DialogDescription>
                  From {open.name} &lt;{open.email}&gt;{open.phone ? ` · ${open.phone}` : ""} · {format(new Date(open.createdAt), "d MMM yyyy, h:mm a")}
                </DialogDescription>
              </DialogHeader>
              <p className="max-h-80 overflow-y-auto text-sm whitespace-pre-wrap">{open.message}</p>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  variant="ghost"
                  onClick={() => {
                    void setStatus(open.id, "ARCHIVED");
                    setOpen(null);
                  }}
                >
                  <Archive /> Archive
                </Button>
                <Button asChild onClick={() => void setStatus(open.id, "REPLIED", true)}>
                  <a href={`mailto:${open.email}?subject=${encodeURIComponent(`Re: ${open.subject}`)}`}>
                    <Reply /> Reply by email
                  </a>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Subscribers({ subscribers }: { subscribers: SubscriberRow[] }) {
  const router = useRouter();
  const toggle = async (s: SubscriberRow) => {
    const status = s.status === "SUBSCRIBED" ? "UNSUBSCRIBED" : "SUBSCRIBED";
    try {
      await api(`/api/admin/newsletter/${s.id}`, { method: "PATCH", body: { status } });
      toast.success(status === "SUBSCRIBED" ? "Resubscribed." : "Unsubscribed.");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  if (!subscribers.length) {
    return <div className="rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">No subscribers found.</div>;
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Email</TableHead>
            <TableHead className="hidden sm:table-cell">Source</TableHead>
            <TableHead className="hidden md:table-cell">Subscribed</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-4 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscribers.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="pl-4">{s.email}</TableCell>
              <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{s.source ?? "—"}</TableCell>
              <TableCell className="hidden text-sm md:table-cell">{format(new Date(s.createdAt), "d MMM yyyy")}</TableCell>
              <TableCell>
                <ToneBadge tone={s.status === "SUBSCRIBED" ? "success" : "neutral"}>{s.status.toLowerCase()}</ToneBadge>
              </TableCell>
              <TableCell className="pr-4 text-right">
                <Button size="sm" variant="ghost" onClick={() => toggle(s)}>
                  {s.status === "SUBSCRIBED" ? <UserMinus /> : <UserPlus />}
                  {s.status === "SUBSCRIBED" ? "Unsubscribe" : "Resubscribe"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

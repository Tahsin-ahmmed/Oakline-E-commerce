"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAdmin } from "@/components/admin/admin-context";
import { api, errorMessage } from "@/lib/api-client";

export function OrderNotes({
  orderId,
  notes,
}: {
  orderId: string;
  notes: { id: string; body: string; createdAt: string; author: string | null }[];
}) {
  const router = useRouter();
  const { can } = useAdmin();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      {can("orders.manage") && (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim()) return;
            setBusy(true);
            try {
              await api(`/api/admin/orders/${orderId}/notes`, { body: { body } });
              setBody("");
              toast.success("Note added.");
              router.refresh();
            } catch (err) {
              toast.error(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add an internal note (not visible to the customer)…"
            rows={3}
            maxLength={2000}
            aria-label="Internal note"
          />
          <Button size="sm" type="submit" disabled={busy || !body.trim()}>
            {busy && <Loader2 className="animate-spin" />} Add note
          </Button>
        </form>
      )}
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No internal notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-secondary/50 px-3 py-2.5 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.author ?? "Staff"} · {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

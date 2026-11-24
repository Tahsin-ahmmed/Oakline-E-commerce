"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client";

/** Convert an ISO date to the value format of <input type="datetime-local"> (local time). */
export function toLocalInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local (browser local time) → ISO string so the server stores the intended instant. */
export function localToIso(value: string | undefined) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Run an admin API call with toast feedback and refresh server data on success. */
export function useAdminAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
    setPending(true);
    try {
      const res = await fn();
      if (success) toast.success(success);
      router.refresh();
      return res;
    } catch (e) {
      toast.error(errorMessage(e));
      return undefined;
    } finally {
      setPending(false);
    }
  }
  return { run, pending };
}

/** Submit a form to the API: toasts, maps field errors back onto the form, refreshes on success. */
export function useFormSubmit() {
  const router = useRouter();
  return async function submit<T>(
    fn: () => Promise<T>,
    success: string,
    setError?: (name: never, err: { type: string; message: string }) => void,
  ): Promise<T | undefined> {
    try {
      const res = await fn();
      toast.success(success);
      router.refresh();
      return res;
    } catch (e) {
      if (setError) applyFieldErrors(e, setError);
      toast.error(errorMessage(e));
      return undefined;
    }
  };
}

type Entity ="banner" | "section" | "collection" | "testimonial";

/** Up/down buttons that persist a new order for a list of ids. */
export function MoveButtons({ entity, ids, index, label }: { entity: Entity; ids: string[]; index: number; label: string }) {
  const { run, pending } = useAdminAction();
  const move = (dir: -1 | 1) => {
    const next = [...ids];
    const j = index + dir;
    [next[index], next[j]] = [next[j], next[index]];
    void run(() => api("/api/admin/content/reorder", { body: { entity, ids: next } }));
  };
  return (
    <div className="flex gap-0.5">
      <Button type="button" variant="ghost" size="icon-sm" disabled={pending || index === 0} onClick={() => move(-1)} aria-label={`Move ${label} up`}>
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={pending || index === ids.length - 1}
        onClick={() => move(1)}
        aria-label={`Move ${label} down`}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}

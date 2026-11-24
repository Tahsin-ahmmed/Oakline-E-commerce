"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function NewsletterForm({ source = "footer", tone = "light" }: { source?: string; tone?: "light" | "dark" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  return (
    <form
      className="w-full"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("loading");
        try {
          const res = await api<{ message: string }>("/api/newsletter", { body: { email, source } });
          toast.success(res.message);
          setState("done");
          setEmail("");
        } catch (err) {
          toast.error(errorMessage(err));
          setState("idle");
        }
      }}
    >
      <div
        className={cn(
          "flex items-center rounded-full border p-1 pl-5 transition focus-within:ring-3",
          tone === "dark" ? "border-white/25 bg-white/5 focus-within:ring-white/20" : "border-input bg-card focus-within:ring-ring/30",
        )}
      >
        <label htmlFor={`newsletter-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`newsletter-${source}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          className={cn(
            "h-10 min-w-0 flex-1 bg-transparent text-sm outline-none",
            tone === "dark" ? "placeholder:text-white/50" : "placeholder:text-muted-foreground",
          )}
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full transition",
            tone === "dark" ? "bg-white text-primary hover:bg-white/90" : "bg-primary text-primary-foreground hover:bg-primary/85",
          )}
          aria-label="Subscribe"
        >
          {state === "loading" ? <Loader2 className="size-4 animate-spin" /> : state === "done" ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
        </button>
      </div>
    </form>
  );
}

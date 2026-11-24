"use client";

import { useState } from "react";
import { Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";

export function VerificationBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-5 sm:flex-row sm:items-center">
      <MailWarning className="size-5 shrink-0 text-warning" />
      <p className="flex-1 text-sm">
        Please confirm your email address <span className="font-medium">{email}</span> to keep your account secure.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={state !== "idle"}
        onClick={async () => {
          setState("sending");
          try {
            await api("/api/auth/resend-verification", { method: "POST", body: {} });
            toast.success("Verification email sent — check your inbox.");
            setState("sent");
          } catch (e) {
            toast.error(errorMessage(e));
            setState("idle");
          }
        }}
      >
        {state === "sending" && <Loader2 className="animate-spin" />}
        {state === "sent" ? "Email sent" : "Resend email"}
      </Button>
    </div>
  );
}

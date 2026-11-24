"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";

export function VerifyEmail({ token }: { token: string }) {
  const valid = token.length >= 20;
  const [state, setState] = useState<"loading" | "ok" | "error">(valid ? "loading" : "error");
  const [message, setMessage] = useState(valid ? "" : "This verification link is incomplete.");
  const started = useRef(false);

  useEffect(() => {
    if (!valid || started.current) return;
    started.current = true;
    api("/api/auth/verify-email", { body: { token } })
      .then(() => setState("ok"))
      .catch((e) => {
        setState("error");
        setMessage(errorMessage(e));
      });
  }, [token, valid]);

  return (
    <div className="rounded-lg border bg-card p-8 text-center" aria-live="polite">
      {state === "loading" && (
        <>
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm">Confirming your email…</p>
        </>
      )}
      {state === "ok" && (
        <>
          <CheckCircle2 className="mx-auto size-8 text-success" />
          <p className="mt-3 text-sm">Thank you — your email address is confirmed.</p>
          <Button asChild className="mt-6">
            <Link href="/account">Go to my account</Link>
          </Button>
        </>
      )}
      {state === "error" && (
        <>
          <XCircle className="mx-auto size-8 text-destructive" />
          <p className="mt-3 text-sm">{message}</p>
          <p className="mt-2 text-xs text-muted-foreground">You can request a new link from your account page.</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/account">Go to my account</Link>
          </Button>
        </>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
        <AlertTriangle className="size-6 text-clay" />
      </div>
      <h1 className="mt-6 font-heading text-3xl sm:text-4xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        We hit an unexpected problem loading this page. Please try again — if it keeps happening, contact us and we&apos;ll help.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Loader2, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Coupon entry with applied-state chip. Controlled by the parent via callbacks. */
export function CouponForm({
  appliedCode,
  message,
  onApply,
  onRemove,
  pending,
}: {
  appliedCode: string | null;
  message?: string | null;
  onApply: (code: string) => Promise<unknown> | void;
  onRemove: () => Promise<unknown> | void;
  pending?: boolean;
}) {
  const [code, setCode] = useState("");
  if (appliedCode) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-md border border-dashed bg-secondary/50 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Tag className="size-3.5" /> {appliedCode}
          </span>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => onRemove()} disabled={pending} aria-label="Remove coupon">
            <X />
          </Button>
        </div>
        {message && (
          <p role="alert" className="text-xs text-destructive">
            {message}
          </p>
        )}
      </div>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = code.trim().toUpperCase();
        if (!value) return;
        try {
          await onApply(value);
          setCode("");
        } catch {
          /* error toast shown by caller */
        }
      }}
    >
      <label htmlFor="coupon-code" className="sr-only">
        Coupon code
      </label>
      <Input
        id="coupon-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Coupon code"
        className="uppercase placeholder:normal-case"
        autoComplete="off"
      />
      <Button type="submit" variant="outline" disabled={pending || !code.trim()}>
        {pending && <Loader2 className="animate-spin" />} Apply
      </Button>
    </form>
  );
}

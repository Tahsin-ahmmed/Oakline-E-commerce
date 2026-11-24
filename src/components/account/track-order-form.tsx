"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/form-field";
import { OrderDetailView, toOrderView, type OrderView } from "@/components/account/order-view";
import { api, errorMessage } from "@/lib/api-client";
import { orderLookupSchema } from "@/lib/validations/checkout";

export function TrackOrderForm({ initialOrder, initialEmail }: { initialOrder: string; initialEmail: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof orderLookupSchema>>({
    resolver: zodResolver(orderLookupSchema),
    defaultValues: { orderNumber: initialOrder, email: initialEmail },
  });
  const { errors, isSubmitting } = form.formState;

  const lookup = form.handleSubmit(async (values) => {
    setError(null);
    setOrder(null);
    try {
      const res = await api<unknown>("/api/orders/lookup", { body: values });
      setOrder(toOrderView(res));
      requestAnimationFrame(() => document.getElementById("track-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoRan.current && initialOrder && initialEmail) {
      autoRan.current = true;
      void lookup();
    }
  }, [initialOrder, initialEmail, lookup]);

  return (
    <div className="space-y-10">
      <form onSubmit={lookup} noValidate className="grid max-w-3xl gap-4 rounded-xl border bg-card p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Order number" htmlFor="t-order" error={errors.orderNumber?.message}>
          <Input id="t-order" placeholder="OAK-261124-XXXXX" className="uppercase placeholder:normal-case" {...form.register("orderNumber")} />
        </Field>
        <Field label="Email used at checkout" htmlFor="t-email" error={errors.email?.message}>
          <Input id="t-email" type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Button type="submit" disabled={isSubmitting} className="sm:mb-0">
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Search />} Track
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive sm:col-span-3">
            {error}
          </p>
        )}
      </form>
      <div id="track-result" aria-live="polite">
        {order && <OrderDetailView order={order} />}
      </div>
    </div>
  );
}

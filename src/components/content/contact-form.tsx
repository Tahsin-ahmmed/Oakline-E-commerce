"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/form-field";
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client";
import { contactSchema, type ContactInput } from "@/lib/validations/content";

export function ContactForm({ defaultName = "", defaultEmail = "" }: { defaultName?: string; defaultEmail?: string }) {
  const [sent, setSent] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: defaultName, email: defaultEmail, phone: "", subject: "", message: "", website: "" },
  });
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await api<{ message: string }>("/api/contact", { body: values });
      setSent(res.message);
      reset();
    } catch (e) {
      applyFieldErrors(e, setError);
      toast.error(errorMessage(e));
    }
  });

  if (sent) {
    return (
      <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-14 text-center" role="status">
        <CheckCircle2 className="size-10 text-success" />
        <h2 className="mt-4 text-2xl">Message sent</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{sent}</p>
        <Button variant="outline" className="mt-6" onClick={() => setSent(null)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 rounded-xl border bg-card p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="c-name" error={errors.name?.message} required>
          <Input id="c-name" autoComplete="name" {...register("name")} />
        </Field>
        <Field label="Email" htmlFor="c-email" error={errors.email?.message} required>
          <Input id="c-email" type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Phone" htmlFor="c-phone" error={errors.phone?.message} hint="Optional">
          <Input id="c-phone" type="tel" autoComplete="tel" {...register("phone")} />
        </Field>
        <Field label="Subject" htmlFor="c-subject" error={errors.subject?.message} required>
          <Input id="c-subject" placeholder="Order, product question, wholesale…" {...register("subject")} />
        </Field>
      </div>
      <Field label="Message" htmlFor="c-message" error={errors.message?.message} required>
        <Textarea id="c-message" rows={6} {...register("message")} placeholder="If it's about an order, please include your order number." />
      </Field>
      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>
      <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">We reply within one business day (Sat–Thu).</p>
        <Button type="submit" size="lg" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Send />} Send message
        </Button>
      </div>
    </form>
  );
}

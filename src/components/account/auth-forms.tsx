"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/account/password-input";
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { safeNext } from "@/lib/safe-redirect";

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const user = await api<{ isStaff: boolean; name: string }>("/api/auth/login", { body: values });
      qc.clear();
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      router.replace(safeNext(next) ?? (user.isStaff ? "/admin" : "/account"));
      router.refresh();
    } catch (e) {
      if (!applyFieldErrors(e, form.setError)) setError(errorMessage(e));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <PasswordInput id="password" autoComplete="current-password" {...form.register("password")} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />} Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to us?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", password: "", marketingOptIn: false },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api("/api/auth/register", { body: values });
      qc.clear();
      toast.success("Welcome! Check your inbox to confirm your email.");
      router.replace(safeNext(next) ?? "/account");
      router.refresh();
    } catch (e) {
      if (!applyFieldErrors(e, form.setError)) setError(errorMessage(e));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field label="Full name" htmlFor="name" error={errors.name?.message} required>
        <Input id="name" autoComplete="name" {...form.register("name")} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Field label="Phone" htmlFor="phone" error={errors.phone?.message} hint="Optional — used for delivery updates.">
        <Input id="phone" type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" {...form.register("phone")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters with a letter and a number." required>
        <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <Checkbox
          checked={Boolean(form.watch("marketingOptIn"))}
          onCheckedChange={(v) => form.setValue("marketingOptIn", v === true)}
          className="mt-0.5"
        />
        Send me new arrivals and occasional offers. Unsubscribe anytime.
      </label>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />} Create account
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-4">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy-policy" className="underline underline-offset-4">
          privacy policy
        </Link>
        .
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;
  if (sent) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-success" />
        <p className="mt-3 text-sm">{sent}</p>
        <Link href="/login" className="mt-5 inline-block text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        setError(null);
        try {
          const res = await api<{ message: string }>("/api/auth/forgot-password", { body: values });
          setSent(res.message);
        } catch (e) {
          setError(errorMessage(e));
        }
      })}
    >
      <FormError message={error} />
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />} Send reset link
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        setError(null);
        try {
          const res = await api<{ message: string }>("/api/auth/reset-password", { body: values });
          toast.success(res.message);
          router.replace("/login");
        } catch (e) {
          if (!applyFieldErrors(e, form.setError)) setError(errorMessage(e));
        }
      })}
    >
      <FormError message={error ?? errors.token?.message ?? null} />
      <Field label="New password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters with a letter and a number.">
        <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
        <PasswordInput id="confirmPassword" autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />} Update password
      </Button>
    </form>
  );
}

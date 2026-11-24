"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/account/password-input";
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client";
import { changePasswordSchema, profileSchema } from "@/lib/validations/auth";

export function ProfileForm({
  initial,
}: {
  initial: { name: string; email: string; phone: string; marketingOptIn: boolean; emailVerified: boolean; memberSince: string };
}) {
  const router = useRouter();
  const form = useForm<z.input<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: initial.name, phone: initial.phone, marketingOptIn: initial.marketingOptIn },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  return (
    <form
      noValidate
      className="max-w-xl space-y-5 rounded-xl border bg-card p-6"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          const saved = await api<{ name: string; phone: string | null; marketingOptIn: boolean }>("/api/account/profile", {
            method: "PATCH",
            body: values,
          });
          form.reset({ name: saved.name, phone: saved.phone ?? "", marketingOptIn: saved.marketingOptIn });
          toast.success("Profile updated");
          router.refresh();
        } catch (e) {
          if (!applyFieldErrors(e, form.setError)) toast.error(errorMessage(e));
        }
      })}
    >
      <Field label="Full name" htmlFor="p-name" error={errors.name?.message}>
        <Input id="p-name" autoComplete="name" {...form.register("name")} />
      </Field>
      <Field
        label="Email"
        htmlFor="p-email"
        hint={`${initial.emailVerified ? "Verified" : "Not verified yet"} · Contact us to change your email address.`}
      >
        <Input id="p-email" value={initial.email} readOnly disabled />
      </Field>
      <Field label="Phone" htmlFor="p-phone" error={errors.phone?.message}>
        <Input id="p-phone" type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" {...form.register("phone")} />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <Checkbox
          checked={Boolean(form.watch("marketingOptIn"))}
          onCheckedChange={(v) => form.setValue("marketingOptIn", v === true, { shouldDirty: true })}
        />
        Email me about new arrivals and offers
      </label>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">Member since {initial.memberSince}</p>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Loader2 className="animate-spin" />} Save changes
        </Button>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const form = useForm<z.input<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;
  return (
    <form
      noValidate
      className="max-w-xl space-y-5 rounded-xl border bg-card p-6"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          const res = await api<{ message: string }>("/api/account/password", { body: values });
          toast.success(res.message);
          form.reset();
        } catch (e) {
          if (!applyFieldErrors(e, form.setError)) toast.error(errorMessage(e));
        }
      })}
    >
      <Field label="Current password" htmlFor="s-current" error={errors.currentPassword?.message}>
        <PasswordInput id="s-current" autoComplete="current-password" {...form.register("currentPassword")} />
      </Field>
      <Field label="New password" htmlFor="s-new" error={errors.newPassword?.message} hint="At least 8 characters with a letter and a number.">
        <PasswordInput id="s-new" autoComplete="new-password" {...form.register("newPassword")} />
      </Field>
      <Field label="Confirm new password" htmlFor="s-confirm" error={errors.confirmPassword?.message}>
        <PasswordInput id="s-confirm" autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />} Update password
        </Button>
      </div>
    </form>
  );
}

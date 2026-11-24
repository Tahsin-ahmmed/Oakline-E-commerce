import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/account/auth-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <p className="eyebrow">Account help</p>
      <h1 className="mt-2 mb-2 font-heading text-4xl">Forgot your password?</h1>
      <p className="mb-8 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <ForgotPasswordForm />
    </>
  );
}

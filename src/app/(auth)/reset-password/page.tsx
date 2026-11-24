import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/account/auth-forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <p className="eyebrow">Account help</p>
      <h1 className="mt-2 mb-8 font-heading text-4xl">Choose a new password</h1>
      {token && token.length >= 20 ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="rounded-lg border bg-card p-6 text-sm">
          This reset link is incomplete or invalid.{" "}
          <Link href="/forgot-password" className="underline underline-offset-4">
            Request a new link
          </Link>
          .
        </div>
      )}
    </>
  );
}

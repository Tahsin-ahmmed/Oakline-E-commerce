import type { Metadata } from "next";
import { VerifyEmail } from "@/components/account/verify-email";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <p className="eyebrow">Account</p>
      <h1 className="mt-2 mb-8 font-heading text-4xl">Email verification</h1>
      <VerifyEmail token={token ?? ""} />
    </>
  );
}

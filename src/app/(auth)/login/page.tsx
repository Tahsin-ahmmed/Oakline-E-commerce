import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/safe-redirect";
import { LoginForm } from "@/components/account/auth-forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next) ?? undefined;
  const user = await getCurrentUser();
  if (user) redirect(target ?? (user.isStaff ? "/admin" : "/account"));
  return (
    <>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-2 mb-8 font-heading text-4xl">Sign in</h1>
      <LoginForm next={target} />
    </>
  );
}

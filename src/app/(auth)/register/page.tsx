import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/safe-redirect";
import { RegisterForm } from "@/components/account/auth-forms";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next) ?? undefined;
  if (await getCurrentUser()) redirect(target ?? "/account");
  return (
    <>
      <p className="eyebrow">Join us</p>
      <h1 className="mt-2 mb-2 font-heading text-4xl">Create an account</h1>
      <p className="mb-8 text-sm text-muted-foreground">Track orders, save addresses and keep a wishlist.</p>
      <RegisterForm next={target} />
    </>
  );
}

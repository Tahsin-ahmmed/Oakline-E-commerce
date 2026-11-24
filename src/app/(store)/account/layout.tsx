import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { AccountNav } from "@/components/account/account-nav";

export const metadata: Metadata = { title: { default: "My account", template: "%s · My account" }, robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  return (
    <div className="container-page py-10 lg:py-14">
      <p className="eyebrow">My account</p>
      <h1 className="mt-2 mb-8 font-heading text-4xl">Hello, {user.name.split(" ")[0]}</h1>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
        <aside className="lg:sticky lg:top-32 lg:h-fit">
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

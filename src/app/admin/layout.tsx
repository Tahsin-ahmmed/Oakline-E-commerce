import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { getSettings } from "@/services/settings";
import { AdminProvider } from "@/components/admin/admin-context";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff(undefined, "/admin");
  const settings = await getSettings();
  return (
    <AdminProvider
      value={{
        user: { id: user.id, name: user.name, email: user.email, roles: user.roles, permissions: user.permissions },
        currency: settings.general.currency,
        siteName: settings.general.siteName,
      }}
    >
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}

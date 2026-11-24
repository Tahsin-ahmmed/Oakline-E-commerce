import { requireStaff } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/permissions";
import { integrations } from "@/lib/env";
import { getSettings } from "@/services/settings";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsTabs } from "@/components/admin/settings/settings-form";

export const metadata = { title: "Store settings" };

export default async function SettingsPage() {
  const user = await requireStaff("settings.manage", "/admin/settings");
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Store settings" description="Each section saves independently." />
      <SettingsTabs
        settings={settings}
        canCritical={hasPermission(user, "settings.critical")}
        integrations={{
          cloudinary: integrations.cloudinary(),
          stripe: integrations.stripe(),
          stripeWebhook: integrations.stripeWebhook(),
          smtp: integrations.smtp(),
        }}
      />
    </>
  );
}

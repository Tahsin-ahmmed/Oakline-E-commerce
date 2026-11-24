import { route } from "@/lib/api";
import { integrations } from "@/lib/env";
import { getSettings } from "@/services/settings";

/** GET /api/admin/settings — all setting groups plus integration status (booleans only, never secrets). */
export const GET = route({ auth: "staff", permission: "settings.manage" }, async () => ({
  settings: await getSettings(),
  integrations: {
    cloudinary: integrations.cloudinary(),
    stripe: integrations.stripe(),
    stripeWebhook: integrations.stripeWebhook(),
    smtp: integrations.smtp(),
  },
}));

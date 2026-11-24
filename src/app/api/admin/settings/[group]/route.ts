import { route, zodDetails } from "@/lib/api";
import { forbidden, notFound, validationError } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import {
  CRITICAL_SETTINGS_GROUPS,
  SETTINGS_GROUPS,
  settingsSchemas,
  type SettingsGroup,
} from "@/lib/validations/settings";
import { getSettings, updateSettingsGroup } from "@/services/settings";
import { logActivity } from "@/services/audit";

function parseGroup(group: string): SettingsGroup {
  if (!(SETTINGS_GROUPS as string[]).includes(group)) throw notFound("Unknown settings group.");
  return group as SettingsGroup;
}

export const GET = route<{ group: string }>({ auth: "staff", permission: "settings.manage" }, async ({ params }) => {
  const group = parseGroup(params.group);
  return (await getSettings())[group];
});

export const PATCH = route<{ group: string }>({ auth: "staff", permission: "settings.manage" }, async ({ params, req, user, ip }) => {
  const group = parseGroup(params.group);
  if (CRITICAL_SETTINGS_GROUPS.includes(group) && !hasPermission(user, "settings.critical")) {
    throw forbidden("Only a Super Admin can change these settings.");
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = settingsSchemas[group].safeParse(body);
  if (!parsed.success) throw validationError("Please check the highlighted fields.", zodDetails(parsed.error));

  const before = (await getSettings())[group] as Record<string, unknown>;
  const saved = await updateSettingsGroup(group, parsed.data);
  const changedKeys = Object.keys(saved).filter((k) => JSON.stringify(before[k]) !== JSON.stringify((saved as Record<string, unknown>)[k]));
  await logActivity({
    user,
    ip,
    action: "settings.update",
    entityType: "WebsiteSetting",
    entityId: group,
    summary: `Updated ${group} settings`,
    // Log which fields changed, never their values.
    metadata: { group, changedKeys },
  });
  return saved;
});

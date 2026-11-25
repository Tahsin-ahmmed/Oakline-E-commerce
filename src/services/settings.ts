import "server-only";
import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { defaultSettings, settingsSchemas, type Settings, type SettingsGroup } from "@/lib/validations/settings";

export const SETTINGS_TAG = "settings";

async function loadSettings(): Promise<Settings> {
  const rows = await prisma.websiteSetting.findMany();
  const settings = defaultSettings();
  for (const row of rows) {
    const group = row.key as SettingsGroup;
    const schema = settingsSchemas[group];
    if (!schema) continue;
    const parsed = schema.safeParse(row.value ?? {});
    // Fall back to defaults for any group that fails validation rather than breaking the storefront.
    if (parsed.success) (settings as Record<string, unknown>)[group] = parsed.data;
  }
  return settings;
}

const cachedSettings = unstable_cache(loadSettings, ["website-settings"], { tags: [SETTINGS_TAG], revalidate: 300 });

/**
 * Fill groups/fields missing from a cached copy (e.g. a settings group added in a newer release while an
 * older cached value is still being served) so callers can always rely on the full Settings shape.
 */
function withDefaults(value: Partial<Settings> | null | undefined): Settings {
  const defaults = defaultSettings();
  const out = { ...defaults } as Record<string, unknown>;
  for (const group of Object.keys(defaults) as SettingsGroup[]) {
    const current = value?.[group];
    if (current && typeof current === "object") out[group] = { ...defaults[group], ...current };
  }
  return out as Settings;
}

/** Store settings with defaults applied. Cached across requests and invalidated on update. */
export const getSettings = cache(async (): Promise<Settings> => {
  try {
    return withDefaults(await cachedSettings());
  } catch {
    // Outside a Next.js request context (scripts/tests) unstable_cache is unavailable.
    return withDefaults(await loadSettings());
  }
});

export async function updateSettingsGroup<G extends SettingsGroup>(group: G, value: unknown): Promise<Settings[G]> {
  const parsed = settingsSchemas[group].parse(value) as Settings[G];
  await prisma.websiteSetting.upsert({
    where: { key: group },
    create: { key: group, value: parsed as object },
    update: { value: parsed as object },
  });
  try {
    revalidateTag(SETTINGS_TAG, { expire: 0 });
  } catch {
    /* not in a request context */
  }
  return parsed;
}

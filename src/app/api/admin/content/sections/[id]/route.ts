import { z } from "zod";
import { route } from "@/lib/api";
import { sectionUpdateSchema } from "@/lib/validations/admin/content";
import { setSectionActive, updateSection } from "@/services/admin/content";
import { logActivity } from "@/services/audit";

const opts = { auth: "staff", permission: "content.manage" } as const;

export const PUT = route<{ id: string }>(opts, async ({ params, json, user, ip }) => {
  const section = await updateSection(params.id, await json(sectionUpdateSchema));
  await logActivity({ user, ip, action: "homepage.section.update", entityType: "HomepageSection", entityId: section.id, summary: `Updated homepage section “${section.title}”` });
  return section;
});

export const PATCH = route<{ id: string }>(opts, async ({ params, json, user, ip }) => {
  const { isActive } = await json(z.object({ isActive: z.boolean() }));
  const section = await setSectionActive(params.id, isActive);
  await logActivity({ user, ip, action: "homepage.section.toggle", entityType: "HomepageSection", entityId: section.id, summary: `${isActive ? "Showed" : "Hid"} homepage section “${section.title}”` });
  return section;
});

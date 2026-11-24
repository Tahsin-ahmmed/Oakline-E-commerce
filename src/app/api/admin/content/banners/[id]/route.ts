import { z } from "zod";
import { route } from "@/lib/api";
import { bannerSchema } from "@/lib/validations/admin/content";
import { deleteBanner, setBannerActive, updateBanner } from "@/services/admin/content";
import { logActivity } from "@/services/audit";

const opts = { auth: "staff", permission: "content.manage" } as const;

/** PUT — full update. */
export const PUT = route<{ id: string }>(opts, async ({ params, json, user, ip }) => {
  const banner = await updateBanner(params.id, await json(bannerSchema));
  await logActivity({ user, ip, action: "banner.update", entityType: "Banner", entityId: banner.id, summary: `Updated banner “${banner.title}”` });
  return banner;
});

/** PATCH — toggle active. */
export const PATCH = route<{ id: string }>(opts, async ({ params, json, user, ip }) => {
  const { isActive } = await json(z.object({ isActive: z.boolean() }));
  const banner = await setBannerActive(params.id, isActive);
  await logActivity({ user, ip, action: "banner.toggle", entityType: "Banner", entityId: banner.id, summary: `${isActive ? "Enabled" : "Disabled"} banner “${banner.title}”` });
  return banner;
});

export const DELETE = route<{ id: string }>(opts, async ({ params, user, ip }) => {
  const banner = await deleteBanner(params.id);
  await logActivity({ user, ip, action: "banner.delete", entityType: "Banner", entityId: banner.id, summary: `Deleted banner “${banner.title}”` });
  return { deleted: true };
});

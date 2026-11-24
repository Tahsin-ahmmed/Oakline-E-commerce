import { route } from "@/lib/api";
import { bannerSchema } from "@/lib/validations/admin/content";
import { createBanner, listBanners } from "@/services/admin/content";
import { logActivity } from "@/services/audit";

export const GET = route({ auth: "staff", permission: "content.manage" }, async () => listBanners());

export const POST = route({ auth: "staff", permission: "content.manage" }, async ({ json, user, ip }) => {
  const banner = await createBanner(await json(bannerSchema));
  await logActivity({ user, ip, action: "banner.create", entityType: "Banner", entityId: banner.id, summary: `Created banner “${banner.title}”` });
  return banner;
});

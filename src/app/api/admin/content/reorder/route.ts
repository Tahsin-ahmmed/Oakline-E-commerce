import { route } from "@/lib/api";
import { reorderSchema } from "@/lib/validations/admin/content";
import { reorder } from "@/services/admin/content";
import { logActivity } from "@/services/audit";

/** POST { entity, ids } — sets sortOrder to each id's index. */
export const POST = route({ auth: "staff", permission: "content.manage" }, async ({ json, user, ip }) => {
  const { entity, ids } = await json(reorderSchema);
  await reorder(entity, ids);
  await logActivity({ user, ip, action: `${entity}.reorder`, entityType: entity, summary: `Reordered ${ids.length} ${entity} items` });
  return { ok: true };
});

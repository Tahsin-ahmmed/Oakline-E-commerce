import { route } from "@/lib/api";
import { categoryDeleteSchema, categoryPatchSchema, categorySchema } from "@/lib/validations/admin/catalog";
import { deleteCategory, patchCategory, updateCategory } from "@/services/admin/categories";
import { logActivity } from "@/services/audit";

export const PUT = route<{ id: string }>({ auth: "staff", permission: "catalog.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(categorySchema);
  const c = await updateCategory(params.id, input);
  await logActivity({ user, action: "category.update", entityType: "Category", entityId: c.id, summary: `Updated category ${c.name}`, ip });
  return c;
});

export const PATCH = route<{ id: string }>({ auth: "staff", permission: "catalog.manage" }, async ({ params, json, user, ip }) => {
  const patch = await json(categoryPatchSchema);
  await patchCategory(params.id, patch);
  await logActivity({ user, action: "category.update", entityType: "Category", entityId: params.id, summary: `Category ${JSON.stringify(patch)}`, ip });
  return { ok: true };
});

/** DELETE /api/admin/categories/:id?moveToId= — blocked (409) while products/children exist unless moveToId is given. */
export const DELETE = route<{ id: string }>({ auth: "staff", permission: "catalog.manage" }, async ({ params, query, user, ip }) => {
  const { moveToId } = query(categoryDeleteSchema);
  const res = await deleteCategory(params.id, moveToId || undefined);
  await logActivity({ user, action: "category.delete", entityType: "Category", entityId: params.id, summary: `Deleted category ${res.name}`, metadata: { moveToId }, ip });
  return { deleted: true };
});

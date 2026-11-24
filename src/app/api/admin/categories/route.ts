import { route } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { hasAnyPermission } from "@/lib/permissions";
import { categorySchema } from "@/lib/validations/admin/catalog";
import { createCategory, listCategoryTree } from "@/services/admin/categories";
import { logActivity } from "@/services/audit";

/**
 * GET /api/admin/categories — tree:
 *   [{ id, name, slug, parentId: null, isActive, productCount, totalProducts, children: [{ id, name, slug, parentId, ... }] }]
 * ?flat=1 → [{ id, name, parentId, depth }] in display order (for pickers).
 */
export const GET = route({ auth: "staff" }, async ({ req, user }) => {
  if (!hasAnyPermission(user, ["catalog.manage", "products.view", "coupons.manage", "inventory.view"])) throw forbidden();
  const tree = await listCategoryTree();
  if (req.nextUrl.searchParams.get("flat")) {
    return tree.flatMap((p) => [
      { id: p.id, name: p.name, parentId: null, depth: 0 },
      ...p.children.map((c) => ({ id: c.id, name: c.name, parentId: p.id, depth: 1 })),
    ]);
  }
  return tree;
});

export const POST = route({ auth: "staff", permission: "catalog.manage" }, async ({ json, user, ip }) => {
  const input = await json(categorySchema);
  const c = await createCategory(input);
  await logActivity({ user, action: "category.create", entityType: "Category", entityId: c.id, summary: `Created category ${c.name}`, ip });
  return c;
});

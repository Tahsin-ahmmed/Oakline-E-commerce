import { route } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { hasAnyPermission } from "@/lib/permissions";
import { attributeSchema } from "@/lib/validations/admin/catalog";
import { listAttributes, saveAttribute } from "@/services/admin/categories";
import { logActivity } from "@/services/audit";

export const GET = route({ auth: "staff", permission: "products.view" }, async () => listAttributes());

/** Product managers may create a specification inline from the product form. */
export const POST = route({ auth: "staff" }, async ({ json, user, ip }) => {
  if (!hasAnyPermission(user, ["catalog.manage", "products.manage"])) throw forbidden();
  const input = await json(attributeSchema);
  const attr = await saveAttribute(input);
  await logActivity({ user, action: "attribute.create", entityType: "ProductAttribute", entityId: attr.id, summary: `Created attribute ${attr.name}`, ip });
  return attr;
});

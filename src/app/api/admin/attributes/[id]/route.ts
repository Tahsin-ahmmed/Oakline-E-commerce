import { route } from "@/lib/api";
import { attributeSchema } from "@/lib/validations/admin/catalog";
import { deleteAttribute, saveAttribute } from "@/services/admin/categories";
import { logActivity } from "@/services/audit";

export const PUT = route<{ id: string }>({ auth: "staff", permission: "catalog.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(attributeSchema);
  const attr = await saveAttribute(input, params.id);
  await logActivity({ user, action: "attribute.update", entityType: "ProductAttribute", entityId: attr.id, summary: `Updated attribute ${attr.name}`, ip });
  return attr;
});

export const DELETE = route<{ id: string }>({ auth: "staff", permission: "catalog.manage" }, async ({ params, user, ip }) => {
  const res = await deleteAttribute(params.id);
  await logActivity({ user, action: "attribute.delete", entityType: "ProductAttribute", entityId: params.id, summary: `Deleted attribute ${res.name} (${res.removedValues} values)`, ip });
  return res;
});

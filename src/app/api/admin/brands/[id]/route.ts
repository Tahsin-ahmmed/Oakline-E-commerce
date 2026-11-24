import { route } from "@/lib/api";
import { brandSchema } from "@/lib/validations/admin/catalog";
import { deleteBrand, saveBrand } from "@/services/admin/categories";
import { logActivity } from "@/services/audit";

export const PUT = route<{ id: string }>({ auth: "staff", permission: "catalog.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(brandSchema);
  const brand = await saveBrand(input, params.id);
  await logActivity({ user, action: "brand.update", entityType: "Brand", entityId: brand.id, summary: `Updated brand ${brand.name}`, ip });
  return brand;
});

export const DELETE = route<{ id: string }>({ auth: "staff", permission: "catalog.manage" }, async ({ params, user, ip }) => {
  const brand = await deleteBrand(params.id);
  await logActivity({ user, action: "brand.delete", entityType: "Brand", entityId: params.id, summary: `Deleted brand ${brand.name}`, ip });
  return { deleted: true };
});

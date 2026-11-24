import { route } from "@/lib/api";
import { brandSchema } from "@/lib/validations/admin/catalog";
import { listBrands, saveBrand } from "@/services/admin/categories";
import { logActivity } from "@/services/audit";

export const GET = route({ auth: "staff", permission: "products.view" }, async () => listBrands());

export const POST = route({ auth: "staff", permission: "catalog.manage" }, async ({ json, user, ip }) => {
  const input = await json(brandSchema);
  const brand = await saveBrand(input);
  await logActivity({ user, action: "brand.create", entityType: "Brand", entityId: brand.id, summary: `Created brand ${brand.name}`, ip });
  return brand;
});

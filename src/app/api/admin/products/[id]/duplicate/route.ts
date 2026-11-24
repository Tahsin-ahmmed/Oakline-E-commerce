import { route } from "@/lib/api";
import { duplicateProduct } from "@/services/admin/products";
import { logActivity } from "@/services/audit";

export const POST = route<{ id: string }>({ auth: "staff", permission: "products.manage" }, async ({ params, user, ip }) => {
  const copy = await duplicateProduct(params.id, user!.id);
  await logActivity({ user, action: "product.duplicate", entityType: "Product", entityId: copy.id, summary: `Duplicated product as ${copy.name}`, metadata: { sourceId: params.id }, ip });
  return { id: copy.id };
});

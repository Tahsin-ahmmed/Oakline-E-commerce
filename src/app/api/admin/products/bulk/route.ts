import { route } from "@/lib/api";
import { productBulkSchema } from "@/lib/validations/admin/catalog";
import { bulkProducts } from "@/services/admin/products";
import { logActivity } from "@/services/audit";

export const POST = route({ auth: "staff", permission: "products.manage" }, async ({ json, user, ip }) => {
  const input = await json(productBulkSchema);
  const result = await bulkProducts(input.ids, input.action, input.status);
  await logActivity({
    user,
    action: `product.bulk_${input.action}`,
    entityType: "Product",
    summary: `Bulk ${input.action}${input.status ? ` → ${input.status}` : ""} on ${result.count} product(s)`,
    metadata: { ids: input.ids },
    ip,
  });
  return result;
});

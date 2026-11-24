import { route } from "@/lib/api";
import { badRequest, notFound } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { productPatchSchema, productSchema } from "@/lib/validations/admin/catalog";
import { deleteProduct, getAdminProduct, patchProduct, updateProduct } from "@/services/admin/products";
import { logActivity } from "@/services/audit";

export const GET = route<{ id: string }>({ auth: "staff", permission: "products.view" }, async ({ params, user }) => {
  const product = await getAdminProduct(params.id);
  if (!product) throw notFound("Product not found.");
  // Cost price is only for staff who can manage products.
  if (!hasPermission(user, "products.manage")) product.input.costPrice = null;
  return product;
});

/** PATCH with the full product form replaces the product; a partial { isFeatured?, status? } toggles quickly. */
export const PATCH = route<{ id: string }>({ auth: "staff", permission: "products.manage" }, async ({ params, req, user, ip }) => {
  let body: unknown;
  try {
    body = await req.clone().json();
  } catch {
    body = null;
  }
  const isFull = body !== null && typeof body === "object" && "variants" in body;
  if (isFull) {
    const parsed = productSchema.parse(body);
    const product = await updateProduct(params.id, parsed, user!.id);
    await logActivity({ user, action: "product.update", entityType: "Product", entityId: product.id, summary: `Updated product ${product.name}`, ip });
    return { id: product.id, slug: product.slug };
  }
  const patch = productPatchSchema.parse(body ?? {});
  if (patch.isFeatured === undefined && patch.status === undefined) throw badRequest("Nothing to update.");
  const product = await patchProduct(params.id, patch);
  await logActivity({
    user,
    action: "product.update",
    entityType: "Product",
    entityId: product.id,
    summary: `Set ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")} on ${product.name}`,
    ip,
  });
  return { id: product.id, isFeatured: product.isFeatured, status: product.status };
});

export const DELETE = route<{ id: string }>({ auth: "staff", permission: "products.manage" }, async ({ params, user, ip }) => {
  const product = await deleteProduct(params.id);
  await logActivity({ user, action: "product.delete", entityType: "Product", entityId: product.id, summary: `Deleted product ${product.name}`, ip });
  return { deleted: true };
});

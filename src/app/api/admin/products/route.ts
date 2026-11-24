import { z } from "zod";
import { route } from "@/lib/api";
import { PRODUCT_STATUSES, productSchema, STOCK_FILTERS } from "@/lib/validations/admin/catalog";
import { createProduct, listAdminProducts } from "@/services/admin/products";
import { logActivity } from "@/services/audit";

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(40).optional(),
  brand: z.string().max(40).optional(),
  status: z.enum(PRODUCT_STATUSES).optional().catch(undefined),
  stock: z.enum(STOCK_FILTERS).optional().catch(undefined),
  featured: z.enum(["1", "0"]).optional().catch(undefined),
  sort: z.enum(["updated", "name", "price_asc", "price_desc", "stock", "sold"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20).default(20),
});

/**
 * GET /api/admin/products — { items: [{ id, name, sku, slug, price, salePrice, status, isFeatured,
 *   stockQuantity, image, category: {id,name}, brand, ... }], total, page, pageSize }
 */
export const GET = route({ auth: "staff", permission: "products.view" }, async ({ query }) => {
  const f = query(listQuery);
  const result = await listAdminProducts({
    q: f.q,
    categoryId: f.category,
    brandId: f.brand,
    status: f.status,
    stock: f.stock,
    featured: f.featured === undefined ? undefined : f.featured === "1",
    sort: f.sort,
    skip: (f.page - 1) * f.pageSize,
    take: f.pageSize,
  });
  return { ...result, page: f.page, pageSize: f.pageSize };
});

export const POST = route({ auth: "staff", permission: "products.manage" }, async ({ json, user, ip }) => {
  const input = await json(productSchema);
  const product = await createProduct(input, user!.id);
  await logActivity({ user, action: "product.create", entityType: "Product", entityId: product.id, summary: `Created product ${product.name}`, ip });
  return { id: product.id, slug: product.slug };
});

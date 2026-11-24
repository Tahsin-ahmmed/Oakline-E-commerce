import { z } from "zod";
import { route } from "@/lib/api";
import { STOCK_FILTERS } from "@/lib/validations/admin/catalog";
import { inventorySummary, listInventory } from "@/services/admin/inventory";

const schema = z.object({
  q: z.string().trim().max(100).optional(),
  stock: z.enum(STOCK_FILTERS).optional().catch(undefined),
  category: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).catch(50).default(50),
});

/** GET /api/admin/inventory — { items, total, page, pageSize, summary } */
export const GET = route({ auth: "staff", permission: "inventory.view" }, async ({ query }) => {
  const f = query(schema);
  const [list, summary] = await Promise.all([
    listInventory({ q: f.q, stock: f.stock, categoryId: f.category, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
    inventorySummary(),
  ]);
  return { ...list, page: f.page, pageSize: f.pageSize, summary };
});

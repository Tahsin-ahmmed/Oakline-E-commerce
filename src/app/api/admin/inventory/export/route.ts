import { z } from "zod";
import { route } from "@/lib/api";
import { STOCK_FILTERS } from "@/lib/validations/admin/catalog";
import { inventoryCsv } from "@/services/admin/inventory";
import { logActivity } from "@/services/audit";

/** GET /api/admin/inventory/export — CSV inventory report (respects the same filters as the list). */
export const GET = route({ auth: "staff", permission: "inventory.view" }, async ({ query, user, ip }) => {
  const f = query(
    z.object({
      q: z.string().trim().max(100).optional(),
      stock: z.enum(STOCK_FILTERS).optional().catch(undefined),
      category: z.string().max(40).optional(),
    }),
  );
  const csv = await inventoryCsv({ q: f.q, stock: f.stock, categoryId: f.category });
  await logActivity({ user, action: "inventory.export", entityType: "Inventory", summary: "Exported inventory report", ip });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});

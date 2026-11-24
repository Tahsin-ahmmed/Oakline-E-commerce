import { route } from "@/lib/api";
import { orderListQuery } from "@/lib/validations/admin/sales";
import { exportOrdersCsv } from "@/services/admin/orders";
import { logActivity } from "@/services/audit";

/** GET /api/admin/orders/export — CSV of orders matching the current filters. */
export const GET = route({ auth: "staff", permission: "orders.view" }, async ({ query, user, ip }) => {
  const filters = query(orderListQuery);
  const csv = await exportOrdersCsv(filters);
  await logActivity({ user, action: "order.export", entityType: "Order", summary: "Exported orders CSV", metadata: { filters }, ip });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});

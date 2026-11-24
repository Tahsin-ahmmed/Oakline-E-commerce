import { route } from "@/lib/api";
import { dashboardQuerySchema } from "@/lib/validations/admin/system";
import { getOrderBreakdown, resolveRange } from "@/services/admin/dashboard";

/** GET /api/admin/dashboard/orders — orders by status and sales by category for the range. */
export const GET = route({ auth: "staff", permission: "dashboard.view" }, async ({ query }) => {
  const range = resolveRange(query(dashboardQuerySchema));
  return { range: { key: range.key, from: range.from.toISOString(), to: range.to.toISOString() }, ...(await getOrderBreakdown(range)) };
});

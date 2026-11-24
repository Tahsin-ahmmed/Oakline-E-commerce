import { route } from "@/lib/api";
import { dashboardQuerySchema } from "@/lib/validations/admin/system";
import { getOverview, getRecentActivity, getTopProducts, resolveRange } from "@/services/admin/dashboard";

/** GET /api/admin/dashboard/overview?range=30d|7d|today|month|year|custom&from=&to= */
export const GET = route({ auth: "staff", permission: "dashboard.view" }, async ({ query }) => {
  const range = resolveRange(query(dashboardQuerySchema));
  const [overview, topProducts, recent] = await Promise.all([getOverview(range), getTopProducts(range), getRecentActivity()]);
  return { ...overview, topProducts, recent };
});

import { route } from "@/lib/api";
import { dashboardQuerySchema } from "@/lib/validations/admin/system";
import { getRevenueSeries, resolveRange } from "@/services/admin/dashboard";

/** GET /api/admin/dashboard/revenue — revenue & order count per day/month (Asia/Dhaka). */
export const GET = route({ auth: "staff", permission: "dashboard.view" }, async ({ query }) => {
  const range = resolveRange(query(dashboardQuerySchema));
  return { range: { key: range.key, from: range.from.toISOString(), to: range.to.toISOString() }, ...(await getRevenueSeries(range)) };
});

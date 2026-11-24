import { route } from "@/lib/api";
import { orderListQuery } from "@/lib/validations/admin/sales";
import { listAdminOrders } from "@/services/admin/orders";

/** GET /api/admin/orders — searchable, filterable order list. */
export const GET = route({ auth: "staff", permission: "orders.view" }, async ({ query }) => listAdminOrders(query(orderListQuery)));

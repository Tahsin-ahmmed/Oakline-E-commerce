import { route } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getAdminOrder } from "@/services/admin/orders";

export const GET = route<{ id: string }>({ auth: "staff", permission: "orders.view" }, async ({ params }) => {
  const order = await getAdminOrder(params.id);
  if (!order) throw notFound("Order not found.");
  return order;
});

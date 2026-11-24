import { route } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getCustomerOrder } from "@/services/orders";

export const GET = route<{ id: string }>({ auth: "user" }, async ({ user, params }) => {
  const order = await getCustomerOrder(params.id, user!.id);
  if (!order) throw notFound("Order not found.");
  return order;
});

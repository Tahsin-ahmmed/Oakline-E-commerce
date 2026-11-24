import { z } from "zod";
import { route } from "@/lib/api";
import { cancelOrderAsCustomer } from "@/services/orders";

export const POST = route<{ id: string }>({ auth: "user" }, async ({ user, params, json }) => {
  const { reason } = await json(z.object({ reason: z.string().trim().max(300).optional() }));
  const order = await cancelOrderAsCustomer(params.id, user!.id, reason);
  return { id: order.id, status: order.status };
});

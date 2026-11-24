import { z } from "zod";
import { route } from "@/lib/api";
import { stripHtml } from "@/lib/sanitize";
import { requestReturn } from "@/services/orders";

const schema = z.object({
  orderItemId: z.string().min(1).max(40).optional(),
  reason: z.enum(["Damaged or defective", "Wrong item received", "Not as described", "Changed my mind", "Other"]),
  details: z.string().trim().max(1000).optional(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export const POST = route<{ id: string }>({ auth: "user" }, async ({ user, params, json }) => {
  const input = await json(schema);
  return requestReturn(user!.id, {
    orderId: params.id,
    orderItemId: input.orderItemId,
    reason: input.reason,
    details: input.details ? stripHtml(input.details) : undefined,
    quantity: input.quantity,
  });
});

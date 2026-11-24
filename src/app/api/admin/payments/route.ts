import { z } from "zod";
import { route } from "@/lib/api";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/order-status";
import { listPayments, paymentSummary } from "@/services/admin/payments";

/** GET /api/admin/payments — payment records + summary. */
export const GET = route({ auth: "staff", permission: "payments.view" }, async ({ query }) => {
  const q = query(
    z.object({
      q: z.string().trim().max(100).optional(),
      method: z.enum(PAYMENT_METHODS).optional().catch(undefined),
      status: z.enum(PAYMENT_STATUSES).optional().catch(undefined),
      page: z.coerce.number().int().min(1).catch(1).default(1),
      pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
    }),
  );
  const [list, summary] = await Promise.all([listPayments(q), paymentSummary()]);
  return { ...list, summary };
});

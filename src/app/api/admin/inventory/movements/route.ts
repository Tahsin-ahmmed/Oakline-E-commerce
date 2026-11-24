import { z } from "zod";
import { route } from "@/lib/api";
import { listMovements, MOVEMENT_TYPES } from "@/services/admin/inventory";

const schema = z.object({
  variantId: z.string().max(40).optional(),
  type: z.enum(MOVEMENT_TYPES as [string, ...string[]]).optional().catch(undefined),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(25).default(25),
});

/** GET /api/admin/inventory/movements — stock movement log { items, total, page, pageSize }. */
export const GET = route({ auth: "staff", permission: "inventory.view" }, async ({ query }) => {
  const f = query(schema);
  const res = await listMovements({
    variantId: f.variantId,
    type: f.type as (typeof MOVEMENT_TYPES)[number] | undefined,
    q: f.q,
    skip: (f.page - 1) * f.pageSize,
    take: f.pageSize,
  });
  return { ...res, page: f.page, pageSize: f.pageSize };
});

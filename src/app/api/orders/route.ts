import { route } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { pagination } from "@/lib/validations/common";
import { checkoutSchema } from "@/lib/validations/checkout";
import { placeOrder } from "@/services/checkout";

/** POST /api/orders — place an order from the current cart. Prices, stock, coupon & shipping are recomputed server-side. */
export const POST = route({ auth: "optional", rateLimit: RATE_LIMITS.checkout }, async ({ json, user }) => {
  const input = await json(checkoutSchema);
  return placeOrder(input, user);
});

/** GET /api/orders — the signed-in customer's orders. */
export const GET = route({ auth: "user" }, async ({ user, query }) => {
  const { page, pageSize } = query(pagination);
  const where = { userId: user!.id };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        grandTotal: true,
        currency: true,
        placedAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, page, pageSize };
});

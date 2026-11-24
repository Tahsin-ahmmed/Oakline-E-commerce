import { route } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { startOnlinePayment } from "@/services/checkout";

/** POST /api/orders/:id/pay — retry an online payment for an unpaid order owned by the customer. */
export const POST = route<{ id: string }>(
  { auth: "user", rateLimit: RATE_LIMITS.checkout, rateLimitBy: "user" },
  async ({ user, params }) => {
    const order = await prisma.order.findFirst({ where: { id: params.id, userId: user!.id }, select: { id: true } });
    if (!order) throw notFound("Order not found.");
    return { redirectUrl: await startOnlinePayment(order.id) };
  },
);

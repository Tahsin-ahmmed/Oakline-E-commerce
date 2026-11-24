import { z } from "zod";
import { route } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

/** Global admin search — results are limited to what the staff member is allowed to see. */
export const GET = route({ auth: "staff" }, async ({ query, user }) => {
  const { q } = query(z.object({ q: z.string().trim().min(2).max(80) }));
  const contains = { contains: q, mode: "insensitive" as const };
  const [orders, products, customers] = await Promise.all([
    hasPermission(user, "orders.view")
      ? prisma.order.findMany({
          where: { OR: [{ orderNumber: contains }, { customerName: contains }, { customerEmail: contains }, { customerPhone: contains }] },
          select: { id: true, orderNumber: true, customerName: true },
          orderBy: { placedAt: "desc" },
          take: 5,
        })
      : [],
    hasPermission(user, "products.view")
      ? prisma.product.findMany({
          where: { deletedAt: null, OR: [{ name: contains }, { sku: contains }] },
          select: { id: true, name: true, sku: true },
          take: 5,
        })
      : [],
    hasPermission(user, "customers.view")
      ? prisma.user.findMany({
          where: { isStaff: false, deletedAt: null, OR: [{ name: contains }, { email: contains }, { phone: contains }] },
          select: { id: true, name: true, email: true },
          take: 5,
        })
      : [],
  ]);
  return { orders, products, customers };
});

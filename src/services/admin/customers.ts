import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { conflict, notFound } from "@/lib/errors";
import { moneyString } from "@/lib/money";
import { revokeUserSessions } from "@/lib/auth/session";
import type { CustomerUpdateInput } from "@/lib/validations/admin/sales";
import { logActivity } from "@/services/audit";

export type CustomerSort = "joined_desc" | "joined_asc" | "spend_desc" | "orders_desc" | "name_asc";

export async function listCustomers(opts: {
  q?: string;
  status?: "ACTIVE" | "BLOCKED";
  sort: CustomerSort;
  page: number;
  pageSize: number;
}) {
  const conditions: Prisma.Sql[] = [Prisma.sql`u."isStaff" = false`, Prisma.sql`u."deletedAt" IS NULL`];
  if (opts.q) {
    const like = `%${opts.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conditions.push(Prisma.sql`(u."name" ILIKE ${like} OR u."email" ILIKE ${like} OR COALESCE(u."phone", '') ILIKE ${like})`);
  }
  if (opts.status) conditions.push(Prisma.sql`u."status"::text = ${opts.status}`);
  const where = Prisma.join(conditions, " AND ");
  const orderBy = {
    joined_desc: Prisma.sql`u."createdAt" DESC`,
    joined_asc: Prisma.sql`u."createdAt" ASC`,
    spend_desc: Prisma.sql`spent DESC, u."createdAt" DESC`,
    orders_desc: Prisma.sql`"orderCount" DESC, u."createdAt" DESC`,
    name_asc: Prisma.sql`u."name" ASC`,
  }[opts.sort];
  const offset = (opts.page - 1) * opts.pageSize;

  // Aggregate spend in SQL so sorting by spend/orders is correct across pages.
  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<
      { id: string; name: string; email: string; phone: string | null; status: string; createdAt: Date; orderCount: bigint; spent: Prisma.Decimal | null; lastOrderAt: Date | null }[]
    >`
      SELECT u."id", u."name", u."email", u."phone", u."status"::text AS "status", u."createdAt",
        COUNT(o."id") AS "orderCount",
        COALESCE(SUM(o."grandTotal") FILTER (WHERE o."status" NOT IN ('CANCELLED', 'REFUNDED')), 0) AS spent,
        MAX(o."placedAt") AS "lastOrderAt"
      FROM "User" u
      LEFT JOIN "Order" o ON o."userId" = u."id"
      WHERE ${where}
      GROUP BY u."id"
      ORDER BY ${orderBy}
      LIMIT ${opts.pageSize} OFFSET ${offset}`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM "User" u WHERE ${where}`,
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      status: r.status as "ACTIVE" | "BLOCKED",
      createdAt: r.createdAt.toISOString(),
      orderCount: Number(r.orderCount),
      spent: moneyString(r.spent ?? 0),
      lastOrderAt: r.lastOrderAt?.toISOString() ?? null,
    })),
    total: Number(countRows[0]?.count ?? 0),
  };
}

export async function getCustomer(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, isStaff: false, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      marketingOptIn: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      orders: {
        orderBy: { placedAt: "desc" },
        take: 50,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          grandTotal: true,
          placedAt: true,
          _count: { select: { items: true } },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, rating: true, title: true, status: true, createdAt: true, product: { select: { id: true, name: true } } },
      },
      wishlist: { select: { _count: { select: { items: true } } } },
      _count: { select: { orders: true, sessions: true } },
    },
  });
  if (!user) return null;
  const spend = await prisma.order.aggregate({
    where: { userId: id, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    _sum: { grandTotal: true },
    _avg: { grandTotal: true },
  });
  return {
    ...user,
    totalSpent: moneyString(spend._sum.grandTotal ?? 0),
    averageOrder: moneyString(spend._avg.grandTotal ?? 0),
    wishlistCount: user.wishlist?._count.items ?? 0,
  };
}
export type AdminCustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;

async function requireCustomer(id: string) {
  const user = await prisma.user.findFirst({ where: { id, isStaff: false, deletedAt: null }, select: { id: true, email: true, name: true, status: true } });
  if (!user) throw notFound("Customer not found.");
  return user;
}

export async function updateCustomer(id: string, input: CustomerUpdateInput, actor: { id: string }, ip?: string) {
  const current = await requireCustomer(id);
  if (input.email !== current.email) {
    const taken = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (taken && taken.id !== id) throw conflict("Another account already uses this email.", { email: ["Email already in use"] });
  }
  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      marketingOptIn: input.marketingOptIn,
      // A changed email must be re-verified.
      ...(input.email !== current.email ? { emailVerifiedAt: null } : {}),
    },
    select: { id: true, name: true, email: true, phone: true, marketingOptIn: true },
  });
  await logActivity({
    user: actor,
    action: "customer.update",
    entityType: "User",
    entityId: id,
    summary: `Updated customer ${updated.email}`,
    metadata: input.email !== current.email ? { previousEmail: current.email } : undefined,
    ip,
  });
  return updated;
}

export async function setCustomerStatus(id: string, status: "ACTIVE" | "BLOCKED", actor: { id: string }, ip?: string) {
  const user = await requireCustomer(id);
  await prisma.user.update({ where: { id }, data: { status } });
  if (status === "BLOCKED") await revokeUserSessions(id);
  await logActivity({
    user: actor,
    action: status === "BLOCKED" ? "customer.block" : "customer.unblock",
    entityType: "User",
    entityId: id,
    summary: `${status === "BLOCKED" ? "Blocked" : "Unblocked"} ${user.email}`,
    ip,
  });
  return { id, status };
}

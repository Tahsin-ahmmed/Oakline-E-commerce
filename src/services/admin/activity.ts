import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { ActivityQuery } from "@/lib/validations/admin/system";

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const dhakaDay = (ymd: string) => new Date(Date.parse(`${ymd}T00:00:00Z`) - DHAKA_OFFSET_MS);

export async function listActivity(q: ActivityQuery) {
  const where: Prisma.AdminActivityLogWhereInput = {};
  if (q.userId) where.userId = q.userId;
  if (q.entityType) where.entityType = q.entityType;
  if (q.q) {
    where.OR = [
      { action: { contains: q.q, mode: "insensitive" } },
      { summary: { contains: q.q, mode: "insensitive" } },
      { entityId: { equals: q.q } },
    ];
  }
  if (q.from || q.to) {
    where.createdAt = {
      ...(q.from ? { gte: dhakaDay(q.from) } : {}),
      ...(q.to ? { lt: new Date(dhakaDay(q.to).getTime() + 86_400_000) } : {}),
    };
  }
  const [items, total] = await Promise.all([
    prisma.adminActivityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.adminActivityLog.count({ where }),
  ]);
  return {
    items: items.map((i) => ({
      id: i.id,
      action: i.action,
      entityType: i.entityType,
      entityId: i.entityId,
      summary: i.summary,
      metadata: i.metadata,
      ipAddress: i.ipAddress,
      createdAt: i.createdAt.toISOString(),
      user: i.user,
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}
export type ActivityEntry = Awaited<ReturnType<typeof listActivity>>["items"][number];

export async function activityFilterOptions() {
  const [entityTypes, users] = await Promise.all([
    prisma.adminActivityLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    prisma.user.findMany({
      where: { activityLogs: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { entityTypes: entityTypes.map((e) => e.entityType), users };
}

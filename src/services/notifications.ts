import "server-only";
import { prisma } from "@/lib/prisma";

interface NotificationInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
}

export async function notifyAdmins(input: NotificationInput) {
  try {
    await prisma.notification.create({ data: { audience: "ADMIN", ...input } });
  } catch (error) {
    console.error("[notifications] failed to create admin notification", error);
  }
}

export async function notifyCustomer(userId: string, input: NotificationInput) {
  try {
    await prisma.notification.create({ data: { audience: "CUSTOMER", userId, ...input } });
  } catch (error) {
    console.error("[notifications] failed to create customer notification", error);
  }
}

export async function listAdminNotifications(limit = 15) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { audience: "ADMIN" }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.notification.count({ where: { audience: "ADMIN", readAt: null } }),
  ]);
  return { items, unread };
}

export async function markAdminNotificationsRead(ids?: string[]) {
  await prisma.notification.updateMany({
    where: { audience: "ADMIN", readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}

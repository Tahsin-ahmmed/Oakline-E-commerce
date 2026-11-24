import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ContactStatus, SubscriberStatus } from "@/generated/prisma/enums";
import { notFound } from "@/lib/errors";
import { logActivity } from "@/services/audit";
import { toCsv } from "@/services/admin/orders";

export async function listContactMessages(opts: { q?: string; status?: ContactStatus; page: number; pageSize: number }) {
  const and: Prisma.ContactMessageWhereInput[] = [];
  if (opts.status) and.push({ status: opts.status });
  else and.push({ status: { not: "ARCHIVED" } });
  if (opts.q) {
    const contains = { contains: opts.q, mode: "insensitive" as const };
    and.push({ OR: [{ name: contains }, { email: contains }, { subject: contains }, { message: contains }] });
  }
  const where = { AND: and };
  const [items, total, unread] = await Promise.all([
    prisma.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
  ]);
  return { items: items.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })), total, unread };
}
export type ContactRow = Awaited<ReturnType<typeof listContactMessages>>["items"][number];

export async function setContactStatus(id: string, status: ContactStatus, actor: { id: string }, ip?: string) {
  const msg = await prisma.contactMessage.findUnique({ where: { id } });
  if (!msg) throw notFound("Message not found.");
  await prisma.contactMessage.update({ where: { id }, data: { status } });
  await logActivity({ user: actor, action: "contact.status", entityType: "ContactMessage", entityId: id, summary: `Message "${msg.subject}" → ${status}`, ip });
}

function subscriberWhere(opts: { q?: string; status?: SubscriberStatus }): Prisma.NewsletterSubscriberWhereInput {
  return {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.q ? { email: { contains: opts.q, mode: "insensitive" } } : {}),
  };
}

export async function listSubscribers(opts: { q?: string; status?: SubscriberStatus; page: number; pageSize: number }) {
  const where = subscriberWhere(opts);
  const [items, total, active] = await Promise.all([
    prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize }),
    prisma.newsletterSubscriber.count({ where }),
    prisma.newsletterSubscriber.count({ where: { status: "SUBSCRIBED" } }),
  ]);
  return {
    items: items.map((s) => ({
      id: s.id,
      email: s.email,
      status: s.status,
      source: s.source,
      createdAt: s.createdAt.toISOString(),
      unsubscribedAt: s.unsubscribedAt?.toISOString() ?? null,
    })),
    total,
    active,
  };
}
export type SubscriberRow = Awaited<ReturnType<typeof listSubscribers>>["items"][number];

export async function setSubscriberStatus(id: string, status: SubscriberStatus, actor: { id: string }, ip?: string) {
  const sub = await prisma.newsletterSubscriber.findUnique({ where: { id } });
  if (!sub) throw notFound("Subscriber not found.");
  await prisma.newsletterSubscriber.update({
    where: { id },
    data: { status, unsubscribedAt: status === "UNSUBSCRIBED" ? new Date() : null },
  });
  await logActivity({ user: actor, action: "newsletter.status", entityType: "NewsletterSubscriber", entityId: id, summary: `${sub.email} → ${status}`, ip });
}

export async function exportSubscribersCsv(opts: { q?: string; status?: SubscriberStatus }) {
  const subs = await prisma.newsletterSubscriber.findMany({ where: subscriberWhere(opts), orderBy: { createdAt: "desc" }, take: 50_000 });
  return toCsv([
    ["Email", "Status", "Source", "Subscribed at", "Unsubscribed at"],
    ...subs.map((s) => [s.email, s.status, s.source ?? "", s.createdAt.toISOString(), s.unsubscribedAt?.toISOString() ?? ""]),
  ]);
}

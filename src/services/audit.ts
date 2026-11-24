import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";

export interface ActivityInput {
  user: Pick<SessionUser, "id"> | null;
  action: string; // e.g. "product.update"
  entityType: string; // e.g. "Product"
  entityId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/** Record an important admin operation. Never throws — auditing must not break the operation itself. */
export async function logActivity(input: ActivityInput) {
  try {
    await prisma.adminActivityLog.create({
      data: {
        userId: input.user?.id ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary?.slice(0, 500),
        metadata: (input.metadata ?? undefined) as object | undefined,
        ipAddress: input.ip,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write activity log", error);
  }
}

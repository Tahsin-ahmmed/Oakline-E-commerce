import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/auth/crypto";
import { SUPER_ADMIN_ROLE } from "@/lib/permissions";

export const SESSION_COOKIE = "oak_session";
const SESSION_TTL_DAYS = 30;
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  sessionId: string;
  email: string;
  name: string;
  phone: string | null;
  isStaff: boolean;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function requestMeta() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  return { ipAddress: ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

/** Create a DB-backed session and set the HTTP-only cookie. Call from route handlers / server actions only. */
export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const meta = await requestMeta();
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
  });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

/** Revoke every session for a user (password change, block, staff removal). */
export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}

async function loadSessionUser(token: string): Promise<SessionUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        },
      },
    },
  });
  if (!session) return null;
  const now = new Date();
  if (session.expiresAt <= now || session.user.status === "BLOCKED" || session.user.deletedAt) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } }).catch(() => undefined);
  }
  const u = session.user;
  const roles = u.isStaff ? u.roles.map((r) => r.role.key) : [];
  const permissions = u.isStaff
    ? [...new Set(u.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)))]
    : [];
  return {
    id: u.id,
    sessionId: session.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    isStaff: u.isStaff && roles.length > 0,
    emailVerified: Boolean(u.emailVerifiedAt),
    roles,
    permissions,
  };
}

/** The signed-in user for this request (memoized per request), or null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  return loadSessionUser(token);
});

export function isSuperAdmin(user: SessionUser | null) {
  return Boolean(user?.roles.includes(SUPER_ADMIN_ROLE));
}

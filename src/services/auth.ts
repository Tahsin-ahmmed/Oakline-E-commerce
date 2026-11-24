import "server-only";
import { prisma } from "@/lib/prisma";
import { generateToken, getDummyPasswordHash, hashPassword, hashToken, verifyPassword } from "@/lib/auth/crypto";
import { createSession, revokeUserSessions } from "@/lib/auth/session";
import { badRequest, conflict, forbidden, unauthorized } from "@/lib/errors";
import { appUrl } from "@/lib/env";
import { sendMail } from "@/lib/email/mailer";
import { resetPasswordTemplate, verifyEmailTemplate } from "@/lib/email/templates";
import { getSettings } from "@/services/settings";
import { mergeGuestCartIntoUser } from "@/services/cart";
import type { RegisterInput } from "@/lib/validations/auth";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

async function issueToken(userId: string, type: "EMAIL_VERIFICATION" | "PASSWORD_RESET", ttlMs: number) {
  const token = generateToken();
  await prisma.$transaction([
    // Only the newest token of each type is valid.
    prisma.verificationToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.verificationToken.create({
      data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
    }),
  ]);
  return token;
}

export async function sendVerificationEmail(user: { id: string; name: string; email: string }) {
  const token = await issueToken(user.id, "EMAIL_VERIFICATION", VERIFY_TTL_MS);
  const { general } = await getSettings();
  const mail = verifyEmailTemplate({
    siteName: general.siteName,
    name: user.name,
    url: appUrl(`/verify-email?token=${encodeURIComponent(token)}`),
  });
  await sendMail({ to: user.email, ...mail });
}

export async function registerCustomer(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("An account with this email already exists. Try signing in instead.");
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      phone: input.phone || null,
      passwordHash: await hashPassword(input.password),
      marketingOptIn: Boolean(input.marketingOptIn),
    },
  });
  if (input.marketingOptIn) {
    await prisma.newsletterSubscriber
      .upsert({
        where: { email: user.email },
        create: { email: user.email, source: "registration" },
        update: { status: "SUBSCRIBED", unsubscribedAt: null },
      })
      .catch(() => undefined);
  }
  await createSession(user.id);
  await mergeGuestCartIntoUser(user.id);
  await sendVerificationEmail(user);
  return { id: user.id, name: user.name, email: user.email };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    await verifyPassword(password, await getDummyPasswordHash()); // constant-ish timing
    throw unauthorized("Incorrect email or password.");
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw unauthorized("Incorrect email or password.");
  if (user.status === "BLOCKED") throw forbidden("This account has been suspended. Please contact support.");
  await createSession(user.id);
  await mergeGuestCartIntoUser(user.id);
  return { id: user.id, name: user.name, email: user.email, isStaff: user.isStaff };
}

/** Always resolves (no account enumeration). Sends a reset link when the account exists. */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt || user.status === "BLOCKED") return;
  const token = await issueToken(user.id, "PASSWORD_RESET", RESET_TTL_MS);
  const { general } = await getSettings();
  const mail = resetPasswordTemplate({
    siteName: general.siteName,
    name: user.name,
    url: appUrl(`/reset-password?token=${encodeURIComponent(token)}`),
  });
  await sendMail({ to: user.email, ...mail });
}

async function consumeToken(token: string, type: "EMAIL_VERIFICATION" | "PASSWORD_RESET") {
  const record = await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt <= new Date()) {
    throw badRequest("This link is invalid or has expired. Please request a new one.");
  }
  // Mark used atomically so the same link cannot be replayed concurrently.
  const updated = await prisma.verificationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (updated.count !== 1) throw badRequest("This link has already been used.");
  return record;
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await consumeToken(token, "PASSWORD_RESET");
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(newPassword), emailVerifiedAt: new Date() },
  });
  await revokeUserSessions(record.userId);
}

export async function verifyEmail(token: string) {
  const record = await consumeToken(token, "EMAIL_VERIFICATION");
  await prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
}

export async function changePassword(userId: string, sessionId: string, current: string, next: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) {
    throw badRequest("Your current password is incorrect.", { currentPassword: ["Incorrect password"] });
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  // Sign out every other device.
  await revokeUserSessions(userId, sessionId);
}

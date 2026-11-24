import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/crypto";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth/session";
import { changePassword, login, registerCustomer, requestPasswordReset, resetPassword, verifyEmail } from "@/services/auth";
import { cookieJar } from "./setup";
import { createCustomer, createStaff, resetDb, signOutLocal } from "./helpers";

describe("authentication", () => {
  beforeEach(resetDb);

  it("registers a customer, hashes the password and starts a session", async () => {
    const res = await registerCustomer({ name: "Nusrat Jahan", email: "nusrat@example.com", password: "Secret123" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.id } });
    expect(user.passwordHash).not.toContain("Secret123");
    expect(user.passwordHash.startsWith("$2")).toBe(true);
    expect(cookieJar.get(SESSION_COOKIE)).toBeTruthy();
    // The cookie holds the raw token; only its keyed hash is stored.
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.tokenHash).toBe(hashToken(cookieJar.get(SESSION_COOKIE)!));
    expect((await getCurrentUser())?.email).toBe("nusrat@example.com");
    // A verification token was issued.
    expect(await prisma.verificationToken.count({ where: { userId: user.id, type: "EMAIL_VERIFICATION" } })).toBe(1);
  });

  it("rejects duplicate registrations", async () => {
    await registerCustomer({ name: "A Person", email: "dup@example.com", password: "Secret123" });
    signOutLocal();
    await expect(registerCustomer({ name: "B Person", email: "dup@example.com", password: "Secret123" })).rejects.toThrow(/already exists/);
  });

  it("rejects wrong passwords and unknown emails with the same message", async () => {
    const { user } = await createCustomer("c@example.com", "Password123");
    await expect(login(user.email, "wrong-password1")).rejects.toThrow("Incorrect email or password.");
    await expect(login("nobody@example.com", "Password123")).rejects.toThrow("Incorrect email or password.");
    expect(cookieJar.size).toBe(0);
  });

  it("blocks suspended accounts and drops their sessions", async () => {
    const { user, password } = await createCustomer();
    await login(user.email, password);
    expect(await getCurrentUser()).not.toBeNull();
    await prisma.user.update({ where: { id: user.id }, data: { status: "BLOCKED" } });
    // React `cache` does not memoize outside a request, so this reloads the session.
    expect(await getCurrentUser()).toBeNull();
    await expect(login(user.email, password)).rejects.toThrow(/suspended/);
  });

  it("loads staff roles and permissions; customers get none", async () => {
    const { user, password } = await createStaff("ORDER_MANAGER");
    await login(user.email, password);
    const me = await getCurrentUser();
    expect(me?.isStaff).toBe(true);
    expect(me?.permissions).toContain("orders.manage");
    expect(me?.permissions).not.toContain("settings.manage");
    signOutLocal();
    const c = await createCustomer();
    await login(c.user.email, c.password);
    expect((await getCurrentUser())?.permissions).toEqual([]);
  });

  it("resets a password with a single-use token and revokes sessions", async () => {
    const { user, password } = await createCustomer();
    await login(user.email, password);
    const before = await prisma.session.count({ where: { userId: user.id } });
    expect(before).toBe(1);

    await requestPasswordReset(user.email);
    // Recover the raw token by issuing one we control (the emailed one is only logged).
    const token = "known-test-token-value-1234567890";
    await prisma.verificationToken.updateMany({
      where: { userId: user.id, type: "PASSWORD_RESET" },
      data: { tokenHash: hashToken(token) },
    });
    await resetPassword(token, "BrandNew123");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await expect(resetPassword(token, "Another123")).rejects.toThrow(/invalid or has expired/);
    signOutLocal();
    await expect(login(user.email, "BrandNew123")).resolves.toMatchObject({ email: user.email });
  });

  it("does not reveal whether an email exists on password reset", async () => {
    await expect(requestPasswordReset("ghost@example.com")).resolves.toBeUndefined();
  });

  it("rejects expired verification tokens", async () => {
    const { user } = await createCustomer();
    await prisma.verificationToken.create({
      data: { userId: user.id, type: "EMAIL_VERIFICATION", tokenHash: hashToken("expired-token-abcdefghijkl"), expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(verifyEmail("expired-token-abcdefghijkl")).rejects.toThrow(/expired/);
  });

  it("changes the password only with the correct current password and signs out other devices", async () => {
    const { user, password } = await createCustomer();
    await login(user.email, password);
    const other = await prisma.session.create({ data: { userId: user.id, tokenHash: "other-device", expiresAt: new Date(Date.now() + 86_400_000) } });
    const me = (await getCurrentUser())!;
    await expect(changePassword(user.id, me.sessionId, "wrong", "Newpass123")).rejects.toThrow(/incorrect/);
    await changePassword(user.id, me.sessionId, password, "Newpass123");
    expect(await prisma.session.findUnique({ where: { id: other.id } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: me.sessionId } })).not.toBeNull();
  });
});

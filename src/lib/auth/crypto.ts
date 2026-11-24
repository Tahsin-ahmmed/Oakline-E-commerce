import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

let dummyHash: Promise<string> | null = null;
/** A real bcrypt hash of a random value, used to keep login timing constant when the email does not exist. */
export function getDummyPasswordHash() {
  dummyHash ??= bcrypt.hash(randomBytes(16).toString("hex"), BCRYPT_COST);
  return dummyHash;
}

/** Cryptographically random URL-safe token. */
export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Tokens are stored as keyed hashes (HMAC-SHA256 with AUTH_SECRET) so a database leak cannot be replayed. */
export function hashToken(token: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

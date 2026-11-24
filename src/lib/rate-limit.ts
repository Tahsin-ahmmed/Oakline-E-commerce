import "server-only";
import { prisma } from "@/lib/prisma";
import { tooManyRequests } from "@/lib/errors";

export interface RateLimitRule {
  /** Logical bucket name, e.g. "login". */
  name: string;
  limit: number;
  windowSeconds: number;
}

/**
 * Fixed-window rate limiter backed by PostgreSQL so it works across multiple app instances.
 * The upsert is a single atomic statement.
 */
export async function consumeRateLimit(rule: RateLimitRule, identifier: string) {
  const key = `${rule.name}:${identifier}`.slice(0, 200);
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${rule.windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  const remaining = Math.max(0, rule.limit - row.count);
  return { allowed: row.count <= rule.limit, remaining, resetAt: row.resetAt };
}

export async function enforceRateLimit(rule: RateLimitRule, identifier: string) {
  const result = await consumeRateLimit(rule, identifier);
  if (!result.allowed) throw tooManyRequests();
  return result;
}

export const RATE_LIMITS = {
  login: { name: "login", limit: 8, windowSeconds: 15 * 60 },
  register: { name: "register", limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { name: "password-reset", limit: 5, windowSeconds: 60 * 60 },
  checkout: { name: "checkout", limit: 15, windowSeconds: 10 * 60 },
  coupon: { name: "coupon", limit: 30, windowSeconds: 10 * 60 },
  contact: { name: "contact", limit: 5, windowSeconds: 60 * 60 },
  newsletter: { name: "newsletter", limit: 5, windowSeconds: 60 * 60 },
  review: { name: "review", limit: 10, windowSeconds: 60 * 60 },
  upload: { name: "upload", limit: 60, windowSeconds: 10 * 60 },
  orderLookup: { name: "order-lookup", limit: 15, windowSeconds: 15 * 60 },
} satisfies Record<string, RateLimitRule>;

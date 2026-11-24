import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AppError, forbidden, unauthorized, validationError, badRequest } from "@/lib/errors";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { enforceRateLimit, type RateLimitRule } from "@/lib/rate-limit";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data }, init);
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json<ApiFailure>({ success: false, error: { code, message, details } }, { status });
}

/** Convert Zod issues into a { field: [messages] } map for form display. */
export function zodDetails(error: ZodError) {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) return fail(error.status, error.code, error.message, error.details);
  if (error instanceof ZodError) {
    return fail(422, "VALIDATION_ERROR", "Please check the highlighted fields.", zodDetails(error));
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | string | undefined) ?? "field";
      return fail(409, "CONFLICT", `A record with this ${Array.isArray(target) ? target.join(", ") : target} already exists.`);
    }
    if (error.code === "P2025") return fail(404, "NOT_FOUND", "The requested record was not found.");
    if (error.code === "P2003") {
      return fail(409, "CONFLICT", "This record is referenced by other data and cannot be changed this way.");
    }
  }
  // Never leak internals to clients; log for operators.
  console.error("[api] Unhandled error:", error);
  return fail(500, "INTERNAL_ERROR", "Something went wrong on our side. Please try again.");
}

function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/**
 * CSRF defence for cookie-authenticated mutations: the Origin (or Referer) must match this host.
 * Combined with SameSite=Lax session cookies this blocks cross-site form/fetch submissions.
 */
function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) throw forbidden("Missing request origin.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Invalid request origin.");
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const allowed = new Set([host]);
  for (const configured of [process.env.AUTH_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (configured) {
      try {
        allowed.add(new URL(configured).host);
      } catch {
        /* ignore malformed config */
      }
    }
  }
  if (!allowed.has(originHost)) throw forbidden("Cross-site request blocked.");
}

export interface HandlerContext<P> {
  req: NextRequest;
  params: P;
  user: SessionUser | null;
  ip: string;
  /** Parse and validate the JSON body. */
  json<T extends ZodType>(schema: T): Promise<z.infer<T>>;
  /** Parse and validate query-string parameters. */
  query<T extends ZodType>(schema: T): z.infer<T>;
}

export interface RouteOptions {
  /** "user" = any signed-in account, "staff" = staff account (optionally with `permission`). */
  auth?: "none" | "optional" | "user" | "staff";
  permission?: PermissionKey;
  rateLimit?: RateLimitRule;
  /** Rate-limit key: by IP (default) or by user id when signed in. */
  rateLimitBy?: "ip" | "user";
  /** Skip the same-origin check (only for server-to-server webhooks with their own signature verification). */
  skipCsrf?: boolean;
}

type RouteCtx<P> = { params: Promise<P> };

/** Wrap a route handler with auth, permission, CSRF, rate limit and uniform error handling. */
export function route<P = Record<string, string>>(
  options: RouteOptions,
  handler: (ctx: HandlerContext<P>) => Promise<Response | unknown>,
) {
  return async (req: NextRequest, routeCtx: RouteCtx<P>) => {
    try {
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      if (mutating && !options.skipCsrf) assertSameOrigin(req);

      const auth = options.auth ?? "optional";
      const user = auth === "none" ? null : await getCurrentUser();
      if ((auth === "user" || auth === "staff") && !user) throw unauthorized();
      if (auth === "staff" && !user?.isStaff) throw forbidden();
      if (options.permission && !hasPermission(user, options.permission)) throw forbidden();

      const ip = clientIp(req);
      if (options.rateLimit) {
        const id = options.rateLimitBy === "user" && user ? `u:${user.id}` : `ip:${ip}`;
        await enforceRateLimit(options.rateLimit, id);
      }

      const params = (routeCtx?.params ? await routeCtx.params : {}) as P;
      const ctx: HandlerContext<P> = {
        req,
        params,
        user,
        ip,
        async json(schema) {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            throw badRequest("Request body must be valid JSON.");
          }
          const parsed = schema.safeParse(body);
          if (!parsed.success) {
            throw validationError("Please check the highlighted fields.", zodDetails(parsed.error));
          }
          return parsed.data;
        },
        query(schema) {
          const raw: Record<string, string | string[]> = {};
          req.nextUrl.searchParams.forEach((value, key) => {
            const existing = raw[key];
            if (existing === undefined) raw[key] = value;
            else raw[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
          });
          const parsed = schema.safeParse(raw);
          if (!parsed.success) throw validationError("Invalid query parameters.", zodDetails(parsed.error));
          return parsed.data;
        },
      };

      const result = await handler(ctx);
      if (result instanceof Response) return result;
      return ok(result ?? null);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

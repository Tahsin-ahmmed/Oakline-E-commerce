import "server-only";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/auth/crypto";
import { attribute, hasCampaignParams, isBot, parseUserAgent } from "@/lib/analytics/attribution";
import type { SessionUser } from "@/lib/auth/session";
import { getSettings } from "@/services/settings";

export const VISITOR_COOKIE = "ezy_vid";
export const SESSION_COOKIE = "ezy_sid";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365 * 2;

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function decodeHeader(v: string | null) {
  if (!v) return null;
  try {
    return decodeURIComponent(v).slice(0, 80);
  } catch {
    return v.slice(0, 80);
  }
}

function ownHosts(h: Headers) {
  const hosts = [h.get("x-forwarded-host"), h.get("host")];
  for (const u of [process.env.AUTH_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    try {
      if (u) hosts.push(new URL(u).host);
    } catch {
      /* ignore */
    }
  }
  return hosts.filter((x): x is string => Boolean(x)).map((x) => x.split(":")[0]);
}

export interface PageViewInput {
  path: string;
  search: string;
  referrer?: string | null;
}

/**
 * Record a page view: continue the visitor's current session or start a new one with fresh attribution.
 * Bots, staff (optional) and disabled tracking are skipped. Never throws.
 */
export async function recordPageView(input: PageViewInput, user: SessionUser | null) {
  try {
    const { tracking } = await getSettings();
    if (!tracking.analyticsEnabled) return { tracked: false };
    if (tracking.excludeStaff && user?.isStaff) return { tracked: false };

    const h = await headers();
    const ua = h.get("user-agent");
    if (isBot(ua)) return { tracked: false };

    const jar = await cookies();
    const path = (input.path || "/").split("?")[0].slice(0, 300);
    const search = input.search.startsWith("?") || !input.search ? input.search : `?${input.search}`;
    const now = new Date();

    let visitorId = jar.get(VISITOR_COOKIE)?.value;
    if (!visitorId || visitorId.length > 64) visitorId = generateToken(16);

    const sid = jar.get(SESSION_COOKIE)?.value;
    let session = sid && sid.length <= 40 ? await prisma.analyticsSession.findUnique({ where: { id: sid } }) : null;
    const expired = session && now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_MS;
    // A new campaign click mid-visit starts a new session so the ad gets credit (same rule as GA4).
    if (session && (expired || hasCampaignParams(search) || session.visitorId !== visitorId)) session = null;

    if (!session) {
      const attr = attribute({ url: `${path}${search}`, referrer: input.referrer, userAgent: ua, ownHosts: ownHosts(h) });
      const device = parseUserAgent(ua);
      session = await prisma.analyticsSession.create({
        data: {
          visitorId,
          userId: user?.id ?? null,
          landingPath: path,
          referrerHost: attr.referrerHost,
          source: attr.source,
          channel: attr.channel,
          campaign: attr.campaign,
          utmSource: attr.utmSource,
          utmMedium: attr.utmMedium,
          utmContent: attr.utmContent,
          utmTerm: attr.utmTerm,
          clickIdType: attr.clickIdType,
          country: h.get("x-vercel-ip-country")?.slice(0, 2) ?? null,
          region: decodeHeader(h.get("x-vercel-ip-country-region")),
          city: decodeHeader(h.get("x-vercel-ip-city")),
          device: device.device,
          browser: device.browser,
          os: device.os,
          pageViews: 1,
          startedAt: now,
          lastSeenAt: now,
          events: { create: { type: "page_view", path } },
        },
      });
    } else {
      await prisma.analyticsSession.update({
        where: { id: session.id },
        data: {
          lastSeenAt: now,
          pageViews: { increment: 1 },
          ...(user && !session.userId ? { userId: user.id } : {}),
          events: { create: { type: "page_view", path } },
        },
      });
    }

    jar.set(VISITOR_COOKIE, visitorId, { ...cookieBase, maxAge: VISITOR_MAX_AGE });
    jar.set(SESSION_COOKIE, session.id, { ...cookieBase, maxAge: SESSION_IDLE_MS / 1000 });
    return { tracked: true };
  } catch (error) {
    console.error("[analytics] page view not recorded", error);
    return { tracked: false };
  }
}

/** Attach a commerce event (add_to_cart, purchase) to the visitor's current session. Never throws. */
export async function trackServerEvent(
  type: "add_to_cart" | "purchase",
  data: { productId?: string; orderId?: string; value?: string | number },
) {
  try {
    const sid = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!sid || sid.length > 40) return;
    const session = await prisma.analyticsSession.findUnique({ where: { id: sid }, select: { id: true } });
    if (!session) return;
    if (type === "purchase" && data.orderId) {
      const dup = await prisma.analyticsEvent.findFirst({ where: { type: "purchase", orderId: data.orderId }, select: { id: true } });
      if (dup) return;
    }
    await prisma.analyticsEvent.create({
      data: {
        sessionId: session.id,
        type,
        productId: data.productId ?? null,
        orderId: data.orderId ?? null,
        value: data.value !== undefined ? String(data.value) : null,
      },
    });
    await prisma.analyticsSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  } catch (error) {
    console.error("[analytics] event not recorded", error);
  }
}

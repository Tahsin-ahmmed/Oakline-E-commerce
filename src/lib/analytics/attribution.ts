/**
 * Traffic attribution — pure functions (no I/O), unit tested.
 *
 * Priority (same model as Google Analytics):
 *   1. UTM parameters (utm_source / utm_medium / utm_campaign …) — what you put on ad links
 *   2. Ad click ids (fbclid → Facebook, gclid → Google Ads, ttclid → TikTok)
 *   3. Referrer host (facebook.com, google.com, chatgpt.com …)
 *   4. In-app browser signature (Facebook / Instagram apps often hide the referrer)
 *   5. Otherwise "direct"
 */

export type Channel =
  | "paid_social"
  | "organic_social"
  | "paid_search"
  | "organic_search"
  | "ai"
  | "email"
  | "referral"
  | "direct";

export const CHANNEL_LABELS: Record<Channel, string> = {
  paid_social: "Paid social",
  organic_social: "Organic social",
  paid_search: "Paid search",
  organic_search: "Organic search",
  ai: "AI assistants",
  email: "Email",
  referral: "Referral",
  direct: "Direct",
};

/** Display names for normalised sources. Unknown sources are shown as their hostname. */
export const SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  reddit: "Reddit",
  snapchat: "Snapchat",
  threads: "Threads",
  google: "Google",
  bing: "Bing",
  yahoo: "Yahoo",
  duckduckgo: "DuckDuckGo",
  yandex: "Yandex",
  baidu: "Baidu",
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  claude: "Claude",
  copilot: "Copilot",
  deepseek: "DeepSeek",
  email: "Email",
  direct: "Direct",
};

type Kind = "social" | "search" | "ai" | "email";

/** Hostname suffix → [source, kind]. Matched against the referrer host (and its parent domains). */
const HOSTS: [string, string, Kind][] = [
  ["facebook.com", "facebook", "social"],
  ["fb.com", "facebook", "social"],
  ["fb.me", "facebook", "social"],
  ["messenger.com", "messenger", "social"],
  ["instagram.com", "instagram", "social"],
  ["threads.net", "threads", "social"],
  ["whatsapp.com", "whatsapp", "social"],
  ["wa.me", "whatsapp", "social"],
  ["tiktok.com", "tiktok", "social"],
  ["youtube.com", "youtube", "social"],
  ["youtu.be", "youtube", "social"],
  ["t.co", "x", "social"],
  ["twitter.com", "x", "social"],
  ["x.com", "x", "social"],
  ["linkedin.com", "linkedin", "social"],
  ["lnkd.in", "linkedin", "social"],
  ["pinterest.com", "pinterest", "social"],
  ["pin.it", "pinterest", "social"],
  ["reddit.com", "reddit", "social"],
  ["snapchat.com", "snapchat", "social"],
  ["chatgpt.com", "chatgpt", "ai"],
  ["chat.openai.com", "chatgpt", "ai"],
  ["openai.com", "chatgpt", "ai"],
  ["perplexity.ai", "perplexity", "ai"],
  ["gemini.google.com", "gemini", "ai"],
  ["bard.google.com", "gemini", "ai"],
  ["claude.ai", "claude", "ai"],
  ["copilot.microsoft.com", "copilot", "ai"],
  ["chat.deepseek.com", "deepseek", "ai"],
  ["bing.com", "bing", "search"],
  ["duckduckgo.com", "duckduckgo", "search"],
  ["search.yahoo.com", "yahoo", "search"],
  ["yahoo.com", "yahoo", "search"],
  ["yandex.ru", "yandex", "search"],
  ["yandex.com", "yandex", "search"],
  ["baidu.com", "baidu", "search"],
  ["mail.google.com", "email", "email"],
  ["outlook.live.com", "email", "email"],
  ["mail.yahoo.com", "email", "email"],
];

const PAID_MEDIUMS = /^(cpc|ppc|paid|paidsocial|paid[_-]?social|paid[_-]?search|cpm|cpv|cpa|ads?|display|banner|retargeting|remarketing|sponsored)$/i;
const SOCIAL_MEDIUMS = /^(social|social[_-]?media|sm|social[_-]?network|organic[_-]?social|post|story|reel|bio|profile)$/i;

export interface AttributionInput {
  /** Full landing URL (path + query) or just the query string. */
  url: string;
  /** document.referrer as reported by the browser. */
  referrer?: string | null;
  userAgent?: string | null;
  /** This store's own host(s) — internal navigation is never treated as a referral. */
  ownHosts?: string[];
}

export interface Attribution {
  source: string;
  channel: Channel;
  campaign: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  clickIdType: "fbclid" | "gclid" | "ttclid" | null;
  referrerHost: string | null;
}

const clean = (v: string | null | undefined, max = 120) => {
  const s = (v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

function params(url: string) {
  try {
    const u = new URL(url, "https://placeholder.local");
    return u.searchParams;
  } catch {
    return new URLSearchParams();
  }
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return h || null;
  } catch {
    return null;
  }
}

function matchHost(host: string): [string, Kind] | null {
  for (const [suffix, source, kind] of HOSTS) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return [source, kind];
  }
  // google.com, google.com.bd, google.co.uk …
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return ["google", "search"];
  return null;
}

/** Normalise a free-form utm_source ("fb", "Facebook Ads", "IG") to a known source key when possible. */
export function normaliseSource(raw: string): string {
  const s = raw.trim().toLowerCase();
  const aliases: Record<string, string> = {
    fb: "facebook",
    "facebook.com": "facebook",
    meta: "facebook",
    "facebook ads": "facebook",
    facebook_ads: "facebook",
    ig: "instagram",
    "instagram.com": "instagram",
    insta: "instagram",
    "chatgpt.com": "chatgpt",
    openai: "chatgpt",
    "google.com": "google",
    adwords: "google",
    "tiktok.com": "tiktok",
    yt: "youtube",
    twitter: "x",
    newsletter: "email",
    mailchimp: "email",
  };
  if (aliases[s]) return aliases[s];
  const viaHost = matchHost(s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]);
  if (viaHost) return viaHost[0];
  return s.replace(/[^a-z0-9._-]+/g, "_").slice(0, 60) || "unknown";
}

function kindOfSource(source: string): Kind | null {
  if (["facebook", "instagram", "messenger", "whatsapp", "tiktok", "youtube", "x", "linkedin", "pinterest", "reddit", "snapchat", "threads"].includes(source)) return "social";
  if (["google", "bing", "yahoo", "duckduckgo", "yandex", "baidu"].includes(source)) return "search";
  if (["chatgpt", "perplexity", "gemini", "claude", "copilot", "deepseek"].includes(source)) return "ai";
  if (source === "email") return "email";
  return null;
}

function channelFor(kind: Kind | null, paid: boolean): Channel {
  if (kind === "social") return paid ? "paid_social" : "organic_social";
  if (kind === "search") return paid ? "paid_search" : "organic_search";
  if (kind === "ai") return "ai";
  if (kind === "email") return "email";
  return paid ? "paid_social" : "referral";
}

/** Facebook / Instagram / Messenger in-app browsers often send no referrer — recognise them by user agent. */
function inAppSource(ua: string | null | undefined): string | null {
  if (!ua) return null;
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS|\[FB/i.test(ua)) return "facebook";
  if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) return "tiktok";
  return null;
}

/** True when the URL carries campaign information that should start a new session. */
export function hasCampaignParams(url: string) {
  const p = params(url);
  return ["utm_source", "utm_medium", "utm_campaign", "fbclid", "gclid", "ttclid"].some((k) => p.has(k));
}

export function attribute(input: AttributionInput): Attribution {
  const p = params(input.url);
  const utmSource = clean(p.get("utm_source"));
  const utmMedium = clean(p.get("utm_medium"));
  const campaign = clean(p.get("utm_campaign"), 160);
  const utmContent = clean(p.get("utm_content"), 160);
  const utmTerm = clean(p.get("utm_term"));
  const clickIdType = p.has("fbclid") ? "fbclid" : p.has("gclid") ? "gclid" : p.has("ttclid") ? "ttclid" : null;

  const ownHosts = (input.ownHosts ?? []).map((h) => h.toLowerCase().replace(/^www\./, ""));
  let referrerHost = hostOf(input.referrer);
  if (referrerHost && ownHosts.includes(referrerHost)) referrerHost = null;

  const base = { campaign, utmSource, utmMedium, utmContent, utmTerm, clickIdType, referrerHost } as const;

  // 1. UTM tagging wins.
  if (utmSource || utmMedium) {
    const source = utmSource ? normaliseSource(utmSource) : referrerHost ? (matchHost(referrerHost)?.[0] ?? referrerHost) : "unknown";
    const medium = (utmMedium ?? "").toLowerCase();
    const paid = PAID_MEDIUMS.test(medium) || clickIdType === "gclid";
    let channel: Channel;
    if (/^e-?mail|newsletter$/.test(medium) || source === "email") channel = "email";
    else if (/^(organic)$/.test(medium)) channel = channelFor(kindOfSource(source) ?? "search", false);
    else if (/^referral$/.test(medium)) channel = "referral";
    else if (SOCIAL_MEDIUMS.test(medium)) channel = channelFor("social", false);
    else channel = channelFor(kindOfSource(source), paid);
    return { source, channel, ...base };
  }

  // 2. Ad click ids without UTMs.
  if (clickIdType === "gclid") return { source: "google", channel: "paid_search", ...base };
  if (clickIdType === "ttclid") return { source: "tiktok", channel: "paid_social", ...base };
  if (clickIdType === "fbclid") {
    // Meta appends fbclid to every outbound link (ads and organic posts). Without UTMs we can't tell
    // them apart, so it's attributed to the platform as organic social. Tag ads with UTMs to separate them.
    const viaRef = referrerHost ? matchHost(referrerHost)?.[0] : null;
    const source = viaRef === "instagram" || inAppSource(input.userAgent) === "instagram" ? "instagram" : "facebook";
    return { source, channel: "organic_social", ...base };
  }

  // 3. Referrer.
  if (referrerHost) {
    const match = matchHost(referrerHost);
    if (match) return { source: match[0], channel: channelFor(match[1], false), ...base };
    return { source: referrerHost.slice(0, 60), channel: "referral", ...base };
  }

  // 4. In-app browsers that hide the referrer.
  const inApp = inAppSource(input.userAgent);
  if (inApp) return { source: inApp, channel: "organic_social", ...base };

  return { source: "direct", channel: "direct", ...base };
}

// ───────────── User agent ─────────────

const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|embedly|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch|go-http-client|java\/|httpclient|scrapy|semrush|ahrefs|mj12|dotbot|petalbot|gptbot|oai-searchbot|chatgpt-user|claudebot|perplexitybot|bytespider|applebot|vercel-screenshot|playwright/i;

export function isBot(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 10) return true;
  return BOT_RE.test(ua);
}

export interface DeviceInfo {
  device: "mobile" | "tablet" | "desktop";
  browser: string | null;
  os: string | null;
}

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  const tablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s);
  const mobile = !tablet && /Mobi|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(s);
  const os = /Windows NT/i.test(s)
    ? "Windows"
    : /iPhone|iPad|iPod/i.test(s)
      ? "iOS"
      : /Android/i.test(s)
        ? "Android"
        : /Mac OS X|Macintosh/i.test(s)
          ? "macOS"
          : /CrOS/i.test(s)
            ? "ChromeOS"
            : /Linux/i.test(s)
              ? "Linux"
              : null;
  const browser = /Instagram/i.test(s)
    ? "Instagram app"
    : /FBAN|FBAV|FB_IAB/i.test(s)
      ? "Facebook app"
      : /Edg\//i.test(s)
        ? "Edge"
        : /OPR\/|Opera/i.test(s)
          ? "Opera"
          : /SamsungBrowser/i.test(s)
            ? "Samsung Internet"
            : /UCBrowser/i.test(s)
              ? "UC Browser"
              : /Firefox|FxiOS/i.test(s)
                ? "Firefox"
                : /Chrome|CriOS/i.test(s)
                  ? "Chrome"
                  : /Safari/i.test(s)
                    ? "Safari"
                    : null;
  return { device: tablet ? "tablet" : mobile ? "mobile" : "desktop", browser, os };
}

export function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source;
}

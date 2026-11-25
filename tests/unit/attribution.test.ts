import { describe, expect, it } from "vitest";
import { attribute, hasCampaignParams, isBot, normaliseSource, parseUserAgent } from "@/lib/analytics/attribution";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const FB_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]";
const IG_APP = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 Instagram 350.0.0.0";

describe("attribute", () => {
  it("uses UTM tags first — Facebook paid campaign with ad name", () => {
    const a = attribute({
      url: "/products?utm_source=facebook&utm_medium=paid_social&utm_campaign=eid_sale&utm_content=carousel_v2&fbclid=abc",
      referrer: "https://l.facebook.com/",
      userAgent: FB_APP,
    });
    expect(a).toMatchObject({ source: "facebook", channel: "paid_social", campaign: "eid_sale", utmContent: "carousel_v2", clickIdType: "fbclid" });
  });

  it("normalises common utm_source spellings", () => {
    expect(normaliseSource("FB")).toBe("facebook");
    expect(normaliseSource("IG")).toBe("instagram");
    expect(normaliseSource("chatgpt.com")).toBe("chatgpt");
    expect(normaliseSource("m.facebook.com")).toBe("facebook");
    expect(normaliseSource("My Partner Blog!")).toBe("my_partner_blog_");
  });

  it("treats cpc on a search engine as paid search", () => {
    expect(attribute({ url: "/?utm_source=google&utm_medium=cpc" }).channel).toBe("paid_search");
  });

  it("ChatGPT links (utm_source=chatgpt.com) are AI traffic", () => {
    expect(attribute({ url: "/?utm_source=chatgpt.com" })).toMatchObject({ source: "chatgpt", channel: "ai" });
  });

  it("organic social posts tagged with utm_medium=social", () => {
    expect(attribute({ url: "/?utm_source=instagram&utm_medium=social&utm_campaign=bio_link" })).toMatchObject({
      source: "instagram",
      channel: "organic_social",
    });
  });

  it("email newsletters", () => {
    expect(attribute({ url: "/?utm_source=newsletter&utm_medium=email" }).channel).toBe("email");
  });

  it("falls back to click ids", () => {
    expect(attribute({ url: "/?gclid=x" })).toMatchObject({ source: "google", channel: "paid_search", clickIdType: "gclid" });
    expect(attribute({ url: "/?ttclid=x" })).toMatchObject({ source: "tiktok", channel: "paid_social" });
    expect(attribute({ url: "/?fbclid=x", userAgent: IG_APP })).toMatchObject({ source: "instagram", channel: "organic_social" });
    expect(attribute({ url: "/?fbclid=x", referrer: "https://m.facebook.com/" })).toMatchObject({ source: "facebook" });
  });

  it("classifies referrers", () => {
    expect(attribute({ url: "/", referrer: "https://www.google.com.bd/" })).toMatchObject({ source: "google", channel: "organic_search" });
    expect(attribute({ url: "/", referrer: "https://chatgpt.com/" })).toMatchObject({ source: "chatgpt", channel: "ai" });
    expect(attribute({ url: "/", referrer: "https://www.perplexity.ai/search" })).toMatchObject({ source: "perplexity", channel: "ai" });
    expect(attribute({ url: "/", referrer: "https://l.instagram.com/" })).toMatchObject({ source: "instagram", channel: "organic_social" });
    expect(attribute({ url: "/", referrer: "https://t.co/xyz" })).toMatchObject({ source: "x" });
    expect(attribute({ url: "/", referrer: "https://dhakafashionblog.com/post" })).toMatchObject({
      source: "dhakafashionblog.com",
      channel: "referral",
    });
  });

  it("recognises Facebook/Instagram in-app browsers without a referrer", () => {
    expect(attribute({ url: "/", referrer: "", userAgent: FB_APP })).toMatchObject({ source: "facebook", channel: "organic_social" });
    expect(attribute({ url: "/", userAgent: IG_APP })).toMatchObject({ source: "instagram" });
  });

  it("is direct when nothing is known, and ignores the store's own host", () => {
    expect(attribute({ url: "/", userAgent: CHROME })).toMatchObject({ source: "direct", channel: "direct" });
    expect(attribute({ url: "/", referrer: "https://ezyza.vercel.app/cart", ownHosts: ["ezyza.vercel.app"] }).source).toBe("direct");
  });

  it("detects campaign links", () => {
    expect(hasCampaignParams("/?utm_campaign=x")).toBe(true);
    expect(hasCampaignParams("/?fbclid=1")).toBe(true);
    expect(hasCampaignParams("/products?sort=newest")).toBe(false);
  });
});

describe("user agents", () => {
  it("parses devices, browsers and operating systems", () => {
    expect(parseUserAgent(CHROME)).toEqual({ device: "desktop", browser: "Chrome", os: "Windows" });
    expect(parseUserAgent(FB_APP)).toMatchObject({ device: "mobile", browser: "Facebook app", os: "iOS" });
    expect(parseUserAgent(IG_APP)).toMatchObject({ device: "mobile", browser: "Instagram app", os: "Android" });
    expect(parseUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1").device).toBe("tablet");
  });

  it("filters bots and previews", () => {
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 GPTBot/1.0")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot(CHROME)).toBe(false);
    expect(isBot(FB_APP)).toBe(false);
  });
});

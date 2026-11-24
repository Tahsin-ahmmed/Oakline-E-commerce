import { z } from "zod";

const url = z.string().trim().max(500).optional().default("");
const money = z.coerce.number().min(0).max(10_000_000);

export const settingsSchemas = {
  general: z.object({
    siteName: z.string().trim().min(1).max(80).default("Oakline"),
    tagline: z.string().trim().max(160).default("Considered goods for everyday living"),
    logoUrl: url,
    faviconUrl: url,
    contactEmail: z.string().trim().max(120).default("hello@oakline.store"),
    phone: z.string().trim().max(40).default("+880 1700-000000"),
    address: z.string().trim().max(300).default("House 12, Road 7, Gulshan 1, Dhaka 1212"),
    currency: z.enum(["BDT", "USD", "EUR", "GBP", "INR"]).default("BDT"),
    language: z.enum(["en", "bn"]).default("en"),
  }),
  social: z.object({
    instagram: url,
    facebook: url,
    pinterest: url,
    youtube: url,
    tiktok: url,
  }),
  commerce: z.object({
    taxEnabled: z.boolean().default(false),
    taxRate: z.coerce.number().min(0).max(50).default(0),
    taxInclusive: z.boolean().default(true),
    freeShippingThreshold: money.default(5000),
    lowStockThreshold: z.coerce.number().int().min(0).max(1000).default(5),
    codEnabled: z.boolean().default(true),
    orderPrefix: z.string().trim().regex(/^[A-Z]{2,6}$/, "2–6 uppercase letters").default("OAK"),
    returnWindowDays: z.coerce.number().int().min(0).max(365).default(14),
  }),
  policies: z.object({
    shippingInfo: z.string().max(2000).default("Delivery in 1–3 days inside Dhaka and 3–5 days elsewhere in Bangladesh."),
    returnInfo: z.string().max(2000).default("Free returns within 14 days of delivery on unused items in original packaging."),
  }),
  seo: z.object({
    defaultTitle: z.string().trim().max(120).default("Oakline — Considered goods for everyday living"),
    defaultDescription: z
      .string()
      .trim()
      .max(300)
      .default("Home decor, accessories and lifestyle essentials, thoughtfully designed and made to last."),
    ogImageUrl: url,
  }),
  announcement: z.object({
    enabled: z.boolean().default(true),
    text: z.string().trim().max(160).default("Free delivery on orders over ৳5,000 · Easy 14-day returns"),
    link: z.string().trim().max(300).default("/shipping-policy"),
  }),
  newsletter: z.object({
    enabled: z.boolean().default(true),
    heading: z.string().trim().max(120).default("Letters from Oakline"),
    subheading: z
      .string()
      .trim()
      .max(300)
      .default("New arrivals, slow-living notes and members-only offers. One email a fortnight, never more."),
  }),
  maintenance: z.object({
    enabled: z.boolean().default(false),
    message: z.string().trim().max(300).default("We're refreshing the shop and will be back shortly."),
  }),
} as const;

export type SettingsGroup = keyof typeof settingsSchemas;
export type Settings = { [K in SettingsGroup]: z.infer<(typeof settingsSchemas)[K]> };

export const SETTINGS_GROUPS = Object.keys(settingsSchemas) as SettingsGroup[];

/** Groups only a Super Admin (settings.critical) may change. */
export const CRITICAL_SETTINGS_GROUPS: SettingsGroup[] = ["maintenance", "commerce"];

export function defaultSettings(): Settings {
  const out = {} as Record<string, unknown>;
  for (const g of SETTINGS_GROUPS) out[g] = settingsSchemas[g].parse({});
  return out as Settings;
}

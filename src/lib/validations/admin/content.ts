import { z } from "zod";

const opt = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const link = z
  .string()
  .trim()
  .max(300)
  .regex(/^(\/|https?:\/\/)/, "Use a path like /products or a full https:// URL")
  .optional()
  .or(z.literal(""));
const url = z.string().trim().max(500).url("Enter a valid image URL");
const dateStr = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Invalid date");
const slug = z
  .string()
  .trim()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only")
  .optional()
  .or(z.literal(""));
const sortOrder = z.number().int().min(0).max(9999);

export const bannerSchema = z
  .object({
    title: z.string().trim().min(2, "Add a title").max(120),
    subtitle: opt(300),
    eyebrow: opt(60),
    imageUrl: url,
    mobileImageUrl: url.optional().or(z.literal("")),
    ctaLabel: opt(40),
    ctaHref: link,
    placement: z.enum(["HERO", "PROMO", "SPLIT"]),
    sortOrder,
    isActive: z.boolean(),
    startsAt: dateStr,
    endsAt: dateStr,
  })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt), {
    path: ["endsAt"],
    message: "End must be after start",
  })
  .refine((v) => !v.ctaLabel || v.ctaHref, { path: ["ctaHref"], message: "Add a link for the button" });
export type BannerInput = z.infer<typeof bannerSchema>;

export const PRODUCT_SOURCES = ["featured", "trending", "best_sellers", "new_arrivals", "sale"] as const;

/** Type-specific homepage section config. */
export const sectionConfigSchemas = {
  products: z.object({ source: z.enum(PRODUCT_SOURCES), limit: z.number().int().min(2).max(24) }),
  categories: z.object({ limit: z.number().int().min(2).max(12) }),
  collections: z.object({ limit: z.number().int().min(1).max(8) }),
  story: z.object({
    eyebrow: opt(60),
    body: z.string().trim().min(10, "Write the story").max(2000),
    imageUrl: url.optional().or(z.literal("")),
    ctaLabel: opt(40),
    ctaHref: link,
  }),
  instagram: z.object({
    handle: z.string().trim().max(60).regex(/^[A-Za-z0-9._]*$/, "Handle without @").optional().or(z.literal("")),
    url: z.string().trim().max(300).url("Enter a valid URL").optional().or(z.literal("")),
    images: z.array(url).max(12),
  }),
} as const;
export type SectionConfigType = keyof typeof sectionConfigSchemas;

export const sectionUpdateSchema = z.object({
  title: z.string().trim().min(1, "Add a title").max(120),
  subtitle: opt(300),
  isActive: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type SectionUpdateInput = z.infer<typeof sectionUpdateSchema>;

export const collectionSchema = z.object({
  name: z.string().trim().min(2, "Add a name").max(80),
  slug,
  description: opt(500),
  imageUrl: url.optional().or(z.literal("")),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
  sortOrder,
  productIds: z.array(z.string().min(1).max(40)).max(200),
});
export type CollectionInput = z.infer<typeof collectionSchema>;

export const testimonialSchema = z.object({
  name: z.string().trim().min(2, "Add a name").max(80),
  location: opt(80),
  quote: z.string().trim().min(10, "Write at least 10 characters").max(600),
  rating: z.number().int().min(1).max(5),
  isActive: z.boolean(),
  sortOrder,
});
export type TestimonialInput = z.infer<typeof testimonialSchema>;

export const REORDER_ENTITIES = ["banner", "section", "collection", "testimonial"] as const;
export const reorderSchema = z.object({
  entity: z.enum(REORDER_ENTITIES),
  ids: z.array(z.string().min(1).max(40)).min(1).max(200),
});

export const POST_STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED"] as const;

export const blogPostSchema = z
  .object({
    title: z.string().trim().min(3, "Add a title").max(160),
    slug,
    excerpt: opt(400),
    content: z.string().trim().min(20, "Write some content").max(100_000),
    coverImageUrl: url.optional().or(z.literal("")),
    categoryId: z.string().max(40).optional().or(z.literal("")),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    status: z.enum(POST_STATUSES),
    publishedAt: dateStr,
    seoTitle: opt(120),
    seoDescription: opt(300),
  })
  .refine((v) => v.status !== "SCHEDULED" || Boolean(v.publishedAt), {
    path: ["publishedAt"],
    message: "Choose when to publish",
  });
export type BlogPostInput = z.infer<typeof blogPostSchema>;

export const blogCategorySchema = z.object({ name: z.string().trim().min(2, "Add a name").max(60) });

import { z } from "zod";
import { BD_LOCATIONS } from "@/lib/bd-locations";

export const email = z.string().trim().toLowerCase().max(160).email("Enter a valid email address");

export const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters")
  .regex(/[a-zA-Z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

/** Bangladeshi mobile numbers (01XXXXXXXXX, optionally +880) or general international format. */
export const phone = z
  .string()
  .trim()
  .min(6, "Enter a valid phone number")
  .max(20, "Enter a valid phone number")
  .regex(/^\+?[0-9][0-9\s-]{5,18}$/, "Enter a valid phone number");

export const personName = z.string().trim().min(2, "Enter your full name").max(80);

export const id = z.string().trim().min(1).max(40);

export const addressSchema = z
  .object({
    label: z.string().trim().max(40).optional().or(z.literal("")),
    fullName: personName,
    phone,
    line1: z.string().trim().min(3, "Enter a street address").max(160),
    line2: z.string().trim().max(160).optional().or(z.literal("")),
    area: z.string().trim().max(80).optional().or(z.literal("")),
    division: z.string().trim().min(1, "Select a division"),
    district: z.string().trim().min(1, "Select a district"),
    postalCode: z.string().trim().max(12).optional().or(z.literal("")),
    isDefault: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const districts = BD_LOCATIONS[v.division];
    if (!districts) ctx.addIssue({ code: "custom", path: ["division"], message: "Select a valid division" });
    else if (!districts.includes(v.district)) {
      ctx.addIssue({ code: "custom", path: ["district"], message: "Select a district in this division" });
    }
  });
export type AddressInput = z.infer<typeof addressSchema>;

export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Optional numeric field coming from a form: "" → undefined. */
export const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().optional(),
);

export const optionalMoney = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().min(0, "Must be 0 or more").max(100_000_000).optional(),
);

export const money = z.coerce.number().min(0, "Must be 0 or more").max(100_000_000);

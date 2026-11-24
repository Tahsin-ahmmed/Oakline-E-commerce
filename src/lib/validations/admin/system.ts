import { z } from "zod";
import { BD_DISTRICTS, BD_DIVISIONS } from "@/lib/bd-locations";
import { ALL_PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { email, personName } from "@/lib/validations/common";

// ───────────── Dashboard ─────────────

export const DASHBOARD_RANGES = ["today", "7d", "30d", "month", "year", "custom"] as const;
export type DashboardRangeKey = (typeof DASHBOARD_RANGES)[number];

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const dashboardQuerySchema = z.object({
  range: z.enum(DASHBOARD_RANGES).catch("30d").default("30d"),
  from: ymd.optional().catch(undefined),
  to: ymd.optional().catch(undefined),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

// ───────────── Shipping ─────────────

const money = z.coerce.number().min(0, "Must be 0 or more").max(10_000_000);

export const shippingZoneSchema = z.object({
  name: z.string().trim().min(2, "Name the zone").max(80),
  divisions: z.array(z.string().refine((d) => BD_DIVISIONS.includes(d), "Unknown division")).max(8).default([]),
  districts: z.array(z.string().refine((d) => BD_DISTRICTS.includes(d), "Unknown district")).max(64).default([]),
  areas: z
    .array(z.string().trim().min(1).max(80))
    .max(200)
    .default([])
    .transform((a) => [...new Set(a.map((s) => s.trim()).filter(Boolean))]),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});
export type ShippingZoneInput = z.infer<typeof shippingZoneSchema>;

export const shippingMethodSchema = z
  .object({
    zoneId: z.string().min(1).max(40),
    name: z.string().trim().min(2, "Name the method").max(80),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    fee: money,
    freeShippingThreshold: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : v),
      money.nullable(),
    ),
    minDays: z.coerce.number().int().min(0).max(60),
    maxDays: z.coerce.number().int().min(0).max(60),
    codAvailable: z.boolean().default(true),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .refine((v) => v.maxDays >= v.minDays, { path: ["maxDays"], message: "Must be ≥ minimum days" });
export type ShippingMethodInput = z.infer<typeof shippingMethodSchema>;

export const shippingTestSchema = z.object({
  division: z.string().min(1).max(60),
  district: z.string().min(1).max(60),
  area: z.string().trim().max(80).optional(),
  subtotal: z.coerce.number().min(0).max(10_000_000).default(0),
});

// ───────────── Staff & roles ─────────────

export const staffPassword = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .regex(/[a-zA-Z]/, "Include a letter")
  .regex(/[0-9]/, "Include a number");

export const createStaffSchema = z.object({
  name: personName,
  email,
  password: staffPassword,
  roleIds: z.array(z.string().min(1).max(40)).min(1, "Assign at least one role").max(20),
});

export const updateStaffSchema = z.object({
  name: personName.optional(),
  roleIds: z.array(z.string().min(1).max(40)).min(1, "Assign at least one role").max(20).optional(),
  status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
});

export const resetStaffPasswordSchema = z.object({ password: staffPassword });

const permissionKey = z.string().refine((k): k is PermissionKey => (ALL_PERMISSIONS as string[]).includes(k), "Unknown permission");

export const roleSchema = z.object({
  name: z.string().trim().min(2, "Name the role").max(60),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  permissions: z.array(permissionKey).max(ALL_PERMISSIONS.length).default([]),
});

export const roleUpdateSchema = roleSchema.partial();

// ───────────── Activity ─────────────

export const activityQuerySchema = z.object({
  userId: z.string().max(40).optional(),
  entityType: z.string().max(60).optional(),
  q: z.string().trim().max(80).optional(),
  from: ymd.optional().catch(undefined),
  to: ymd.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(25).default(25),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;

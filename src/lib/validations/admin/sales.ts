import { z } from "zod";
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/order-status";
import { email, personName, phone } from "@/lib/validations/common";

// ───────────── Orders ─────────────

export const orderListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(ORDER_STATUSES).optional().catch(undefined),
  payment: z.enum(PAYMENT_STATUSES).optional().catch(undefined),
  method: z.enum(PAYMENT_METHODS).optional().catch(undefined),
  from: z.string().max(30).optional(),
  to: z.string().max(30).optional(),
  sort: z.enum(["newest", "oldest", "total_desc", "total_asc"]).catch("newest").default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
});
export type OrderListQuery = z.infer<typeof orderListQuery>;

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  trackingNumber: z.string().trim().max(80).optional().or(z.literal("")),
  courier: z.string().trim().max(80).optional().or(z.literal("")),
  notifyCustomer: z.boolean().default(true),
});
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;

export const bulkOrderStatusSchema = z.object({
  ids: z.array(z.string().min(1).max(40)).min(1, "Select at least one order").max(100),
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  notifyCustomer: z.boolean().default(true),
});

export const paymentStatusSchema = z.object({
  status: z.enum(["UNPAID", "PENDING", "PAID", "FAILED", "CANCELLED"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export const orderNoteSchema = z.object({
  body: z.string().trim().min(1, "Write a note").max(2000),
});

export const refundSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0").max(100_000_000),
  reason: z.string().trim().min(3, "Give a reason").max(300),
  restock: z.boolean().default(false),
});

// ───────────── Returns ─────────────

export const returnActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("reject"), note: z.string().trim().min(3, "Explain why").max(500) }),
  z.object({ action: z.literal("receive"), note: z.string().trim().max(500).optional() }),
  z.object({
    action: z.literal("refund"),
    amount: z.coerce.number().positive("Amount must be greater than 0").max(100_000_000),
    restock: z.boolean().default(false),
    note: z.string().trim().max(500).optional(),
  }),
]);
export type ReturnActionInput = z.infer<typeof returnActionSchema>;

// ───────────── Customers ─────────────

export const customerUpdateSchema = z.object({
  name: personName,
  email,
  phone: phone.optional().or(z.literal("")),
  marketingOptIn: z.boolean().default(false),
});
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

export const customerStatusSchema = z.object({ status: z.enum(["ACTIVE", "BLOCKED"]) });

// ───────────── Coupons ─────────────

const optionalPositive = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().min(0).max(100_000_000).nullable(),
);
const optionalInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().int().min(1).max(1_000_000).nullable(),
);
const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.date().nullable(),
);

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "At least 3 characters")
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, - or _ only"),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    type: z.enum(["PERCENTAGE", "FIXED", "FREE_SHIPPING"]),
    value: z.coerce.number().min(0).max(100_000_000).default(0),
    minPurchase: optionalPositive,
    maxDiscount: optionalPositive,
    startsAt: optionalDate,
    expiresAt: optionalDate,
    usageLimit: optionalInt,
    perCustomerLimit: optionalInt,
    isActive: z.boolean().default(true),
    categoryIds: z.array(z.string().min(1).max(40)).max(100).default([]),
    productIds: z.array(z.string().min(1).max(40)).max(500).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.type === "PERCENTAGE" && (v.value < 1 || v.value > 100)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Percentage must be between 1 and 100" });
    }
    if (v.type === "FIXED" && v.value <= 0) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Enter a discount amount" });
    }
    if (v.startsAt && v.expiresAt && v.expiresAt <= v.startsAt) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Expiry must be after the start date" });
    }
  });
export type CouponInput = z.infer<typeof couponSchema>;

// ───────────── Reviews ─────────────

export const reviewUpdateSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  adminReply: z.string().trim().max(2000).nullable().optional(),
});

export const reviewBulkSchema = z.object({
  ids: z.array(z.string().min(1).max(40)).min(1).max(200),
  action: z.enum(["approve", "reject", "delete"]),
});

// ───────────── Messages ─────────────

export const contactStatusSchema = z.object({ status: z.enum(["NEW", "READ", "REPLIED", "ARCHIVED"]) });
export const subscriberStatusSchema = z.object({ status: z.enum(["SUBSCRIBED", "UNSUBSCRIBED"]) });

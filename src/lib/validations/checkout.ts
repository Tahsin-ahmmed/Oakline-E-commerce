import { z } from "zod";
import { addressSchema, email, personName, phone } from "@/lib/validations/common";
import { PAYMENT_METHODS } from "@/lib/order-status";

export const cartAddSchema = z.object({
  productId: z.string().min(1).max(40),
  variantId: z.string().min(1).max(40).optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(99),
});

export const cartUpdateSchema = z.object({
  itemId: z.string().min(1).max(40),
  quantity: z.coerce.number().int().min(0).max(99),
});

export const couponApplySchema = z.object({
  code: z.string().trim().toUpperCase().min(2, "Enter a coupon code").max(40),
});

export const shippingQuoteSchema = z.object({
  division: z.string().min(1),
  district: z.string().min(1),
  area: z.string().optional(),
});

export const checkoutSchema = z.object({
  idempotencyKey: z.string().uuid("Invalid checkout session"),
  customer: z.object({
    name: personName,
    email,
    phone,
  }),
  shippingAddress: addressSchema,
  /** When signed in, optionally store the address in the address book. */
  saveAddress: z.boolean().optional(),
  shippingMethodId: z.string().min(1, "Choose a delivery method").max(40),
  paymentMethod: z.enum(PAYMENT_METHODS),
  couponCode: z.string().trim().toUpperCase().max(40).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  acceptTerms: z.literal(true, { message: "Please accept the terms to continue" }),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const orderLookupSchema = z.object({
  orderNumber: z.string().trim().toUpperCase().min(4).max(40),
  email,
});

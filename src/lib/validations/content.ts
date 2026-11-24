import { z } from "zod";
import { email, personName } from "@/lib/validations/common";

export const contactSchema = z.object({
  name: personName,
  email,
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  subject: z.string().trim().min(3, "Add a subject").max(120),
  message: z.string().trim().min(10, "Please write at least 10 characters").max(3000),
  /** Honeypot field — real users never fill it. */
  website: z.string().max(0).optional().or(z.literal("")),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const newsletterSchema = z.object({ email, source: z.string().max(40).optional() });

export const reviewSchema = z.object({
  productId: z.string().min(1).max(40),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10, "Please write at least 10 characters").max(3000),
});

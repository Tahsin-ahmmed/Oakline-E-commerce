import "server-only";
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: optional,
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,
  CLOUDINARY_UPLOAD_FOLDER: z.string().default("oakline"),
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optional,
  STRIPE_CURRENCY: z.string().default("bdt"),
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  EMAIL_FROM: z.string().default("Oakline <no-reply@example.com>"),
  ADMIN_NOTIFICATION_EMAIL: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated server environment. Throws a descriptive error on misconfiguration. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export const integrations = {
  cloudinary: () => {
    const e = env();
    return Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET);
  },
  stripe: () => Boolean(env().STRIPE_SECRET_KEY),
  stripeWebhook: () => Boolean(env().STRIPE_SECRET_KEY && env().STRIPE_WEBHOOK_SECRET),
  smtp: () => Boolean(env().SMTP_HOST),
};

export function appUrl(path = "") {
  const base = (env().AUTH_URL ?? env().NEXT_PUBLIC_APP_URL).replace(/\/$/, "");
  return `${base}${path}`;
}

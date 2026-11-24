import "dotenv/config";
import { vi } from "vitest";

// Point every service at the disposable test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-1234";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
// Keep external integrations off in tests: no SMTP/Stripe/Cloudinary calls.
for (const key of ["SMTP_HOST", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "CLOUDINARY_CLOUD_NAME", "ADMIN_NOTIFICATION_EMAIL"]) {
  delete process.env[key];
}

/** In-memory cookie jar standing in for the browser between service calls. */
export const cookieJar = new Map<string, string>();
export const requestHeaders = new Headers({ "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" });

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
    has: (name: string) => cookieJar.has(name),
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
  }),
  headers: async () => requestHeaders,
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
  updateTag: () => undefined,
}));

// Silence dev-mode email logging in test output.
vi.spyOn(console, "info").mockImplementation(() => undefined);

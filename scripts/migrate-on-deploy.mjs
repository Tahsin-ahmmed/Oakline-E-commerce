/**
 * Applies pending Prisma migrations during the Vercel *production* build, so a push to `main`
 * updates frontend, backend and database together.
 *
 * - Runs only when VERCEL_ENV === "production" (never on preview deployments or local builds).
 * - Uses DIRECT_URL (Neon's non-pooled connection); migrations don't work through a pooler.
 * - `prisma migrate deploy` only applies committed migrations and never resets data.
 */
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
if (env !== "production") {
  console.log(`[migrate] Skipping migrations (VERCEL_ENV=${env ?? "unset"}).`);
  process.exit(0);
}
if (!process.env.DIRECT_URL) {
  console.warn("[migrate] DIRECT_URL is not set — skipping migrations. Add Neon's non-pooled connection string as DIRECT_URL in Vercel.");
  process.exit(0);
}

console.log("[migrate] Applying pending migrations to the production database…");
// Neon's free tier scales to zero, so the first connection can time out while it wakes up — retry.
const attempts = 3;
for (let i = 1; i <= attempts; i++) {
  try {
    execSync("npx prisma migrate deploy", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: process.env.DIRECT_URL },
    });
    console.log("[migrate] Done.");
    process.exit(0);
  } catch (error) {
    if (i === attempts) {
      console.error("[migrate] Migrations failed — stopping the build so the live site keeps the previous version.");
      throw error;
    }
    console.warn(`[migrate] Attempt ${i} failed, retrying in 5s…`);
    execSync(process.platform === "win32" ? "ping -n 6 127.0.0.1 > NUL" : "sleep 5");
  }
}

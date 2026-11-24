/**
 * Create or reset a Super Admin account.
 *
 *   npm run admin:create -- --email owner@example.com --password "a-long-passphrase" --name "Owner"
 *
 * Falls back to SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME when flags are omitted.
 * Resetting an existing account replaces its password and signs it out everywhere.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedRbac, upsertSuperAdmin } from "../prisma/seed/rbac";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email") ?? process.env.SEED_ADMIN_EMAIL;
  const password = arg("password") ?? process.env.SEED_ADMIN_PASSWORD;
  const name = arg("name") ?? process.env.SEED_ADMIN_NAME ?? "Store Owner";
  if (!email || !password) {
    console.error("Provide --email and --password (or SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env).");
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    await seedRbac(prisma);
    const user = await upsertSuperAdmin(prisma, { email, password, name });
    console.log(`✓ Super Admin ready: ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

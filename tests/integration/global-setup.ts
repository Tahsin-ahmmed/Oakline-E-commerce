import { execSync } from "node:child_process";
import "dotenv/config";

/**
 * Applies migrations to TEST_DATABASE_URL before the integration suite.
 * The test database is wiped by each test file — never point it at real data.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Create an empty database for tests and set TEST_DATABASE_URL in .env (it will be wiped).",
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must be different from DATABASE_URL — the test suite deletes all data.");
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}

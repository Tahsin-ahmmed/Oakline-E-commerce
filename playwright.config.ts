import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a seeded database (`npm run db:seed`).
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e   → test an already-running server
 *   npm run test:e2e                                      → builds nothing; starts `next dev` on port 3200
 * Credentials come from env: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (defaults to SEED_ADMIN_*).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3200";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1366, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npx next dev -p 3200",
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: true,
      },
});

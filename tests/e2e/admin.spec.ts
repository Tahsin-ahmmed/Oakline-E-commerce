import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, chooseOption, signIn } from "./helpers";

test.describe("Admin", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (or SEED_ADMIN_*) to run admin tests");

  test.beforeEach(async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD, "/admin");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("dashboard shows database-derived analytics", async ({ page }) => {
    await expect(page.getByText(/total revenue|revenue/i).first()).toBeVisible();
    await expect(page.getByText(/recent orders/i).first()).toBeVisible();
    await page.goto("/admin?range=year");
    await expect(page.getByText(/OAK-/).first()).toBeVisible();
  });

  test("creates a product that appears on the storefront", async ({ page }) => {
    const name = `E2E Linen Tray ${Date.now()}`;
    await page.goto("/admin/products/new");
    await page.locator("#name").fill(name);
    await page.locator("#sku").fill(`E2E-${Date.now()}`);
    await page.locator("#shortDescription").fill("A woven tray created by the end-to-end suite.");
    await page.locator("#price").fill("1450");
    await page.locator("#simpleStock").fill("12");
    await chooseOption(page, "Primary category", "Storage");
    await chooseOption(page, "Visibility", "Active");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/(?!new)[a-z0-9]+/, { timeout: 30_000 });
    const productId = new URL(page.url()).pathname.split("/").pop()!;

    await page.goto(`/search?q=${encodeURIComponent(name)}`);
    await expect(page.getByText(name).first()).toBeVisible();

    // The new product is listed in the admin too.
    await page.goto(`/admin/products?q=${encodeURIComponent(name)}`);
    await expect(page.getByText(name).first()).toBeVisible();

    // Clean up (soft delete) so the suite leaves no visible test data in the store.
    const origin = new URL(page.url()).origin;
    const res = await page.request.delete(`/api/admin/products/${productId}`, { headers: { origin } });
    expect(res.ok()).toBe(true);
    await page.goto(`/search?q=${encodeURIComponent(name)}`);
    await expect(page.getByTestId("product-card")).toHaveCount(0);
  });

  test("updates an order's status and the history records it", async ({ page }) => {
    await page.goto("/admin/orders?status=PENDING");
    const firstOrder = page.getByRole("link", { name: /^OAK-/ }).first();
    await expect(firstOrder).toBeVisible();
    await firstOrder.click();
    await expect(page).toHaveURL(/\/admin\/orders\/[a-z0-9]+$/);
    await page.getByRole("button", { name: /update status/i }).click();
    await chooseOption(page, "New status", "Confirmed");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/order marked confirmed/i)).toBeVisible();
    await expect(page.getByText("Confirmed").first()).toBeVisible();
  });

  test("customers cannot open the admin", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page, "ayesha@example.com", "Customer#2026");
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/);
    await ctx.close();
  });
});

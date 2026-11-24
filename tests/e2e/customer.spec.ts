import { expect, test } from "@playwright/test";
import { addSimpleProductToBag, chooseOption, signIn, uniqueEmail } from "./helpers";

test.describe("Customer account", () => {
  test("registers, signs out, and signs back in", async ({ page }) => {
    const email = uniqueEmail("e2e.customer");
    const password = "Secret#2026x";
    await page.goto("/register");
    await page.locator("#name").fill("Playwright Customer");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByText(/Playwright/).first()).toBeVisible();

    // Sign out from the header account menu.
    await page.goto("/");
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    await signIn(page, email, password);
    await expect(page).toHaveURL(/\/account/);
  });

  test("rejects a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill("nobody.here@example.com");
    await page.locator("#password").fill("wrong-password1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("protects account pages", async ({ page }) => {
    await page.goto("/account/orders");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});

test.describe("Checkout and tracking", () => {
  test("guest checks out with Cash on Delivery and tracks the order", async ({ page }) => {
    const email = uniqueEmail("e2e.guest");
    await addSimpleProductToBag(page);
    await page.goto("/checkout");

    await page.locator("#customer-name").fill("Guest Buyer");
    await page.locator("#customer-phone").fill("01712345678");
    await page.locator("#customer-email").fill(email);

    // Shipping address
    await page.locator("#ship-fullName").fill("Guest Buyer");
    await page.locator("#ship-phone").fill("01712345678");
    await page.locator("#ship-line1").fill("House 7, Road 11");
    await page.locator("#ship-area").fill("Banani");
    await chooseOption(page, "Division", "Dhaka");
    await chooseOption(page, "District", "Dhaka");

    // Delivery options are quoted by the server for the address.
    const delivery = page.getByRole("radiogroup", { name: "Delivery method" });
    await expect(delivery.getByRole("radio").first()).toBeVisible();
    await delivery.getByRole("radio").first().check();
    await page.getByRole("radiogroup", { name: "Payment method" }).getByRole("radio").first().check();
    await page.getByText(/I agree to the/).click();

    await page.getByTestId("place-order").click();
    await expect(page).toHaveURL(/\/checkout\/success\?order=/, { timeout: 30_000 });
    const orderNumber = new URL(page.url()).searchParams.get("order")!;
    expect(orderNumber).toMatch(/^[A-Z]{2,6}-\d{6}-[A-Z0-9]{5}$/);
    await expect(page.getByText(orderNumber).first()).toBeVisible();

    // The bag is empty after ordering.
    await expect(page.getByTestId("cart-count")).toHaveCount(0);

    // Guest order tracking.
    await page.goto(`/track-order?order=${orderNumber}&email=${encodeURIComponent(email)}`);
    await expect(page.getByText(/pending|order placed/i).first()).toBeVisible();
  });

  test("checkout validates required fields", async ({ page }) => {
    await addSimpleProductToBag(page);
    await page.goto("/checkout");
    await page.getByText(/I agree to the/).click();
    const place = page.getByTestId("place-order");
    if (await place.isEnabled()) {
      await place.click();
      await expect(page.getByText(/enter your full name|enter a valid/i).first()).toBeVisible();
    }
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test("tracking rejects a mismatched email", async ({ page }) => {
    await page.goto("/track-order");
    await page.getByLabel(/order number/i).fill("OAK-000000-AAAAA");
    await page.getByLabel("Email used at checkout").fill("someone@example.com");
    await page.getByRole("button", { name: /track/i }).click();
    await expect(page.getByText(/couldn't find an order/i)).toBeVisible();
  });
});

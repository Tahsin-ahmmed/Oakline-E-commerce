import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? "";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "";

/** A seeded, in-stock, single-variant product. */
export const SIMPLE_PRODUCT = { slug: "alder-stoneware-vase", name: "Alder Stoneware Vase" };

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@example.com`;
}

export async function signIn(page: Page, email: string, password: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function addSimpleProductToBag(page: Page) {
  await page.goto(`/products/${SIMPLE_PRODUCT.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: SIMPLE_PRODUCT.name })).toBeVisible();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).not.toHaveText("0");
}

/** Pick an option from a shadcn/Radix Select identified by its label. */
export async function chooseOption(page: Page, label: string, option: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.getByLabel(new RegExp(`^${escaped}`)).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

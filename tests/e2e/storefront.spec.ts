import { expect, test } from "@playwright/test";
import { addSimpleProductToBag, SIMPLE_PRODUCT } from "./helpers";

test.describe("Product browsing", () => {
  test("homepage shows merchandising sections from the database", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /home/i }).first()).toBeVisible();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await expect(page.getByText(/trending now/i).first()).toBeVisible();
  });

  test("category listing filters and sorts real products", async ({ page }) => {
    await page.goto("/categories/watches");
    await expect(page.getByRole("heading", { level: 1, name: "Watches" })).toBeVisible();
    const cards = page.getByTestId("product-card");
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();
    expect(total).toBeGreaterThan(1);

    await page.goto("/categories/watches?sort=price_asc");
    const prices = await page.getByTestId("product-card").evaluateAll((els) =>
      els.map((el) => {
        const txt = el.querySelector(".tabular-nums")?.textContent ?? "0";
        return Number(txt.replace(/[^\d.]/g, ""));
      }),
    );
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    await page.goto("/products?availability=out_of_stock");
    await expect(page.getByText(/sold out/i).first()).toBeVisible();
  });

  test("search finds products and handles no results", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", { name: "Search products" }).first();
    await search.fill("leather");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=leather/);
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await expect(page.getByText(/leather/i).first()).toBeVisible();

    await page.goto("/search?q=zzqqxxnothing");
    await expect(page.getByTestId("product-card")).toHaveCount(0);
  });

  test("unknown products return a 404 page", async ({ page }) => {
    const res = await page.goto("/products/this-product-does-not-exist");
    expect(res?.status()).toBe(404);
  });
});

test.describe("Cart", () => {
  test("adding to the bag updates the live count and persists across reloads", async ({ page }) => {
    await addSimpleProductToBag(page);
    await expect(page.getByRole("dialog")).toContainText(SIMPLE_PRODUCT.name);
    await page.goto("/cart");
    await expect(page.getByText(SIMPLE_PRODUCT.name).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(SIMPLE_PRODUCT.name).first()).toBeVisible();
  });

  test("an invalid coupon shows a clear error", async ({ page }) => {
    await addSimpleProductToBag(page);
    await page.goto("/cart");
    await page.getByPlaceholder(/coupon|code/i).first().fill("SUMMER20");
    await page.getByRole("button", { name: /apply/i }).click();
    await expect(page.getByText(/expired/i).first()).toBeVisible();
  });
});

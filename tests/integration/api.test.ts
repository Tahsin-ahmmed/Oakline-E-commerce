import { beforeEach, describe, expect, it } from "vitest";
import { POST as addToCartRoute, GET as getCartRoute } from "@/app/api/cart/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";
import { GET as adminSearch } from "@/app/api/admin/search/route";
import { POST as placeOrderRoute } from "@/app/api/orders/route";
import { login } from "@/services/auth";
import { apiRequest, createCustomer, createProduct, createStaff, noParams, resetDb } from "./helpers";

async function body(res: Response) {
  return (await res.json()) as { success: boolean; data?: unknown; error?: { code: string; message: string; details?: Record<string, string[]> } };
}

describe("API security & response contract", () => {
  beforeEach(resetDb);

  it("returns the uniform success envelope", async () => {
    const res = await getCartRoute(apiRequest("/api/cart"), noParams);
    expect(res.status).toBe(200);
    expect(await body(res)).toMatchObject({ success: true, data: { items: [] } });
  });

  it("blocks cross-site mutations (CSRF origin check)", async () => {
    const p = await createProduct({ price: 100 });
    const evil = await addToCartRoute(apiRequest("/api/cart", { body: { productId: p.id, quantity: 1 }, origin: "https://evil.example" }), noParams);
    expect(evil.status).toBe(403);
    const missing = await addToCartRoute(apiRequest("/api/cart", { body: { productId: p.id, quantity: 1 }, origin: null }), noParams);
    expect(missing.status).toBe(403);
    const ok = await addToCartRoute(apiRequest("/api/cart", { body: { productId: p.id, quantity: 1 } }), noParams);
    expect(ok.status).toBe(200);
  });

  it("returns field-level validation errors", async () => {
    const res = await addToCartRoute(apiRequest("/api/cart", { body: { productId: "", quantity: 0 } }), noParams);
    expect(res.status).toBe(422);
    const json = await body(res);
    expect(json.error?.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(json.error?.details ?? {})).toEqual(expect.arrayContaining(["productId", "quantity"]));
  });

  it("rejects malformed JSON bodies", async () => {
    const req = apiRequest("/api/auth/login", { body: { a: 1 } });
    const bad = new Request(req.url, { method: "POST", headers: req.headers, body: "{not json" });
    const res = await loginRoute(bad as never, noParams);
    expect(res.status).toBe(400);
  });

  it("rate limits repeated login attempts", async () => {
    let last: Response | null = null;
    for (let i = 0; i < 9; i++) {
      last = await loginRoute(apiRequest("/api/auth/login", { body: { email: "nobody@example.com", password: "x" } }), noParams);
    }
    expect(last!.status).toBe(429);
  });

  it("requires staff for admin APIs and enforces permissions per staff role", async () => {
    const anon = await adminSearch(apiRequest("/api/admin/search?q=ab"), noParams);
    expect(anon.status).toBe(401);

    const customer = await createCustomer();
    await login(customer.user.email, customer.password);
    expect((await adminSearch(apiRequest("/api/admin/search?q=ab"), noParams)).status).toBe(403);

    const content = await createStaff("CONTENT_MANAGER");
    await login(content.user.email, content.password);
    const res = await adminSearch(apiRequest("/api/admin/search?q=ab"), noParams);
    expect(res.status).toBe(200);
    // Content managers have no access to orders/products/customers, so nothing is returned.
    expect((await body(res)).data).toEqual({ orders: [], products: [], customers: [] });
  });

  it("never accepts client-side prices at checkout", async () => {
    const res = await placeOrderRoute(apiRequest("/api/orders", { body: { total: 1, items: [{ price: 1 }] } }), noParams);
    expect(res.status).toBe(422);
  });

  it("rejects Stripe webhooks when not configured or unsigned", async () => {
    const res = await stripeWebhook(apiRequest("/api/webhooks/stripe", { body: { type: "checkout.session.completed" } }));
    expect([400, 503]).toContain(res.status);
  });

  it("hides internal error details", async () => {
    const res = await addToCartRoute(apiRequest("/api/cart", { body: { productId: "does-not-exist", quantity: 1 } }), noParams);
    expect(res.status).toBe(404);
    const json = await body(res);
    expect(json.error?.message).not.toMatch(/prisma|stack|sql/i);
  });
});

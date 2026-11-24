import { describe, expect, it } from "vitest";
import { discountPercent, formatMoney, moneyString, round2 } from "@/lib/money";
import { DEFAULT_ROLES, hasPermission, hasAnyPermission, ALL_PERMISSIONS } from "@/lib/permissions";
import { allowedTransitions, canTransition, customerCanCancel, restocksInventory } from "@/lib/order-status";
import { slugify } from "@/lib/slug";

describe("money", () => {
  it("rounds half up to 2 decimals", () => {
    expect(round2("1.005").toFixed(2)).toBe("1.01");
    expect(moneyString(10)).toBe("10.00");
    expect(moneyString(null)).toBe("0.00");
  });

  it("formats BDT with South-Asian grouping", () => {
    expect(formatMoney(125000)).toBe("৳1,25,000");
    expect(formatMoney("2690.50")).toBe("৳2,690.50");
    expect(formatMoney(-70)).toBe("-৳70");
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
  });

  it("computes discount percentages", () => {
    expect(discountPercent(3200, 2690)).toBe(16);
    expect(discountPercent(100, 100)).toBe(0);
    expect(discountPercent(0, 0)).toBe(0);
  });
});

describe("permissions", () => {
  const subject = (role: string) => ({ roles: [role], permissions: DEFAULT_ROLES[role].permissions });

  it("grants Super Admin everything regardless of stored permissions", () => {
    for (const p of ALL_PERMISSIONS) expect(hasPermission({ roles: ["SUPER_ADMIN"], permissions: [] }, p)).toBe(true);
  });

  it("denies anonymous subjects", () => {
    expect(hasPermission(null, "orders.view")).toBe(false);
    expect(hasAnyPermission(undefined, ["orders.view"])).toBe(false);
  });

  it("keeps staff management and critical settings for Super Admin only", () => {
    for (const role of Object.keys(DEFAULT_ROLES).filter((r) => r !== "SUPER_ADMIN")) {
      expect(hasPermission(subject(role), "staff.manage")).toBe(false);
      expect(hasPermission(subject(role), "settings.critical")).toBe(false);
    }
  });

  it("matches the role examples from the specification", () => {
    expect(hasPermission(subject("PRODUCT_MANAGER"), "products.manage")).toBe(true);
    expect(hasPermission(subject("PRODUCT_MANAGER"), "payments.view")).toBe(false);
    expect(hasPermission(subject("PRODUCT_MANAGER"), "payments.manage")).toBe(false);
    expect(hasPermission(subject("ORDER_MANAGER"), "orders.manage")).toBe(true);
    expect(hasPermission(subject("ORDER_MANAGER"), "settings.manage")).toBe(false);
    expect(hasPermission(subject("CONTENT_MANAGER"), "content.manage")).toBe(true);
    expect(hasPermission(subject("CONTENT_MANAGER"), "orders.view")).toBe(false);
    expect(hasPermission(subject("INVENTORY_MANAGER"), "inventory.manage")).toBe(true);
    expect(hasPermission(subject("INVENTORY_MANAGER"), "products.manage")).toBe(false);
  });
});

describe("order status rules", () => {
  it("allows moving forward along the fulfilment flow, skipping steps", () => {
    expect(canTransition("PENDING", "CONFIRMED", "UNPAID")).toBe(true);
    expect(canTransition("PENDING", "SHIPPED", "UNPAID")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED", "UNPAID")).toBe(true);
  });

  it("forbids moving backwards", () => {
    expect(canTransition("SHIPPED", "PROCESSING", "UNPAID")).toBe(false);
    expect(canTransition("DELIVERED", "PENDING", "PAID")).toBe(false);
  });

  it("only allows cancellation before shipping", () => {
    expect(canTransition("PACKED", "CANCELLED", "UNPAID")).toBe(true);
    expect(canTransition("SHIPPED", "CANCELLED", "UNPAID")).toBe(false);
  });

  it("only allows returns after shipping", () => {
    expect(canTransition("DELIVERED", "RETURNED", "PAID")).toBe(true);
    expect(canTransition("CONFIRMED", "RETURNED", "UNPAID")).toBe(false);
  });

  it("only allows refunds on paid orders", () => {
    expect(allowedTransitions("CANCELLED", "PAID")).toContain("REFUNDED");
    expect(allowedTransitions("CANCELLED", "UNPAID")).not.toContain("REFUNDED");
    expect(allowedTransitions("REFUNDED", "REFUNDED")).toEqual([]);
  });

  it("restocks on cancellation and return only", () => {
    expect(restocksInventory("CANCELLED")).toBe(true);
    expect(restocksInventory("RETURNED")).toBe(true);
    expect(restocksInventory("DELIVERED")).toBe(false);
  });

  it("lets customers cancel only early orders", () => {
    expect(customerCanCancel("PENDING")).toBe(true);
    expect(customerCanCancel("CONFIRMED")).toBe(true);
    expect(customerCanCancel("PROCESSING")).toBe(false);
  });
});

describe("slugify", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("Speckled Stoneware Cups (Set of 4)")).toBe("speckled-stoneware-cups-set-of-4");
    expect(slugify("  Café & Crème  ")).toBe("cafe-and-creme");
    expect(slugify("---")).toBe("");
  });
});

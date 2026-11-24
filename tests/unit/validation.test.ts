import { describe, expect, it } from "vitest";
import { registerSchema, resetPasswordSchema, changePasswordSchema } from "@/lib/validations/auth";
import { checkoutSchema, cartAddSchema } from "@/lib/validations/checkout";
import { addressSchema } from "@/lib/validations/common";
import { settingsSchemas, defaultSettings } from "@/lib/validations/settings";
import { sniffImageType, validateImage } from "@/lib/storage/cloudinary";

const address = {
  fullName: "Ayesha Rahman",
  phone: "01711000001",
  line1: "House 10, Road 3",
  division: "Dhaka",
  district: "Dhaka",
};

describe("auth validation", () => {
  it("requires strong-enough passwords", () => {
    expect(registerSchema.safeParse({ name: "Ayesha R", email: "a@b.co", password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Ayesha R", email: "a@b.co", password: "longenough" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Ayesha R", email: "A@B.CO", password: "longenough1" }).data?.email).toBe("a@b.co");
  });

  it("checks password confirmation", () => {
    expect(resetPasswordSchema.safeParse({ token: "x".repeat(30), password: "abcdefg1", confirmPassword: "abcdefg2" }).success).toBe(false);
    expect(
      changePasswordSchema.safeParse({ currentPassword: "abcdefg1", newPassword: "abcdefg1", confirmPassword: "abcdefg1" }).success,
    ).toBe(false);
  });
});

describe("address validation", () => {
  it("accepts a valid Bangladeshi address", () => {
    expect(addressSchema.safeParse(address).success).toBe(true);
  });

  it("rejects a district that is not in the selected division", () => {
    const r = addressSchema.safeParse({ ...address, division: "Sylhet", district: "Dhaka" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["district"]);
  });

  it("rejects malformed phone numbers", () => {
    expect(addressSchema.safeParse({ ...address, phone: "call me" }).success).toBe(false);
  });
});

describe("checkout validation", () => {
  const valid = {
    idempotencyKey: "3b241101-e2bb-4255-8caf-4136c566a962",
    customer: { name: "Ayesha Rahman", email: "ayesha@example.com", phone: "01711000001" },
    shippingAddress: address,
    shippingMethodId: "m1",
    paymentMethod: "COD",
    acceptTerms: true,
  };

  it("accepts a complete submission", () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
  });

  it("requires accepting the terms and a real idempotency key", () => {
    expect(checkoutSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, idempotencyKey: "abc" }).success).toBe(false);
  });

  it("rejects unknown payment methods", () => {
    expect(checkoutSchema.safeParse({ ...valid, paymentMethod: "PAYPAL" }).success).toBe(false);
  });

  it("does not accept client-supplied prices (unknown keys are stripped)", () => {
    const parsed = checkoutSchema.parse({ ...valid, total: 1, price: 1 });
    expect("total" in parsed).toBe(false);
    expect("price" in parsed).toBe(false);
  });

  it("bounds cart quantities", () => {
    expect(cartAddSchema.safeParse({ productId: "p", quantity: 0 }).success).toBe(false);
    expect(cartAddSchema.safeParse({ productId: "p", quantity: 100 }).success).toBe(false);
    expect(cartAddSchema.safeParse({ productId: "p", quantity: "3" }).data?.quantity).toBe(3);
  });
});

describe("settings", () => {
  it("provides complete defaults", () => {
    const s = defaultSettings();
    expect(s.general.currency).toBe("BDT");
    expect(s.commerce.codEnabled).toBe(true);
    expect(s.maintenance.enabled).toBe(false);
  });

  it("validates the order prefix", () => {
    expect(settingsSchemas.commerce.safeParse({ orderPrefix: "oak" }).success).toBe(false);
    expect(settingsSchemas.commerce.safeParse({ orderPrefix: "SHOP" }).success).toBe(true);
  });
});

describe("upload validation", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);

  it("detects real image types from magic bytes", () => {
    expect(sniffImageType(png)).toBe("png");
    expect(sniffImageType(jpeg)).toBe("jpeg");
    expect(sniffImageType(webp)).toBe("webp");
  });

  it("rejects disguised or oversized files", () => {
    expect(() => validateImage(Buffer.from("<svg onload=alert(1)></svg>"))).toThrow(/Only JPEG/);
    expect(() => validateImage(Buffer.from("MZ\x90\x00 this is an exe padded"))).toThrow();
    expect(() => validateImage(Buffer.alloc(0))).toThrow(/empty/);
    const big = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]);
    expect(() => validateImage(big)).toThrow(/5 MB/);
  });
});

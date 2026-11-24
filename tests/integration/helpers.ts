import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ROLES, PERMISSIONS } from "@/lib/permissions";
import { cookieJar } from "./setup";

/** Wipe every table (except Prisma's migration history). */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
  cookieJar.clear();
}

export function signOutLocal() {
  cookieJar.clear();
}

let seq = 0;
const next = () => ++seq;

export async function createCategory(name = `Category ${next()}`) {
  return prisma.category.create({ data: { name, slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${next()}` } });
}

export async function createProduct(opts: {
  price: number;
  salePrice?: number;
  stock?: number;
  categoryId?: string;
  variants?: { color?: string; size?: string; stock: number; price?: number }[];
  status?: "ACTIVE" | "DRAFT";
  costPrice?: number;
}) {
  const n = next();
  const categoryId = opts.categoryId ?? (await createCategory()).id;
  const variants = opts.variants ?? [{ stock: opts.stock ?? 10 }];
  const effective = opts.salePrice && opts.salePrice < opts.price ? opts.salePrice : opts.price;
  return prisma.product.create({
    data: {
      name: `Product ${n}`,
      slug: `product-${n}`,
      sku: `SKU-${n}`,
      categoryId,
      price: opts.price,
      salePrice: opts.salePrice ?? null,
      costPrice: opts.costPrice ?? null,
      effectivePrice: effective,
      stockQuantity: variants.reduce((s, v) => s + v.stock, 0),
      status: opts.status ?? "ACTIVE",
      hasVariants: Boolean(opts.variants),
      variants: {
        create: variants.map((v, i) => ({
          sku: `SKU-${n}-${i}`,
          name: [v.color, v.size].filter(Boolean).join(" / ") || "Default",
          color: v.color ?? null,
          size: v.size ?? null,
          price: v.price ?? null,
          isDefault: i === 0,
          inventory: { create: { quantity: v.stock } },
        })),
      },
    },
    include: { variants: { include: { inventory: true }, orderBy: { sortOrder: "asc" } } },
  });
}

export async function createShipping() {
  const zone = await prisma.shippingZone.create({
    data: {
      name: "Dhaka",
      districts: ["Dhaka"],
      methods: { create: [{ name: "Standard", fee: 70, minDays: 1, maxDays: 2 }, { name: "Express", fee: 150, codAvailable: false }] },
    },
    include: { methods: true },
  });
  const rest = await prisma.shippingZone.create({
    data: { name: "Rest", isDefault: true, methods: { create: [{ name: "Standard", fee: 130, minDays: 3, maxDays: 5 }] } },
    include: { methods: true },
  });
  return { dhaka: zone, rest };
}

export async function createCustomer(email = `customer${next()}@example.com`, password = "Password123") {
  const user = await prisma.user.create({
    data: { email, name: "Test Customer", passwordHash: await bcrypt.hash(password, 4) },
  });
  return { user, password };
}

export async function createStaff(roleKey: keyof typeof DEFAULT_ROLES, email = `staff${next()}@example.com`, password = "Password123") {
  for (const [key, meta] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, create: { key, name: meta.name, group: meta.group }, update: {} });
  }
  const perms = await prisma.permission.findMany();
  const def = DEFAULT_ROLES[roleKey];
  const role = await prisma.role.upsert({
    where: { key: roleKey },
    create: {
      key: roleKey,
      name: def.name,
      isSystem: true,
      permissions: { create: def.permissions.map((p) => ({ permissionId: perms.find((x) => x.key === p)!.id })) },
    },
    update: {},
  });
  const user = await prisma.user.create({
    data: {
      email,
      name: `Staff ${roleKey}`,
      isStaff: true,
      passwordHash: await bcrypt.hash(password, 4),
      roles: { create: { roleId: role.id } },
    },
  });
  return { user, password };
}

export function checkoutInput(shippingMethodId: string, overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    customer: { name: "Test Customer", email: "buyer@example.com", phone: "01700000000" },
    shippingAddress: { fullName: "Test Customer", phone: "01700000000", line1: "House 1, Road 2", division: "Dhaka", district: "Dhaka" },
    shippingMethodId,
    paymentMethod: "COD" as const,
    acceptTerms: true as const,
    ...overrides,
  };
}

/** Build a NextRequest for calling route handlers directly. */
export function apiRequest(url: string, init: { method?: string; body?: unknown; origin?: string | null } = {}) {
  const headers = new Headers({ "content-type": "application/json", host: "localhost:3000" });
  if (init.origin !== null) headers.set("origin", init.origin ?? "http://localhost:3000");
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

export const noParams = { params: Promise.resolve({}) };

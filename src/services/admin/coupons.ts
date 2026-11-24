import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { conflict, notFound } from "@/lib/errors";
import { moneyString } from "@/lib/money";
import type { CouponInput } from "@/lib/validations/admin/sales";
import { logActivity } from "@/services/audit";

export type CouponState = "active" | "scheduled" | "expired" | "inactive";

export function couponState(c: { isActive: boolean; startsAt: Date | null; expiresAt: Date | null; usageLimit: number | null; usedCount: number }, now = new Date()): CouponState {
  if (!c.isActive) return "inactive";
  if (c.expiresAt && c.expiresAt <= now) return "expired";
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return "expired";
  if (c.startsAt && c.startsAt > now) return "scheduled";
  return "active";
}

export async function listCoupons(opts: { q?: string; state?: CouponState; page: number; pageSize: number }) {
  const now = new Date();
  const and: Prisma.CouponWhereInput[] = [{ deletedAt: null }];
  if (opts.q) and.push({ OR: [{ code: { contains: opts.q, mode: "insensitive" } }, { description: { contains: opts.q, mode: "insensitive" } }] });
  if (opts.state === "inactive") and.push({ isActive: false });
  if (opts.state === "expired") and.push({ isActive: true, expiresAt: { lte: now } });
  if (opts.state === "scheduled") and.push({ isActive: true, startsAt: { gt: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
  if (opts.state === "active") {
    and.push({
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    });
  }
  const where = { AND: and };
  const [rows, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      include: {
        categories: { select: { id: true, name: true } },
        products: { select: { id: true, name: true } },
        _count: { select: { usages: true } },
      },
    }),
    prisma.coupon.count({ where }),
  ]);
  return {
    items: rows.map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      type: c.type,
      value: moneyString(c.value),
      minPurchase: c.minPurchase ? moneyString(c.minPurchase) : null,
      maxDiscount: c.maxDiscount ? moneyString(c.maxDiscount) : null,
      startsAt: c.startsAt?.toISOString() ?? null,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      usageLimit: c.usageLimit,
      perCustomerLimit: c.perCustomerLimit,
      usedCount: c.usedCount,
      isActive: c.isActive,
      state: couponState(c, now),
      categories: c.categories,
      products: c.products,
      createdAt: c.createdAt.toISOString(),
    })),
    total,
  };
}
export type AdminCouponRow = Awaited<ReturnType<typeof listCoupons>>["items"][number];

export async function getCouponUsage(id: string) {
  const coupon = await prisma.coupon.findFirst({ where: { id, deletedAt: null }, select: { id: true, code: true } });
  if (!coupon) throw notFound("Coupon not found.");
  const usages = await prisma.couponUsage.findMany({
    where: { couponId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { order: { select: { id: true, orderNumber: true, status: true, grandTotal: true } } },
  });
  return usages.map((u) => ({
    id: u.id,
    email: u.email,
    discountAmount: moneyString(u.discountAmount),
    createdAt: u.createdAt.toISOString(),
    order: { ...u.order, grandTotal: moneyString(u.order.grandTotal) },
  }));
}

function couponData(input: CouponInput) {
  return {
    code: input.code,
    description: input.description || null,
    type: input.type,
    value: input.type === "FREE_SHIPPING" ? 0 : input.value,
    minPurchase: input.minPurchase,
    maxDiscount: input.type === "PERCENTAGE" ? input.maxDiscount : null,
    startsAt: input.startsAt,
    expiresAt: input.expiresAt,
    usageLimit: input.usageLimit,
    perCustomerLimit: input.perCustomerLimit,
    isActive: input.isActive,
  };
}

async function validateRefs(input: CouponInput) {
  const [cats, prods] = await Promise.all([
    input.categoryIds.length ? prisma.category.count({ where: { id: { in: input.categoryIds } } }) : 0,
    input.productIds.length ? prisma.product.count({ where: { id: { in: input.productIds }, deletedAt: null } }) : 0,
  ]);
  if (cats !== input.categoryIds.length) throw conflict("One or more selected categories no longer exist.");
  if (prods !== input.productIds.length) throw conflict("One or more selected products no longer exist.");
}

async function assertCodeFree(code: string, exceptId?: string) {
  const existing = await prisma.coupon.findUnique({ where: { code }, select: { id: true, deletedAt: true } });
  if (existing && existing.id !== exceptId) {
    throw conflict(
      existing.deletedAt ? "This code belongs to a deleted coupon. Choose another code." : "A coupon with this code already exists.",
      { code: ["Code already in use"] },
    );
  }
}

export async function createCoupon(input: CouponInput, actor: { id: string }, ip?: string) {
  await assertCodeFree(input.code);
  await validateRefs(input);
  const coupon = await prisma.coupon.create({
    data: {
      ...couponData(input),
      categories: { connect: input.categoryIds.map((id) => ({ id })) },
      products: { connect: input.productIds.map((id) => ({ id })) },
    },
  });
  await logActivity({ user: actor, action: "coupon.create", entityType: "Coupon", entityId: coupon.id, summary: `Created coupon ${coupon.code}`, ip });
  return coupon;
}

export async function updateCoupon(id: string, input: CouponInput, actor: { id: string }, ip?: string) {
  const existing = await prisma.coupon.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw notFound("Coupon not found.");
  await assertCodeFree(input.code, id);
  await validateRefs(input);
  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      ...couponData(input),
      categories: { set: input.categoryIds.map((cid) => ({ id: cid })) },
      products: { set: input.productIds.map((pid) => ({ id: pid })) },
    },
  });
  await logActivity({ user: actor, action: "coupon.update", entityType: "Coupon", entityId: id, summary: `Updated coupon ${coupon.code}`, ip });
  return coupon;
}

export async function setCouponActive(id: string, isActive: boolean, actor: { id: string }, ip?: string) {
  const coupon = await prisma.coupon.findFirst({ where: { id, deletedAt: null } });
  if (!coupon) throw notFound("Coupon not found.");
  await prisma.coupon.update({ where: { id }, data: { isActive } });
  await logActivity({ user: actor, action: isActive ? "coupon.activate" : "coupon.deactivate", entityType: "Coupon", entityId: id, summary: `${isActive ? "Activated" : "Deactivated"} ${coupon.code}`, ip });
}

/** Soft delete: usage history and order references are preserved. */
export async function deleteCoupon(id: string, actor: { id: string }, ip?: string) {
  const coupon = await prisma.coupon.findFirst({ where: { id, deletedAt: null } });
  if (!coupon) throw notFound("Coupon not found.");
  await prisma.coupon.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await logActivity({ user: actor, action: "coupon.delete", entityType: "Coupon", entityId: id, summary: `Deleted coupon ${coupon.code}`, ip });
}

/** Options for the coupon form's category/product pickers. */
export async function couponOptions(q?: string) {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, parent: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { deletedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}) },
      orderBy: { name: "asc" },
      take: 30,
      select: { id: true, name: true, sku: true },
    }),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.parent ? `${c.parent.name} › ${c.name}` : c.name })),
    products,
  };
}

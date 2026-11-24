import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { StockMovementType } from "@/generated/prisma/enums";
import { dec, moneyString } from "@/lib/money";

export interface InventoryFilters {
  q?: string;
  stock?: "in" | "low" | "out";
  categoryId?: string;
  skip: number;
  take: number;
}

function inventoryWhere(f: Omit<InventoryFilters, "skip" | "take">): Prisma.InventoryWhereInput {
  const and: Prisma.InventoryWhereInput[] = [{ variant: { product: { deletedAt: null } } }];
  if (f.q) {
    and.push({
      OR: [
        { variant: { sku: { contains: f.q, mode: "insensitive" } } },
        { variant: { product: { name: { contains: f.q, mode: "insensitive" } } } },
        { variant: { product: { sku: { contains: f.q, mode: "insensitive" } } } },
      ],
    });
  }
  if (f.categoryId) {
    and.push({ variant: { product: { OR: [{ categoryId: f.categoryId }, { category: { parentId: f.categoryId } }] } } });
  }
  if (f.stock === "out") and.push({ quantity: { lte: 0 } });
  if (f.stock === "low") and.push({ quantity: { gt: 0, lte: prisma.inventory.fields.lowStockThreshold } });
  if (f.stock === "in") and.push({ quantity: { gt: prisma.inventory.fields.lowStockThreshold } });
  return { AND: and };
}

export async function listInventory(f: InventoryFilters) {
  const where = inventoryWhere(f);
  const [rows, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      orderBy: [{ quantity: "asc" }, { updatedAt: "desc" }],
      skip: f.skip,
      take: f.take,
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                slug: true,
                hasVariants: true,
                costPrice: true,
                status: true,
                images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.inventory.count({ where }),
  ]);
  return {
    total,
    items: rows.map((r) => ({
      inventoryId: r.id,
      variantId: r.variantId,
      productId: r.variant.product.id,
      productName: r.variant.product.name,
      productStatus: r.variant.product.status,
      category: r.variant.product.category.name,
      image: r.variant.imageUrl ?? r.variant.product.images[0]?.url ?? null,
      variantName: r.variant.product.hasVariants ? r.variant.name : null,
      sku: r.variant.sku,
      isActive: r.variant.isActive,
      quantity: r.quantity,
      lowStockThreshold: r.lowStockThreshold,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}
export type InventoryRow = Awaited<ReturnType<typeof listInventory>>["items"][number];

export async function inventorySummary() {
  const base: Prisma.InventoryWhereInput = { variant: { product: { deletedAt: null } } };
  const [skus, units, low, out, valueRows] = await Promise.all([
    prisma.inventory.count({ where: base }),
    prisma.inventory.aggregate({ where: base, _sum: { quantity: true } }),
    prisma.inventory.count({ where: { AND: [base, { quantity: { gt: 0, lte: prisma.inventory.fields.lowStockThreshold } }] } }),
    prisma.inventory.count({ where: { AND: [base, { quantity: { lte: 0 } }] } }),
    prisma.$queryRaw<{ value: Prisma.Decimal | null }[]>`
      SELECT SUM(GREATEST(i."quantity", 0) * COALESCE(p."costPrice", 0)) AS value
      FROM "Inventory" i
      JOIN "ProductVariant" v ON v."id" = i."variantId"
      JOIN "Product" p ON p."id" = v."productId"
      WHERE p."deletedAt" IS NULL`,
  ]);
  return {
    skus,
    units: units._sum.quantity ?? 0,
    lowStock: low,
    outOfStock: out,
    valueAtCost: moneyString(dec(valueRows[0]?.value ?? 0)),
  };
}

export const MOVEMENT_TYPES: StockMovementType[] = ["INITIAL", "RESTOCK", "SALE", "ADJUSTMENT", "RETURN", "CANCELLATION"];

export async function listMovements(f: { variantId?: string; type?: StockMovementType; q?: string; skip: number; take: number }) {
  const and: Prisma.StockMovementWhereInput[] = [];
  if (f.variantId) and.push({ inventory: { variantId: f.variantId } });
  if (f.type) and.push({ type: f.type });
  if (f.q) {
    and.push({
      OR: [
        { inventory: { variant: { sku: { contains: f.q, mode: "insensitive" } } } },
        { inventory: { variant: { product: { name: { contains: f.q, mode: "insensitive" } } } } },
        { reason: { contains: f.q, mode: "insensitive" } },
      ],
    });
  }
  const where: Prisma.StockMovementWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: f.skip,
      take: f.take,
      include: {
        user: { select: { name: true } },
        order: { select: { id: true, orderNumber: true } },
        inventory: { include: { variant: { select: { sku: true, name: true, product: { select: { id: true, name: true, hasVariants: true } } } } } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);
  return {
    total,
    items: rows.map((m) => ({
      id: m.id,
      type: m.type,
      quantityChange: m.quantityChange,
      quantityAfter: m.quantityAfter,
      reason: m.reason,
      user: m.user?.name ?? null,
      order: m.order,
      productId: m.inventory.variant.product.id,
      productName: m.inventory.variant.product.name,
      variantName: m.inventory.variant.product.hasVariants ? m.inventory.variant.name : null,
      sku: m.inventory.variant.sku,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
export type MovementRow = Awaited<ReturnType<typeof listMovements>>["items"][number];

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection and escape quotes.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function inventoryCsv(f: Omit<InventoryFilters, "skip" | "take">) {
  const rows = await prisma.inventory.findMany({
    where: inventoryWhere(f),
    orderBy: [{ variant: { product: { name: "asc" } } }, { variant: { sortOrder: "asc" } }],
    include: {
      variant: {
        include: { product: { select: { name: true, sku: true, hasVariants: true, costPrice: true, effectivePrice: true, status: true, category: { select: { name: true } } } } },
      },
    },
  });
  const header = ["Product", "Variant", "SKU", "Category", "Status", "On hand", "Low-stock threshold", "Stock status", "Unit cost", "Unit price", "Value at cost"];
  const lines = rows.map((r) => {
    const p = r.variant.product;
    const status = r.quantity <= 0 ? "Out of stock" : r.quantity <= r.lowStockThreshold ? "Low stock" : "In stock";
    const cost = p.costPrice ? dec(p.costPrice) : null;
    return [
      p.name,
      p.hasVariants ? r.variant.name : "",
      r.variant.sku,
      p.category.name,
      p.status,
      r.quantity,
      r.lowStockThreshold,
      status,
      cost ? cost.toFixed(2) : "",
      moneyString(p.effectivePrice),
      cost ? cost.times(Math.max(r.quantity, 0)).toFixed(2) : "",
    ]
      .map(csvCell)
      .join(",");
  });
  return "﻿" + [header.join(","), ...lines].join("\r\n");
}

import "server-only";
import { prisma, type Tx } from "@/lib/prisma";
import { conflict, notFound, badRequest } from "@/lib/errors";
import type { StockMovementType } from "@/generated/prisma/enums";

/** Recompute the denormalized Product.stockQuantity from its active variants. */
export async function syncProductStock(tx: Tx, productId: string) {
  await tx.$executeRaw`
    UPDATE "Product" p SET "stockQuantity" = COALESCE((
      SELECT SUM(GREATEST(i."quantity", 0)) FROM "Inventory" i
      JOIN "ProductVariant" v ON v."id" = i."variantId"
      WHERE v."productId" = p."id" AND v."isActive" = true
    ), 0)
    WHERE p."id" = ${productId}`;
}

/**
 * Atomically decrement stock. The conditional UPDATE guarantees no overselling even
 * under concurrent checkouts: it only succeeds when enough stock remains.
 */
export async function reserveStock(
  tx: Tx,
  args: { variantId: string; quantity: number; orderId: string; productName: string },
) {
  const rows = await tx.$queryRaw<{ id: string; quantity: number }[]>`
    UPDATE "Inventory" SET "quantity" = "quantity" - ${args.quantity}, "updatedAt" = now()
    WHERE "variantId" = ${args.variantId} AND "quantity" >= ${args.quantity}
    RETURNING "id", "quantity"`;
  if (rows.length === 0) {
    throw conflict(`Sorry, "${args.productName}" no longer has enough stock for this quantity.`, {
      variantId: args.variantId,
    });
  }
  await tx.stockMovement.create({
    data: {
      inventoryId: rows[0].id,
      type: "SALE",
      quantityChange: -args.quantity,
      quantityAfter: rows[0].quantity,
      orderId: args.orderId,
      reason: "Order placed",
    },
  });
}

/** Return stock to the shelf (cancellations / returns). */
export async function releaseStock(
  tx: Tx,
  args: { variantId: string; quantity: number; orderId: string; type: StockMovementType; userId?: string | null; reason: string },
) {
  const rows = await tx.$queryRaw<{ id: string; quantity: number }[]>`
    UPDATE "Inventory" SET "quantity" = "quantity" + ${args.quantity}, "updatedAt" = now()
    WHERE "variantId" = ${args.variantId}
    RETURNING "id", "quantity"`;
  if (rows.length === 0) return; // variant was deleted; nothing to restock
  await tx.stockMovement.create({
    data: {
      inventoryId: rows[0].id,
      type: args.type,
      quantityChange: args.quantity,
      quantityAfter: rows[0].quantity,
      orderId: args.orderId,
      userId: args.userId ?? null,
      reason: args.reason,
    },
  });
}

export interface AdjustmentInput {
  variantId: string;
  /** "set" replaces the on-hand quantity, "add" applies a signed delta. */
  mode: "set" | "add";
  quantity: number;
  type?: Extract<StockMovementType, "RESTOCK" | "ADJUSTMENT" | "RETURN">;
  reason: string;
  lowStockThreshold?: number;
}

/** Manual stock adjustment by staff, with a movement log entry. */
export async function adjustStock(input: AdjustmentInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id: input.variantId },
      include: { inventory: true },
    });
    if (!variant) throw notFound("Variant not found.");
    const inventory =
      variant.inventory ??
      (await tx.inventory.create({ data: { variantId: variant.id, quantity: 0 } }));

    // Lock the row so concurrent adjustments/checkouts serialize correctly.
    const [locked] = await tx.$queryRaw<{ quantity: number }[]>`
      SELECT "quantity" FROM "Inventory" WHERE "id" = ${inventory.id} FOR UPDATE`;
    const current = locked.quantity;
    const next = input.mode === "set" ? input.quantity : current + input.quantity;
    if (next < 0) throw badRequest(`Stock cannot go below zero (currently ${current}).`);
    const change = next - current;

    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        quantity: next,
        ...(input.lowStockThreshold !== undefined ? { lowStockThreshold: input.lowStockThreshold } : {}),
      },
    });
    if (change !== 0) {
      await tx.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: input.type ?? (change > 0 ? "RESTOCK" : "ADJUSTMENT"),
          quantityChange: change,
          quantityAfter: next,
          reason: input.reason,
          userId,
        },
      });
    }
    await syncProductStock(tx, variant.productId);
    return { variantId: variant.id, productId: variant.productId, quantity: updated.quantity, change };
  });
}

import { revalidateTag } from "next/cache";
import { route } from "@/lib/api";
import { stockAdjustSchema } from "@/lib/validations/admin/catalog";
import { adjustStock } from "@/services/inventory";
import { CATALOG_TAG } from "@/services/catalog";
import { logActivity } from "@/services/audit";

/** POST /api/admin/inventory/adjust — set or add stock for a variant, with a movement log entry. */
export const POST = route({ auth: "staff", permission: "inventory.manage" }, async ({ json, user, ip }) => {
  const input = await json(stockAdjustSchema);
  const result = await adjustStock(
    {
      variantId: input.variantId,
      mode: input.mode,
      quantity: input.quantity,
      type: input.type,
      reason: input.reason,
      lowStockThreshold: input.lowStockThreshold,
    },
    user!.id,
  );
  try {
    revalidateTag(CATALOG_TAG, { expire: 0 });
  } catch {
    /* ignore */
  }
  await logActivity({
    user,
    action: "inventory.adjust",
    entityType: "ProductVariant",
    entityId: input.variantId,
    summary: `Stock ${input.mode === "set" ? "set to" : "changed by"} ${input.quantity} (now ${result.quantity}): ${input.reason}`,
    metadata: { change: result.change, type: input.type },
    ip,
  });
  return result;
});

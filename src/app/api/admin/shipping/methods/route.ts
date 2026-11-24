import { route } from "@/lib/api";
import { shippingMethodSchema } from "@/lib/validations/admin/system";
import { createMethod } from "@/services/admin/shipping";
import { logActivity } from "@/services/audit";

export const POST = route({ auth: "staff", permission: "shipping.manage" }, async ({ json, user, ip }) => {
  const input = await json(shippingMethodSchema);
  const method = await createMethod(input);
  await logActivity({
    user,
    ip,
    action: "shipping_method.create",
    entityType: "ShippingMethod",
    entityId: method.id,
    summary: `Created delivery method “${method.name}”`,
    metadata: { zoneId: method.zoneId, fee: input.fee, freeShippingThreshold: input.freeShippingThreshold },
  });
  return method;
});

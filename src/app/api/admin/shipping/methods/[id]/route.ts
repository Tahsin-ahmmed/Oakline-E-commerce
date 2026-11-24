import { route } from "@/lib/api";
import { shippingMethodSchema } from "@/lib/validations/admin/system";
import { deleteMethod, updateMethod } from "@/services/admin/shipping";
import { logActivity } from "@/services/audit";

export const PATCH = route<{ id: string }>({ auth: "staff", permission: "shipping.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(shippingMethodSchema);
  const method = await updateMethod(params.id, input);
  await logActivity({
    user,
    ip,
    action: "shipping_method.update",
    entityType: "ShippingMethod",
    entityId: method.id,
    summary: `Updated delivery method “${method.name}”`,
    metadata: { fee: input.fee, freeShippingThreshold: input.freeShippingThreshold, isActive: input.isActive, codAvailable: input.codAvailable },
  });
  return method;
});

export const DELETE = route<{ id: string }>({ auth: "staff", permission: "shipping.manage" }, async ({ params, user, ip }) => {
  const method = await deleteMethod(params.id);
  await logActivity({ user, ip, action: "shipping_method.delete", entityType: "ShippingMethod", entityId: method.id, summary: `Deleted delivery method “${method.name}”` });
  return { deleted: true };
});

import { route } from "@/lib/api";
import { shippingZoneSchema } from "@/lib/validations/admin/system";
import { deleteZone, updateZone } from "@/services/admin/shipping";
import { logActivity } from "@/services/audit";

export const PATCH = route<{ id: string }>({ auth: "staff", permission: "shipping.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(shippingZoneSchema);
  const zone = await updateZone(params.id, input);
  await logActivity({
    user,
    ip,
    action: "shipping_zone.update",
    entityType: "ShippingZone",
    entityId: zone.id,
    summary: `Updated shipping zone “${zone.name}”`,
    metadata: { divisions: input.divisions, districts: input.districts, areas: input.areas, isDefault: input.isDefault, isActive: input.isActive },
  });
  return zone;
});

export const DELETE = route<{ id: string }>({ auth: "staff", permission: "shipping.manage" }, async ({ params, user, ip }) => {
  const zone = await deleteZone(params.id);
  await logActivity({ user, ip, action: "shipping_zone.delete", entityType: "ShippingZone", entityId: zone.id, summary: `Deleted shipping zone “${zone.name}”` });
  return { deleted: true };
});

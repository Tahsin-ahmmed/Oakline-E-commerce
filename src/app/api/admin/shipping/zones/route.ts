import { route } from "@/lib/api";
import { shippingZoneSchema } from "@/lib/validations/admin/system";
import { createZone, listZones } from "@/services/admin/shipping";
import { logActivity } from "@/services/audit";

export const GET = route({ auth: "staff", permission: "shipping.manage" }, async () => listZones());

export const POST = route({ auth: "staff", permission: "shipping.manage" }, async ({ json, user, ip }) => {
  const input = await json(shippingZoneSchema);
  const zone = await createZone(input);
  await logActivity({ user, ip, action: "shipping_zone.create", entityType: "ShippingZone", entityId: zone.id, summary: `Created shipping zone “${zone.name}”` });
  return zone;
});

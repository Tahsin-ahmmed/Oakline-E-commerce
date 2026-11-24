import { route } from "@/lib/api";
import { shippingTestSchema } from "@/lib/validations/admin/system";
import { testDestination } from "@/services/admin/shipping";

/** POST /api/admin/shipping/test — preview which zone and fees apply to a destination. */
export const POST = route({ auth: "staff", permission: "shipping.manage" }, async ({ json }) => {
  const input = await json(shippingTestSchema);
  return testDestination({ division: input.division, district: input.district, area: input.area }, input.subtotal);
});

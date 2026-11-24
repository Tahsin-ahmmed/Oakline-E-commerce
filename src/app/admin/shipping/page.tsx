import { requireStaff } from "@/lib/auth/guards";
import { listZones } from "@/services/admin/shipping";
import { PageHeader } from "@/components/admin/page-header";
import { ShippingManager } from "@/components/admin/shipping/shipping-manager";

export const metadata = { title: "Shipping" };

export default async function ShippingPage() {
  await requireStaff("shipping.manage", "/admin/shipping");
  const zones = await listZones();
  return (
    <>
      <PageHeader
        title="Shipping"
        description="Delivery zones by division, district and area, with their methods, fees and delivery times."
      />
      <ShippingManager zones={zones} />
    </>
  );
}

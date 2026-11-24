import "server-only";
import { prisma, type Tx } from "@/lib/prisma";
import { matchShippingZone, shippingFee, type Destination } from "@/lib/pricing";
import { moneyString, type MoneyInput } from "@/lib/money";

export interface ShippingOption {
  id: string;
  name: string;
  description: string | null;
  fee: string;
  baseFee: string;
  isFree: boolean;
  estimate: string;
  codAvailable: boolean;
  zoneName: string;
}

function estimateLabel(minDays: number, maxDays: number) {
  if (minDays === maxDays) return `${minDays} business day${minDays === 1 ? "" : "s"}`;
  return `${minDays}–${maxDays} business days`;
}

export async function getShippingOptions(
  dest: Destination,
  subtotalAfterDiscount: MoneyInput,
  opts: { storeFreeThreshold?: MoneyInput; freeShippingCoupon?: boolean } = {},
  db: Tx | typeof prisma = prisma,
): Promise<ShippingOption[]> {
  const zones = await db.shippingZone.findMany({
    where: { isActive: true },
    include: { methods: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { fee: "asc" }] } },
  });
  const zone = matchShippingZone(zones, dest);
  if (!zone) return [];
  return zone.methods.map((m) => {
    const fee = shippingFee(m, subtotalAfterDiscount, opts);
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      fee: moneyString(fee),
      baseFee: moneyString(m.fee),
      isFree: fee.isZero(),
      estimate: estimateLabel(m.minDays, m.maxDays),
      codAvailable: m.codAvailable,
      zoneName: zone.name,
    };
  });
}

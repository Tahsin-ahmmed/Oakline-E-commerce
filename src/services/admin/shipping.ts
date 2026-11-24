import "server-only";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { moneyString } from "@/lib/money";
import { matchShippingZone } from "@/lib/pricing";
import type { ShippingMethodInput, ShippingZoneInput } from "@/lib/validations/admin/system";
import { getShippingOptions } from "@/services/shipping";
import { getSettings } from "@/services/settings";

export async function listZones() {
  const zones = await prisma.shippingZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      methods: { orderBy: [{ sortOrder: "asc" }, { fee: "asc" }], include: { _count: { select: { orders: true } } } },
    },
  });
  return zones.map((z) => ({
    ...z,
    createdAt: z.createdAt.toISOString(),
    updatedAt: z.updatedAt.toISOString(),
    methods: z.methods.map((m) => ({
      id: m.id,
      zoneId: m.zoneId,
      name: m.name,
      description: m.description,
      fee: moneyString(m.fee),
      freeShippingThreshold: m.freeShippingThreshold ? moneyString(m.freeShippingThreshold) : null,
      minDays: m.minDays,
      maxDays: m.maxDays,
      codAvailable: m.codAvailable,
      isActive: m.isActive,
      sortOrder: m.sortOrder,
      orderCount: m._count.orders,
    })),
  }));
}
export type AdminZone = Awaited<ReturnType<typeof listZones>>[number];

export async function createZone(input: ShippingZoneInput) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.shippingZone.updateMany({ data: { isDefault: false } });
    return tx.shippingZone.create({ data: input });
  });
}

export async function updateZone(id: string, input: ShippingZoneInput) {
  const existing = await prisma.shippingZone.findUnique({ where: { id } });
  if (!existing) throw notFound("Shipping zone not found.");
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.shippingZone.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    return tx.shippingZone.update({ where: { id }, data: input });
  });
}

export async function deleteZone(id: string) {
  const existing = await prisma.shippingZone.findUnique({ where: { id } });
  if (!existing) throw notFound("Shipping zone not found.");
  // Historic orders keep their method name snapshot; their method reference is nulled by the FK.
  await prisma.shippingZone.delete({ where: { id } });
  return existing;
}

function methodData(input: ShippingMethodInput) {
  return {
    zoneId: input.zoneId,
    name: input.name,
    description: input.description || null,
    fee: input.fee,
    freeShippingThreshold: input.freeShippingThreshold,
    minDays: input.minDays,
    maxDays: input.maxDays,
    codAvailable: input.codAvailable,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };
}

export async function createMethod(input: ShippingMethodInput) {
  const zone = await prisma.shippingZone.findUnique({ where: { id: input.zoneId } });
  if (!zone) throw notFound("Shipping zone not found.");
  return prisma.shippingMethod.create({ data: methodData(input) });
}

export async function updateMethod(id: string, input: ShippingMethodInput) {
  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) throw notFound("Delivery method not found.");
  const zone = await prisma.shippingZone.findUnique({ where: { id: input.zoneId } });
  if (!zone) throw notFound("Shipping zone not found.");
  return prisma.shippingMethod.update({ where: { id }, data: methodData(input) });
}

export async function deleteMethod(id: string) {
  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) throw notFound("Delivery method not found.");
  await prisma.shippingMethod.delete({ where: { id } });
  return existing;
}

/** Which zone a destination falls into and what each active method would charge for a given subtotal. */
export async function testDestination(dest: { division: string; district: string; area?: string }, subtotal: number) {
  const [zones, settings] = await Promise.all([
    prisma.shippingZone.findMany({ where: { isActive: true } }),
    getSettings(),
  ]);
  const zone = matchShippingZone(zones, dest);
  const options = await getShippingOptions(dest, subtotal, { storeFreeThreshold: settings.commerce.freeShippingThreshold });
  return {
    zone: zone ? { id: zone.id, name: zone.name, isDefault: zone.isDefault } : null,
    storeFreeThreshold: moneyString(settings.commerce.freeShippingThreshold),
    options,
  };
}

import { route } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { addressSchema } from "@/lib/validations/common";

async function owned(userId: string, id: string) {
  const address = await prisma.address.findFirst({ where: { id, userId } });
  if (!address) throw notFound("Address not found.");
  return address;
}

export const PATCH = route<{ id: string }>({ auth: "user" }, async ({ user, params, json }) => {
  await owned(user!.id, params.id);
  const input = await json(addressSchema);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.address.updateMany({ where: { userId: user!.id }, data: { isDefault: false } });
    return tx.address.update({
      where: { id: params.id },
      data: {
        label: input.label || null,
        fullName: input.fullName,
        phone: input.phone,
        line1: input.line1,
        line2: input.line2 || null,
        area: input.area || null,
        district: input.district,
        division: input.division,
        postalCode: input.postalCode || null,
        ...(input.isDefault ? { isDefault: true } : {}),
      },
    });
  });
});

export const DELETE = route<{ id: string }>({ auth: "user" }, async ({ user, params }) => {
  const address = await owned(user!.id, params.id);
  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: address.id } });
    if (address.isDefault) {
      const next = await tx.address.findFirst({ where: { userId: user!.id }, orderBy: { createdAt: "asc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  return { deleted: true };
});

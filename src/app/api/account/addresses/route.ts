import { route } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/errors";
import { addressSchema } from "@/lib/validations/common";

const MAX_ADDRESSES = 10;

export const GET = route({ auth: "user" }, async ({ user }) =>
  prisma.address.findMany({ where: { userId: user!.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
);

export const POST = route({ auth: "user" }, async ({ user, json }) => {
  const input = await json(addressSchema);
  const count = await prisma.address.count({ where: { userId: user!.id } });
  if (count >= MAX_ADDRESSES) throw badRequest(`You can save up to ${MAX_ADDRESSES} addresses.`);
  const makeDefault = Boolean(input.isDefault) || count === 0;
  return prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { userId: user!.id }, data: { isDefault: false } });
    return tx.address.create({
      data: {
        userId: user!.id,
        label: input.label || null,
        fullName: input.fullName,
        phone: input.phone,
        line1: input.line1,
        line2: input.line2 || null,
        area: input.area || null,
        district: input.district,
        division: input.division,
        postalCode: input.postalCode || null,
        isDefault: makeDefault,
      },
    });
  });
});

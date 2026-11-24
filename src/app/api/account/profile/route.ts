import { route } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validations/auth";

export const GET = route({ auth: "user" }, async ({ user }) => {
  return prisma.user.findUniqueOrThrow({
    where: { id: user!.id },
    select: { id: true, name: true, email: true, phone: true, marketingOptIn: true, emailVerifiedAt: true, createdAt: true },
  });
});

export const PATCH = route({ auth: "user" }, async ({ user, json }) => {
  const input = await json(profileSchema);
  return prisma.user.update({
    where: { id: user!.id },
    data: { name: input.name, phone: input.phone || null, marketingOptIn: input.marketingOptIn ?? undefined },
    select: { id: true, name: true, email: true, phone: true, marketingOptIn: true },
  });
});

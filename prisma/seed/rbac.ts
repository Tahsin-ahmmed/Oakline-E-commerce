import type { PrismaClient } from "../../src/generated/prisma/client";
import { DEFAULT_ROLES, PERMISSIONS, SUPER_ADMIN_ROLE } from "../../src/lib/permissions";
import bcrypt from "bcryptjs";

/** Create/refresh permissions and system roles. Custom role edits by admins are preserved for non-system grants. */
export async function seedRbac(prisma: PrismaClient) {
  for (const [key, meta] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, name: meta.name, group: meta.group },
      update: { name: meta.name, group: meta.group },
    });
  }
  const permissions = await prisma.permission.findMany();
  const byKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const [key, role] of Object.entries(DEFAULT_ROLES)) {
    const existing = await prisma.role.findUnique({ where: { key } });
    const record = await prisma.role.upsert({
      where: { key },
      create: { key, name: role.name, description: role.description, isSystem: true },
      update: { name: role.name, description: role.description, isSystem: true },
    });
    // Only grant defaults to newly created roles (and always keep Super Admin complete).
    if (!existing || key === SUPER_ADMIN_ROLE) {
      await prisma.rolePermission.deleteMany({ where: { roleId: record.id } });
      await prisma.rolePermission.createMany({
        data: role.permissions.map((p) => ({ roleId: record.id, permissionId: byKey.get(p)! })),
        skipDuplicates: true,
      });
    }
  }
}

/** Create or reset the Super Admin account. Credentials always come from the caller (env/CLI), never hardcoded. */
export async function upsertSuperAdmin(
  prisma: PrismaClient,
  input: { email: string; password: string; name: string },
) {
  if (input.password.length < 10) throw new Error("Super Admin password must be at least 10 characters.");
  const email = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const role = await prisma.role.findUniqueOrThrow({ where: { key: SUPER_ADMIN_ROLE } });
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: input.name, passwordHash, isStaff: true, emailVerifiedAt: new Date() },
    update: { passwordHash, isStaff: true, status: "ACTIVE", deletedAt: null },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });
  // Existing sessions are invalidated when credentials are reset.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  return user;
}

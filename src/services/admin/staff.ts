import "server-only";
import { prisma, type Tx } from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { hashPassword } from "@/lib/auth/crypto";
import { revokeUserSessions, type SessionUser } from "@/lib/auth/session";
import { ALL_PERMISSIONS, SUPER_ADMIN_ROLE, type PermissionKey } from "@/lib/permissions";

const staffSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  isStaff: true,
  lastLoginAt: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, key: true, name: true } } } },
} as const;

export async function listStaff() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, OR: [{ isStaff: true }, { roles: { some: {} } }] },
    select: staffSelect,
    orderBy: [{ isStaff: "desc" }, { createdAt: "asc" }],
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status,
    isStaff: u.isStaff,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    roles: u.roles.map((r) => r.role),
  }));
}
export type StaffMember = Awaited<ReturnType<typeof listStaff>>[number];

export async function listRoles() {
  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    include: {
      permissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { users: true } },
    },
  });
  return roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    userCount: r._count.users,
    permissions: r.key === SUPER_ADMIN_ROLE ? [...ALL_PERMISSIONS] : r.permissions.map((p) => p.permission.key),
  }));
}
export type RoleSummary = Awaited<ReturnType<typeof listRoles>>[number];

/** Number of active Super Admins, optionally ignoring one user (to simulate removing them). */
async function activeSuperAdminCount(tx: Tx, excludeUserId?: string) {
  return tx.user.count({
    where: {
      isStaff: true,
      status: "ACTIVE",
      deletedAt: null,
      roles: { some: { role: { key: SUPER_ADMIN_ROLE } } },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

async function resolveRoles(tx: Tx, roleIds: string[]) {
  const roles = await tx.role.findMany({ where: { id: { in: roleIds } } });
  if (roles.length !== new Set(roleIds).size) throw badRequest("One or more selected roles no longer exist.");
  return roles;
}

function isSuper(actor: SessionUser) {
  return actor.roles.includes(SUPER_ADMIN_ROLE);
}

export async function createStaff(input: { name: string; email: string; password: string; roleIds: string[] }, actor: SessionUser) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict(
      existing.isStaff
        ? "A staff account with this email already exists."
        : "A customer account already uses this email. Use a different email for the staff account.",
      { email: ["Email already in use"] },
    );
  }
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const roles = await resolveRoles(tx, input.roleIds);
    if (roles.some((r) => r.key === SUPER_ADMIN_ROLE) && !isSuper(actor)) {
      throw forbidden("Only a Super Admin can grant the Super Admin role.");
    }
    return tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        isStaff: true,
        emailVerifiedAt: new Date(),
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
      select: { id: true, name: true, email: true },
    });
  });
}

export async function updateStaff(
  id: string,
  input: { name?: string; roleIds?: string[]; status?: "ACTIVE" | "BLOCKED" },
  actor: SessionUser,
) {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
    if (!user || user.deletedAt) throw notFound("Staff member not found.");
    const self = user.id === actor.id;
    const wasSuper = user.roles.some((r) => r.role.key === SUPER_ADMIN_ROLE);

    let nextRoles = user.roles.map((r) => r.role);
    if (input.roleIds) {
      nextRoles = await resolveRoles(tx, input.roleIds);
      const willBeSuper = nextRoles.some((r) => r.key === SUPER_ADMIN_ROLE);
      if (willBeSuper !== wasSuper && !isSuper(actor)) throw forbidden("Only a Super Admin can grant or remove the Super Admin role.");
      if (self && wasSuper && !willBeSuper) throw forbidden("You can't remove your own Super Admin role.");
      if (wasSuper && !willBeSuper && (await activeSuperAdminCount(tx, user.id)) === 0) {
        throw badRequest("At least one active Super Admin must remain.");
      }
    }
    if (input.status && input.status !== user.status) {
      if (self) throw forbidden("You can't block your own account.");
      if (wasSuper && !isSuper(actor)) throw forbidden("Only a Super Admin can block another Super Admin.");
      if (input.status === "BLOCKED" && wasSuper && (await activeSuperAdminCount(tx, user.id)) === 0) {
        throw badRequest("At least one active Super Admin must remain.");
      }
    }

    if (input.roleIds) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: nextRoles.map((r) => ({ userId: id, roleId: r.id })) });
    }
    const updated = await tx.user.update({
      where: { id },
      data: { name: input.name ?? undefined, status: input.status ?? undefined, isStaff: true },
      select: { id: true, name: true, email: true, status: true },
    });
    return { updated, blocked: input.status === "BLOCKED" && user.status !== "BLOCKED" };
  });
  if (result.blocked) await revokeUserSessions(id);
  return result.updated;
}

/** Remove staff access (the account remains as a regular customer login). */
export async function deactivateStaff(id: string, actor: SessionUser) {
  if (id === actor.id) throw forbidden("You can't remove your own staff access.");
  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
    if (!user || user.deletedAt) throw notFound("Staff member not found.");
    const wasSuper = user.roles.some((r) => r.role.key === SUPER_ADMIN_ROLE);
    if (wasSuper && !isSuper(actor)) throw forbidden("Only a Super Admin can remove another Super Admin.");
    if (wasSuper && (await activeSuperAdminCount(tx, user.id)) === 0) throw badRequest("At least one active Super Admin must remain.");
    await tx.userRole.deleteMany({ where: { userId: id } });
    return tx.user.update({ where: { id }, data: { isStaff: false }, select: { id: true, name: true, email: true } });
  });
  await revokeUserSessions(id);
  return user;
}

export async function resetStaffPassword(id: string, password: string, actor: SessionUser) {
  const user = await prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
  if (!user || user.deletedAt || !user.isStaff) throw notFound("Staff member not found.");
  if (user.roles.some((r) => r.role.key === SUPER_ADMIN_ROLE) && !isSuper(actor) && user.id !== actor.id) {
    throw forbidden("Only a Super Admin can reset another Super Admin's password.");
  }
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  // Sign the account out everywhere (except the actor's own current session when resetting themselves).
  await revokeUserSessions(id, id === actor.id ? actor.sessionId : undefined);
  return { id: user.id, email: user.email };
}

// ───────────── Roles ─────────────

function roleKeyFromName(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "ROLE";
}

async function setRolePermissions(tx: Tx, roleId: string, keys: PermissionKey[] | string[]) {
  const perms = await tx.permission.findMany({ where: { key: { in: keys as string[] } } });
  await tx.rolePermission.deleteMany({ where: { roleId } });
  if (perms.length) await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })) });
}

export async function createRole(input: { name: string; description?: string; permissions: string[] }, actor: SessionUser) {
  if (input.permissions.includes("staff.manage") && !isSuper(actor)) {
    throw forbidden("Only a Super Admin can grant staff management.");
  }
  let key = roleKeyFromName(input.name);
  if (key === SUPER_ADMIN_ROLE) throw badRequest("That role name is reserved.");
  for (let n = 2; await prisma.role.findUnique({ where: { key } }); n++) key = `${roleKeyFromName(input.name)}_${n}`;
  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({ data: { key, name: input.name, description: input.description || null, isSystem: false } });
    await setRolePermissions(tx, role.id, input.permissions);
    return role;
  });
}

export async function updateRole(
  id: string,
  input: { name?: string; description?: string; permissions?: string[] },
  actor: SessionUser,
) {
  const role = await prisma.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
  if (!role) throw notFound("Role not found.");
  if (role.key === SUPER_ADMIN_ROLE && input.permissions) {
    throw badRequest("Super Admin permissions are locked — the role always has full access.");
  }
  if (input.permissions && !isSuper(actor)) {
    const had = role.permissions.some((p) => p.permission.key === "staff.manage");
    if (had !== input.permissions.includes("staff.manage")) throw forbidden("Only a Super Admin can change staff management access.");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.role.update({
      where: { id },
      data: { name: input.name ?? undefined, description: input.description === undefined ? undefined : input.description || null },
    });
    if (input.permissions) await setRolePermissions(tx, id, input.permissions);
    return updated;
  });
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role) throw notFound("Role not found.");
  if (role.isSystem) throw badRequest("System roles can't be deleted. Edit their permissions instead.");
  if (role._count.users > 0) throw badRequest(`Unassign this role from ${role._count.users} staff member(s) before deleting it.`);
  await prisma.role.delete({ where: { id } });
  return role;
}

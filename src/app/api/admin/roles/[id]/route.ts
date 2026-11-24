import { route } from "@/lib/api";
import { roleUpdateSchema } from "@/lib/validations/admin/system";
import { deleteRole, updateRole } from "@/services/admin/staff";
import { logActivity } from "@/services/audit";

export const PATCH = route<{ id: string }>({ auth: "staff", permission: "staff.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(roleUpdateSchema);
  const role = await updateRole(params.id, input, user!);
  await logActivity({
    user,
    ip,
    action: "role.update",
    entityType: "Role",
    entityId: role.id,
    summary: `Updated role “${role.name}”`,
    metadata: input.permissions ? { permissions: input.permissions } : undefined,
  });
  return role;
});

export const DELETE = route<{ id: string }>({ auth: "staff", permission: "staff.manage" }, async ({ params, user, ip }) => {
  const role = await deleteRole(params.id);
  await logActivity({ user, ip, action: "role.delete", entityType: "Role", entityId: role.id, summary: `Deleted role “${role.name}”` });
  return { deleted: true };
});

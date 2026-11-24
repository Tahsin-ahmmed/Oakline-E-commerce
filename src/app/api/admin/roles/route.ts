import { route } from "@/lib/api";
import { roleSchema } from "@/lib/validations/admin/system";
import { createRole, listRoles } from "@/services/admin/staff";
import { logActivity } from "@/services/audit";

export const GET = route({ auth: "staff", permission: "staff.manage" }, async () => listRoles());

export const POST = route({ auth: "staff", permission: "staff.manage" }, async ({ json, user, ip }) => {
  const input = await json(roleSchema);
  const role = await createRole({ name: input.name, description: input.description || undefined, permissions: input.permissions }, user!);
  await logActivity({ user, ip, action: "role.create", entityType: "Role", entityId: role.id, summary: `Created role “${role.name}”`, metadata: { permissions: input.permissions } });
  return role;
});

import { route } from "@/lib/api";
import { createStaffSchema } from "@/lib/validations/admin/system";
import { createStaff, listStaff } from "@/services/admin/staff";
import { logActivity } from "@/services/audit";

export const GET = route({ auth: "staff", permission: "staff.manage" }, async () => listStaff());

export const POST = route({ auth: "staff", permission: "staff.manage" }, async ({ json, user, ip }) => {
  const input = await json(createStaffSchema);
  const created = await createStaff(input, user!);
  await logActivity({
    user,
    ip,
    action: "staff.create",
    entityType: "User",
    entityId: created.id,
    summary: `Created staff account ${created.email}`,
    metadata: { roleIds: input.roleIds },
  });
  return created;
});

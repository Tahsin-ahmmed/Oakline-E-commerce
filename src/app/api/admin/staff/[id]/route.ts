import { route } from "@/lib/api";
import { updateStaffSchema } from "@/lib/validations/admin/system";
import { deactivateStaff, updateStaff } from "@/services/admin/staff";
import { logActivity } from "@/services/audit";

export const PATCH = route<{ id: string }>({ auth: "staff", permission: "staff.manage" }, async ({ params, json, user, ip }) => {
  const input = await json(updateStaffSchema);
  const updated = await updateStaff(params.id, input, user!);
  await logActivity({
    user,
    ip,
    action: input.status ? `staff.${input.status === "BLOCKED" ? "block" : "unblock"}` : "staff.update",
    entityType: "User",
    entityId: updated.id,
    summary: `Updated staff account ${updated.email}`,
    metadata: { roleIds: input.roleIds, status: input.status, nameChanged: Boolean(input.name) },
  });
  return updated;
});

/** DELETE removes staff access (roles + staff flag) and signs the account out everywhere. */
export const DELETE = route<{ id: string }>({ auth: "staff", permission: "staff.manage" }, async ({ params, user, ip }) => {
  const removed = await deactivateStaff(params.id, user!);
  await logActivity({ user, ip, action: "staff.deactivate", entityType: "User", entityId: removed.id, summary: `Removed staff access for ${removed.email}` });
  return { deactivated: true };
});

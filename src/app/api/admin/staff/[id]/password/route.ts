import { route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { resetStaffPasswordSchema } from "@/lib/validations/admin/system";
import { resetStaffPassword } from "@/services/admin/staff";
import { logActivity } from "@/services/audit";

export const POST = route<{ id: string }>(
  { auth: "staff", permission: "staff.manage", rateLimit: RATE_LIMITS.passwordReset, rateLimitBy: "user" },
  async ({ params, json, user, ip }) => {
    const { password } = await json(resetStaffPasswordSchema);
    const target = await resetStaffPassword(params.id, password, user!);
    await logActivity({ user, ip, action: "staff.password_reset", entityType: "User", entityId: target.id, summary: `Reset password for ${target.email}` });
    return { reset: true };
  },
);

import { route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validations/auth";
import { changePassword } from "@/services/auth";

export const POST = route({ auth: "user", rateLimit: RATE_LIMITS.login, rateLimitBy: "user" }, async ({ user, json }) => {
  const input = await json(changePasswordSchema);
  await changePassword(user!.id, user!.sessionId, input.currentPassword, input.newPassword);
  return { message: "Password updated. Other devices have been signed out." };
});

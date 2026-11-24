import { route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { resetPassword } from "@/services/auth";

export const POST = route({ auth: "none", rateLimit: RATE_LIMITS.passwordReset }, async ({ json }) => {
  const input = await json(resetPasswordSchema);
  await resetPassword(input.token, input.password);
  return { message: "Your password has been updated. Please sign in." };
});

import { route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/services/auth";

// Always returns the same response so attackers cannot discover which emails have accounts.
export const POST = route({ auth: "none", rateLimit: RATE_LIMITS.passwordReset }, async ({ json }) => {
  const { email } = await json(forgotPasswordSchema);
  await requestPasswordReset(email);
  return { message: "If an account exists for that email, a reset link is on its way." };
});

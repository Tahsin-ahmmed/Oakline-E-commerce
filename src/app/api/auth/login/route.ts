import { route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validations/auth";
import { login } from "@/services/auth";

export const POST = route({ auth: "none", rateLimit: RATE_LIMITS.login }, async ({ json }) => {
  const input = await json(loginSchema);
  return login(input.email, input.password);
});

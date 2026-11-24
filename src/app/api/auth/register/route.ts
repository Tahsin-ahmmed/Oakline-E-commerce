import { route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validations/auth";
import { registerCustomer } from "@/services/auth";

export const POST = route({ auth: "none", rateLimit: RATE_LIMITS.register }, async ({ json }) => {
  const input = await json(registerSchema);
  return registerCustomer(input);
});

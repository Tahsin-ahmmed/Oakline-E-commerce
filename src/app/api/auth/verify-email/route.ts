import { z } from "zod";
import { route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { verifyEmail } from "@/services/auth";

export const POST = route({ auth: "none", rateLimit: RATE_LIMITS.passwordReset }, async ({ json }) => {
  const { token } = await json(z.object({ token: z.string().min(20).max(200) }));
  await verifyEmail(token);
  return { verified: true };
});

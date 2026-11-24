import { route } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/services/auth";

export const POST = route(
  { auth: "user", rateLimit: RATE_LIMITS.passwordReset, rateLimitBy: "user" },
  async ({ user }) => {
    if (user!.emailVerified) return { alreadyVerified: true };
    await sendVerificationEmail({ id: user!.id, name: user!.name, email: user!.email });
    return { sent: true };
  },
);

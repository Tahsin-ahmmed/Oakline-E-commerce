import { z } from "zod";
import { route } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { email } from "@/lib/validations/common";

export const POST = route({ auth: "none", rateLimit: RATE_LIMITS.newsletter }, async ({ json }) => {
  const input = await json(z.object({ email, source: z.string().max(40).optional() }));
  await prisma.newsletterSubscriber.upsert({
    where: { email: input.email },
    create: { email: input.email, source: input.source ?? "website" },
    update: { status: "SUBSCRIBED", unsubscribedAt: null },
  });
  return { message: "Thank you — you're on the list." };
});

/** DELETE /api/newsletter?token= — one-click unsubscribe from email footers. */
export const DELETE = route({ auth: "none", skipCsrf: true }, async ({ query }) => {
  const { token } = query(z.object({ token: z.string().min(10).max(40) }));
  await prisma.newsletterSubscriber.updateMany({
    where: { unsubscribeToken: token },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
  });
  return { unsubscribed: true };
});

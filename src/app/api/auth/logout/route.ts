import { route } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";

export const POST = route({ auth: "none" }, async () => {
  await destroySession();
  return { signedOut: true };
});

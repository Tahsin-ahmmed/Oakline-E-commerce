/** Only allow same-site relative redirect targets (prevents open redirects via ?next=). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/login") || next.startsWith("/register")) return null;
  return next.slice(0, 500);
}

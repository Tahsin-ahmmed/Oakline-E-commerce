import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

/** For customer pages: redirect to login when signed out. */
export async function requireUser(nextPath: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** For admin pages: requires a staff account, and optionally a specific permission. */
export async function requireStaff(permission?: PermissionKey, nextPath = "/admin"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!user.isStaff) redirect("/");
  if (permission && !hasPermission(user, permission)) redirect("/admin/forbidden");
  return user;
}

export function can(user: SessionUser | null, permission: PermissionKey) {
  return hasPermission(user, permission);
}

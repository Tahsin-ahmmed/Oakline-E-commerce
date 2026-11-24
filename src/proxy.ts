import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "oak_session";

/**
 * Fast, coarse gate: visitors without a session cookie are redirected to sign in before
 * protected pages render. Real authentication and permission checks happen on the server
 * (layouts via requireUser/requireStaff, and every API route via the `route()` wrapper).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession && (pathname.startsWith("/admin") || pathname.startsWith("/account"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};

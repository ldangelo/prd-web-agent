/**
 * Next.js middleware for route protection.
 *
 * Uses next-auth v5's auth() as a middleware wrapper to check
 * authentication on every matching request. Unauthenticated users
 * are redirected to the /login page.
 *
 * Public routes (login, auth callbacks, health check, static assets)
 * are excluded via the matcher configuration.
 */
import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;

  // Allow public paths through without authentication
  const publicPaths = ["/login", "/api/auth", "/api/health"];
  const isPublic = publicPaths.some((path) =>
    nextUrl.pathname.startsWith(path),
  );

  if (isPublic) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to the login page
  if (!req.auth) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

/**
 * Match all routes except static assets and Next.js internals.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

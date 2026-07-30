import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// IMPORTANT: Do NOT import from @/lib/auth or @/lib/prisma here.
// Middleware runs at the edge and cannot use Node.js pg Pool.
// We only do cookie-presence checking. Authoritative RBAC happens in RSC/Server Actions.

const PROTECTED_PREFIXES = ["/dashboard", "/snippets/new", "/collections"];
const ADMIN_PREFIXES = ["/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionCookie =
    req.cookies.get("authjs.session-token") ??
    req.cookies.get("__Secure-authjs.session-token");

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdmin = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  if ((isProtected || isAdmin) && !sessionCookie) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/snippets/new",
    "/collections/:path*",
    "/admin/:path*",
  ],
};

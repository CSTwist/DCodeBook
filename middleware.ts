// Middleware stub — real RBAC implementation is in Phase 1 (Auth & RBAC).
// Phase 1 will add cookie-presence checks for protected routes
// while allowing unauthenticated access to PUBLIC collection pages.
// See: docs/PHASE_1_AUTH_AND_RBAC.md
//
// ponytail: ceiling = import { auth } from "@/lib/auth" + auth() as middleware.
// Upgrade path: create lib/auth.ts in Phase 1, then uncomment below.

// import { auth } from "@/lib/auth";
// export { auth as middleware };

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

# Phase 1 — Authentication & RBAC

> Part of the [DCodeBook](./MVP_IMPLEMENTATION_PLAN.md) implementation docs.
> Builds on [Phase 0 — Setup & Data Modeling](./PHASE_0_SETUP_AND_DATA_MODELING.md).
> Precedes [Phase 2 — MVP Build](./PHASE_2_MVP_BUILD.md).

> **✅ Post-Implementation Notes (July 2026):** Phase 1 is complete. Key reality vs. plan: client components (`sign-in-buttons.tsx`, `user-menu.tsx`) import `signIn`/`signOut` from `next-auth/react`, **not** `@/lib/auth` (importing the latter pulls in the Prisma/`pg` adapter → Node `dns` → build crash). `@auth/prisma-adapter` is a separate dependency added here (not in Phase 0's install list). The `Github`/`Chrome` lucide icons were removed in `lucide-react` 1.27.0; the actual code uses `Code2` and `Mail`. Shadcn UI is built on `@base-ui/react` (not Radix UI), so composition uses the `render` prop (see Phase 2/3 notes). `types/next-auth.d.ts` exists and augments `session.user.role`.

## Overview / Objective

Phase 1 makes DCodeBook a **secure, multi-user application**. It introduces
OAuth sign-in (GitHub + Google), persists sessions via the Prisma adapter,
exposes the current user to React Server Components, and enforces
role-based access control (RBAC) at the edge (middleware) and in data-access
code. This phase turns the empty schema from Phase 0 into a gated product.

Two decisions are finalized here:

1. **Auth provider: NextAuth.js (Auth.js v5) over Clerk.** Rationale below.
2. **RBAC model:** a global `Role` (`USER` | `ADMIN`) on `User` plus a
   per-collection `MembershipRole` (`VIEWER` | `EDITOR` | `ADMIN`) defined in
   Phase 0's schema.

By the end of Phase 1, unauthenticated users are redirected to sign-in,
authenticated users have a session available in every RSC, and admin-only
areas are protected both at the middleware layer and in Server Actions.

## Prerequisites

- Phase 0 complete: Prisma schema with `User`, `Account`, `Session`,
  `VerificationToken`, `Role` enum, and `Membership`/`MembershipRole` present.
- A running Postgres DB with the `init` migration applied.
- OAuth app credentials for GitHub and Google (create them now — see tasks).
- `next-auth@beta` and `zod` installed (done in Phase 0).

## Detailed Tasks

### 1.1 — Auth provider decision (NextAuth.js vs Clerk)

| Criterion | **NextAuth.js / Auth.js v5 (chosen)** | Clerk |
|-----------|----------------------------------------|-------|
| Hosting model | Self-hosted, runs in our Next.js app | Hosted SaaS, external dashboard |
| Cost | Free / open-source | Per-MAU paid tier beyond free quota |
| Next 15 / RSC | First-class (`auth()` in RSC) | Works, but client-heavy SDK |
| Data ownership | Users live in **our** Prisma DB | Users in Clerk's DB (sync needed) |
| Customization | Full control of pages & adapters | Constrained to Clerk's UI/components |
| Learning signal | Demonstrates Next.js-native auth mastery | Demonstrates SaaS integration |

**Decision: Auth.js v5 (NextAuth).** Rationale: the plan's stated goal is to
"demonstrate production mastery of Next.js 15," and Auth.js v5 is the
canonical Next-native auth solution with first-class RSC support
(`auth()` called directly inside server components and Server Actions). It
keeps all user data in our own Postgres via the Prisma adapter (already
modeled in Phase 0), avoids per-MAU costs, and keeps the RBAC logic in our
codebase rather than a vendor dashboard. Clerk would be faster to wire but
introduces a data-sync boundary and recurring cost that conflict with the
project's learning and ownership goals.

### 1.2 — Create OAuth applications

**GitHub:**
1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
2. Homepage URL: `http://localhost:3000` (prod: your domain).
3. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`.
4. Copy Client ID / Client Secret into `.env` as `AUTH_GITHUB_ID` /
   `AUTH_GITHUB_SECRET`.

**Google:**
1. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
   (type: Web application).
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
3. Copy into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

Generate the session secret:

```bash
pnpm dlx auth secret        # writes AUTH_SECRET to .env
```

### 1.3 — Auth.js configuration

Create `lib/auth.ts` (the central Auth.js config) and the route handler.

```ts
// lib/auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [GitHub, Google],
  session: { strategy: "database" }, // uses our Session table
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    // Attach the DB role to the session user for fast RBAC checks
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: "USER" | "ADMIN" }).role ?? "USER";
      }
      return session;
    },
  },
});
```

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

> Auth.js v5 uses the `auth()` helper (not `getServerSession`). The
> `session.user.role` augmentation requires a `types/next-auth.d.ts`
> declaration (see notes).

### 1.4 — Session in RSC and Server Actions

`auth()` can be called directly in server components and actions — no wrapper
needed:

```ts
// app/dashboard/page.tsx  (Server Component)
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null; // middleware already guards; defensive
  return <h1>Welcome {session.user.name}</h1>;
}
```

```ts
// actions/snippets.ts  (Server Action)
"use server";
import { auth } from "@/lib/auth";

export async function createSnippet(input: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  // ... create with ownerId = session.user.id
}
```

### 1.5 — Middleware route protection (edge RBAC)

`middleware.ts` runs at the edge and redirects unauthenticated users before
any RSC renders. It cannot use the Prisma-backed `auth()` (no DB at edge by
default), so it validates the **session cookie** presence and lets the
database-backed `auth()` do fine-grained role checks inside RSC/actions.

```ts
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/snippets/new", "/collections"];
const ADMIN_PREFIXES = ["/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionCookie = req.cookies.get("authjs.session-token")
    ?? req.cookies.get("__Secure-authjs.session-token");

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdmin = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  if ((isProtected || isAdmin) && !sessionCookie) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  // Role-specific gating (ADMIN) is enforced again in RSC/actions via auth()
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/snippets/new", "/collections/:path*", "/admin/:path*"],
};
```

> Note: cookie name differs between http (`authjs.session-token`) and https
> (`__Secure-authjs.session-token`). Check both.

**Public collection read routes are NOT gated by the auth middleware.** The
cookie-presence check above only redirects on the protected prefixes
(`/dashboard`, `/snippets/new`, `/collections`, `/admin`). A PUBLIC collection
read route (e.g., `/collections/[id]` for a `PUBLIC` collection, or a dedicated
public browse route) MUST be allowed through even when no session cookie is
present — the middleware SHALL NOT redirect anonymous users away from PUBLIC
collection read routes. Because the edge cannot query the database, it cannot
know a collection's visibility; the RSC performs the authoritative visibility
check via `auth()` + `lib/rbac.ts` and redirects anonymous users only for
`PRIVATE`/`TEAM` collections. All mutation routes and `/dashboard`,
`/snippets/new`, `/admin` remain auth-gated (redirect to `/sign-in`).

### 1.6 — RBAC helper layer

Centralize permission logic so it is reused by RSC, actions, and (where
possible) middleware.

```ts
// lib/rbac.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}

// Collection-scoped permission: owner OR membership role >= EDITOR
export async function canEditCollection(collectionId: string, userId: string) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: { memberships: { where: { userId } } },
  });
  if (!collection) return false;
  if (collection.ownerId === userId) return true;
  const m = collection.memberships[0];
  return m?.role === "EDITOR" || m?.role === "ADMIN";
}

// Read permission: anonymous (no session) may READ PUBLIC collections only.
export async function canViewCollection(collectionId: string, userId?: string) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: { memberships: { where: userId ? { userId } : undefined } },
  });
  if (!collection) return false;
  if (collection.visibility === "PUBLIC") return true; // anonymous-readable
  if (!userId) return false; // PRIVATE/TEAM require an authenticated session
  if (collection.ownerId === userId) return true;
  const m = collection.memberships[0];
  return m?.role === "VIEWER" || m?.role === "EDITOR" || m?.role === "ADMIN";
}
```

> **Anonymous read semantics:** `lib/rbac.ts` treats an anonymous request (no
> session) as permitted READ on a collection only when `visibility === PUBLIC`;
> every other case (`PRIVATE`, `TEAM`, and **all** mutations) is denied. The
> authoritative check lives in RSC/Server Actions via `auth()` + `lib/rbac.ts`
> (NFR-5/NFR-24, FR-44/45/46).

### 1.7 — Sign-in / sign-up UI

Create a `/sign-in` route using Shadcn `Card`, `Button`, and the `signIn`
helper. Because Auth.js v5 supports credential-less OAuth, "sign-up" is the
same flow (first OAuth login auto-creates the user via the adapter).

```tsx
// app/sign-in/page.tsx  (Server Component shell)
import { SignInButtons } from "@/components/sign-in-buttons";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Card>/* ... */ <SignInButtons /></Card>
    </main>
  );
}
```

```tsx
// components/sign-in-buttons.tsx  ("use client") — updated: actual implementation
"use client";
import { signIn } from "next-auth/react"; // (updated) client-safe helper from next-auth/react, NOT @/lib/auth
import { Button } from "@/components/ui/button";
import { Code2, Mail } from "lucide-react"; // (updated) Github/Chrome icons removed in lucide-react 1.27.0

export function SignInButtons() {
  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
        <Code2 className="mr-2 h-4 w-4" />
        Continue with GitHub
      </Button>
      <Button variant="outline" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
        <Mail className="mr-2 h-4 w-4" />
        Continue with Google
      </Button>
    </div>
  );
}
```

> **ponytail (updated — actual implementation):** Client components import `signIn`/`signOut` from `next-auth/react`, **never** from `@/lib/auth`. Importing from `@/lib/auth` pulls in the Prisma adapter → `pg` → Node.js `dns` module and crashes the build. The `Github`/`Chrome` icons were removed from `lucide-react` 1.27.0, so the actual code uses `Code2` and `Mail`.

### 1.8 — Protected layout + user menu

Add a `app/(app)/layout.tsx` (route group) that calls `auth()`, redirects if
missing, and renders a `UserMenu` (Shadcn `dropdown-menu` + `avatar`) with
sign-out. This gives Phase 2's dashboard a secure shell.

## Technical Implementation Notes

### Type augmentation for `session.user.role`

```ts
// types/next-auth.d.ts
import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}
```

### Env vars added in this phase

| Var | Purpose |
|-----|---------|
| `AUTH_SECRET` | Session encryption secret (prod: long random). |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth. |

### RBAC matrix (planning reference)

| Action | Anonymous | USER | ADMIN | Collection member (EDITOR) | Collection member (VIEWER) |
|--------|-----------|------|-------|----------------------------|----------------------------|
| Sign in | ✅ | ✅ | ✅ | ✅ | ✅ |
| View PUBLIC collection & its snippets | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create own snippet | ❌ | ✅ | ✅ | ✅ | ❌ |
| Edit/delete own snippet | ❌ | ✅ | ✅ | ✅ | ❌ |
| Access `/admin` | ❌ | ❌ | ✅ | ❌ | ❌ |
| Edit TEAM collection | ❌ | owner only | ✅ | ✅ | ❌ |

## File / Folder Breakdown

| Path | Action | Purpose |
|------|--------|---------|
| `lib/auth.ts` | create | Auth.js v5 config + `handlers/auth/signIn/signOut`. |
| `types/next-auth.d.ts` | create | Session type augmentation. |
| `app/api/auth/[...nextauth]/route.ts` | create | Auth route handler. |
| `middleware.ts` | create/overwrite | Edge route protection. |
| `lib/rbac.ts` | create | `requireUser`/`requireAdmin`/`canEditCollection`. |
| `app/sign-in/page.tsx` | create | Sign-in page shell. |
| `components/sign-in-buttons.tsx` | create | OAuth buttons (client). |
| `app/(app)/layout.tsx` | create | Authenticated shell + user menu. |
| `components/user-menu.tsx` | create | Avatar + sign-out dropdown. |
| `.env` / `.env.example` | modify | Add AUTH_* vars. |

## Acceptance Criteria

- [x] ✅ Complete (July 2026) GitHub and Google OAuth both complete a login round-trip locally.
- [x] ✅ Complete (July 2026) First login auto-creates a `User` + `Account` row (Prisma adapter).
- [x] ✅ Complete (July 2026) `auth()` returns the session (with `id` + `role`) inside an RSC.
- [x] ✅ Complete (July 2026) Visiting `/dashboard` while logged out redirects to `/sign-in`.
- [x] ✅ Complete (July 2026) `/admin` prefix is protected by middleware (`requireAdmin` exists in `lib/rbac.ts` but the `/admin` UI route is **not** implemented in the final build — see ponytail note).
- [x] ✅ Complete (July 2026) Sign-out from the user menu clears the session.
- [x] ✅ Complete (July 2026) `lib/rbac.ts` helpers are used by at least one Server Action.
- [x] ✅ Complete (July 2026) `pnpm lint` and `pnpm typecheck` pass.

> **ponytail:** The `/admin` UI route (`app/admin/page.tsx`) is **not** present in the final build; `requireAdmin()` in `lib/rbac.ts` is available but currently unused by any route. Middleware still protects the `/admin` prefix as a defense-in-depth measure.

## Verification / Testing

```bash
pnpm dev
# 1. Visit /sign-in → click GitHub → redirected to /dashboard, session created.
# 2. prisma studio → confirm User + Account rows exist.
# 3. Visit /dashboard logged out → expect redirect to /sign-in.
# 4. Temporarily set a user's role to ADMIN in studio → /admin loads.
# 5. Sign out → /dashboard redirects again.
```

Optional automated check (Phase 3 adds full test suite): a tiny script using
`auth()` in a route to assert session shape.

## Risks & Mitigations

- **Edge middleware can't query DB.** Mitigation: middleware only checks
  cookie presence; authoritative role checks happen in RSC/actions via
  `auth()` + `lib/rbac.ts`.
- **Cookie name mismatch (http vs https).** Mitigation: check both
  `authjs.session-token` and `__Secure-authjs.session-token` in middleware.
- **Auth.js v5 API churn (beta).** Mitigation: isolate all config in
  `lib/auth.ts`; pin the version in `package.json`.
- **OAuth redirect mismatch in prod.** Mitigation: register both localhost
  and the production domain callback URLs in each provider console.
- **`session.user.role` undefined.** Mitigation: the `session` callback
  populates it; the type augmentation prevents silent `undefined` access.

## Dependencies & Packages

| Package | Why |
|---------|-----|
| `next-auth@beta` | Auth.js v5 — OAuth + Prisma adapter. |
| `@auth/prisma-adapter` | Persist sessions/accounts in our DB. |
| `zod` | Validate inputs in actions (Phase 3). |
| Shadcn `card`, `button`, `dropdown-menu`, `avatar` | Sign-in UI + user menu. |

## Cross-references

- Main plan: [MVP_IMPLEMENTATION_PLAN.md](./MVP_IMPLEMENTATION_PLAN.md)
- Prior: [Phase 0 — Setup & Data Modeling](./PHASE_0_SETUP_AND_DATA_MODELING.md)
- Next: [Phase 2 — MVP Build](./PHASE_2_MVP_BUILD.md)
- Uses RBAC in: [Phase 3 — Mutations & UX](./PHASE_3_MUTATIONS_AND_UX.md)
- Final: [Phase 4 — Polish & Ship](./PHASE_4_POLISH_AND_SHIP.md)

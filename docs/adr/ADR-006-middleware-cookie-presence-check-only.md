# ADR-006: Middleware cookie-presence check only

- **Status:** Accepted
- **Date:** 2026-07-30
- **Decision Maker:** Chakinzo Sombito (project owner)
- **References:**
  - `../../IMPLEMENTATION_PLAN.md` §4 (Architecture — RBAC via middleware cookie-presence check only; PUBLIC read routes NOT gated)
  - `./PHASE_1_AUTH_AND_RBAC.md` §1.5 (Middleware route protection — edge RBAC), §1.6 (RBAC helper layer)
  - `../SRS.md` §2.5 (Design & Implementation Constraints — Edge middleware cannot query the database), FR-6, FR-27, AR-3, AR-4, NFR-5, Appendix A (R-5)

## Context

DCodeBook enforces RBAC at two layers: an edge `middleware.ts` that runs before
any page renders, and authoritative checks inside RSC/Server Actions. The edge
runtime, however, has a hard constraint: **it cannot query the database**
(Prisma/Postgres are not available at the edge by default). This means
middleware cannot know a user's role, membership, or a collection's visibility —
it can only inspect what is present in the request (cookies).

The design had to decide exactly how much authorization middleware should
attempt at the edge, given that it cannot do fine-grained checks, while still
protecting protected routes and not breaking anonymous reads of `PUBLIC`
collections (see ADR-005).

## Decision

**`middleware.ts` performs a cookie-presence check ONLY.**

- It checks for the presence of the Auth.js session cookie — `authjs.session-token`
  (http) or `__Secure-authjs.session-token` (https) — and redirects
  unauthenticated users to `/sign-in` (preserving `callbackUrl`) **only** on
  protected route prefixes: `PROTECTED_PREFIXES = ["/dashboard", "/snippets/new",
  "/collections"]` and `ADMIN_PREFIXES = ["/admin"]` (matcher:
  `/dashboard/:path*`, `/snippets/new`, `/collections/:path*`, `/admin/:path*`).
- It does **NOT** perform any database or role queries at the edge.
- **PUBLIC collection read routes are NOT gated by middleware.** Because the
  edge cannot query the database to learn a collection's visibility, middleware
  must allow anonymous users through to `PUBLIC` collection read routes (e.g.,
  `/collections/[id]` for a `PUBLIC` collection, or a public browse route). The
  authoritative visibility check happens in the RSC via `auth()` +
  `lib/rbac.ts` (`canViewCollection`), which redirects anonymous users only for
  `PRIVATE`/`TEAM` collections.
- Authoritative role/membership enforcement (`requireUser`, `requireAdmin`,
  `canEditCollection`, `canViewCollection`) occurs in RSC/Server Actions via
  `auth()` + `lib/rbac.ts`. Middleware is a coarse first gate; RSC/actions are
  the source of truth.

## Consequences

**Positive:**
- Respects the edge runtime constraint: middleware never attempts a DB query it
  cannot make, avoiding runtime failures and cold-start/connection issues at the
  edge (R-5).
- Protects the high-value protected routes (`/dashboard`, `/snippets/new`,
  `/collections`, `/admin`) by redirecting anonymous users before any RSC
  renders, improving both security and UX (no flash of protected content).
- Correctly permits anonymous reads of `PUBLIC` collections (ADR-005) because
  those read routes are explicitly excluded from middleware gating; the
  fine-grained visibility decision is delegated to the RSC where the database
  is available.
- Defense in depth: even if middleware is bypassed or misconfigured, the
  authoritative `auth()` + `lib/rbac.ts` checks in RSC/Server Actions still
  enforce authorization (NFR-5, FR-27/28).

**Negative:**
- Middleware alone is insufficient for authorization — it can only confirm
  "a session cookie exists," not "this user is allowed here." This is accepted
  and by design; the real enforcement is in RSC/actions. Developers must
  remember not to treat middleware as authoritative (documented in FR-27 and
  the phase docs).
- Cookie-name handling must check both http and https variants (AR-3) to avoid
  false negatives.

**Neutral:**
- The set of protected prefixes and the matcher are explicit and stable; adding
  new protected routes requires updating `PROTECTED_PREFIXES`/`ADMIN_PREFIXES`
  and the matcher.

## Alternatives Considered

- **Perform full role/membership/visibility checks in middleware (rejected):**
  Impossible at the edge without DB access, and would require either moving DB
  logic to the edge (breaking the serverless/edge model and adding latency) or
  accepting that middleware cannot enforce it. Rejected because it violates the
  hard edge constraint (SRS §2.5, R-5).
- **Gate ALL routes (including PUBLIC reads) by cookie presence in middleware
  (rejected):** Would redirect anonymous users away from `PUBLIC` collection
  read routes, directly contradicting ADR-005 (public sharing/discovery).
  Rejected because the edge cannot know visibility and must defer that decision
  to the RSC.
- **Skip middleware entirely and rely only on RSC/action checks (rejected):**
  Would let anonymous users hit protected route shells before being redirected
  in the RSC, a worse UX and a weaker first line of defense. The cookie-presence
  check is a cheap, valuable coarse gate.

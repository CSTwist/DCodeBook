# ADR-001: Use Auth.js v5 over Clerk

- **Status:** Accepted
- **Date:** 2026-07-30
- **Decision Maker:** Chakinzo Sombito (project owner)
- **References:**
  - `../../IMPLEMENTATION_PLAN.md` §3 (Tech Stack — Auth), §9 (Risks & Open Decisions — Auth provider)
  - `./PHASE_1_AUTH_AND_RBAC.md` §1.1 (Auth provider decision), §1.3 (Auth.js configuration), §1.4 (Session in RSC/Server Actions)
  - `../SRS.md` §1.3 (Definitions: MAU, Prisma Adapter), §2.5 (Design & Implementation Constraints — Auth.js v5 is beta), §3.5.1 (AR-1, AR-2), Appendix A (R-1)

## Context

DCodeBook needs OAuth authentication (GitHub + Google) for a multi-user
knowledge base. The project's stated goal is to "demonstrate production mastery
of Next.js 15 (App Router, RSC, Server Actions)" and to ship a self-contained
SaaS-style product where DCodeBook remains the system of record for `User` data.

Two viable authentication approaches were on the table:

- **Auth.js v5 (NextAuth.js)** — a self-hosted, open-source auth library that
  runs inside our own Next.js app and persists users/accounts/sessions in our
  Postgres via the `@auth/prisma-adapter`.
- **Clerk** — a hosted, managed auth SaaS with its own dashboard, UI components,
  and a per-MAU (Monthly Active Users) pricing model.

The decision had to satisfy the learning/ownership goals, keep data in our own
database, avoid recurring per-user costs, and integrate cleanly with the
RSC-first architecture. A known constraint is that Auth.js v5 is in beta
(`next-auth@beta`), which introduces some API-churn risk.

## Decision

**Use Auth.js v5 (NextAuth.js) with the Prisma adapter, over Clerk.**

- Providers: GitHub and Google OAuth.
- Session strategy: `database` (persists to the `Session` table via the Prisma
  adapter), not JWT-only.
- All Auth.js configuration is isolated in `lib/auth.ts`; the
  `session.user.role` augmentation lives in `types/next-auth.d.ts` so a future
  swap (e.g., to Clerk) is localized.
- The version is pinned in `package.json` to limit churn.

Clerk remains a recognized alternative but was not chosen.

## Consequences

**Positive:**
- Self-hosted: all user data lives in our own Postgres via the Prisma adapter;
  no third-party auth vendor holds our users.
- No per-MAU cost — avoids the recurring billing model of hosted auth (see
  `MAU` in SRS §1.3).
- First-class Next.js 15 / RSC support: `auth()` is called directly inside
  Server Components and Server Actions, keeping RBAC logic in our codebase
  rather than a vendor dashboard.
- Full control over sign-in pages, adapters, and callbacks; demonstrates
  Next-native auth mastery (a core project goal).

**Negative:**
- Auth.js v5 is beta (`next-auth@beta`); API surface may change between
  releases. Mitigated by isolating config in `lib/auth.ts` and pinning the
  version (SRS §2.5, R-1).
- More implementation work than a hosted solution (we build the session
  handling, RBAC helpers, and sign-in UI ourselves).

**Neutral:**
- Both options support GitHub + Google OAuth and would satisfy the functional
  requirement; the choice does not change the data model or the rest of the
  stack.

## Alternatives Considered

- **Clerk (rejected):** Faster to wire up and provides a polished hosted UI, but
  introduces a data-sync boundary (users live in Clerk's DB, not ours), a
  recurring per-MAU cost, a client-heavy SDK that conflicts with the
  RSC-first/minimal-client-JS architecture, and less control over auth pages
  and RBAC logic. These conflict with the project's learning, ownership, and
  cost goals. Clerk is explicitly noted as the alternative in the plan (§9) and
  remains a valid future swap if requirements change.

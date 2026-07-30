# ADR-003: Use Neon over Supabase for managed Postgres

- **Status:** Accepted
- **Date:** 2026-07-30
- **Decision Maker:** Chakinzo Sombito (project owner)
- **References:**
  - `../MVP_IMPLEMENTATION_PLAN.md` §3 (Tech Stack — Database: "PostgreSQL (Supabase or Neon)"), §2.4 (Operating Environment — Neon soft-preferred)
  - `../PHASE_0_SETUP_AND_DATA_MODELING.md` §0.4 (Database provider decision — Neon vs Supabase)
  - `../SRS.md` §1.3 (Definitions: Neon / Supabase — "Neon is soft-preferred"), §2.4 (Operating Environment), NFR-16, NFR-11, Appendix A (R-4)
  - `../PHASE_4_POLISH_AND_SHIP.md` §4.6 (Production environment & deploy — Vercel + Neon)

## Context

DCodeBook requires a managed PostgreSQL database, deployed on Vercel alongside
the Next.js app. Both Neon and Supabase are managed Postgres providers that
work with Prisma + Vercel, and the plan lists either as acceptable. The choice
needed to optimize for the Vercel deployment story (especially preview
deployments) while keeping the option to switch providers open.

Key differentiators between the two providers:

- **Neon** — first-class, native Vercel integration; built-in per-PR database
  branching that maps cleanly onto Vercel preview deployments; pooled and
  unpooled connection endpoints.
- **Supabase** — generous managed Postgres with bundled Auth/Storage/Realtime
  services; preview DBs possible via the Supabase CLI but less tightly coupled
  to Vercel's per-PR model.

Because Prisma is the only data-access layer, the schema and Prisma code are
identical regardless of provider — only the connection strings differ.

## Decision

**Use Neon as the managed Postgres provider (soft preference).**

- Connection hygiene: the **pooled** `DATABASE_URL` is used at runtime (important
  for Serverless functions to avoid exhausting connections); `DATABASE_URL_DIRECT`
  (unpooled) is reserved for `prisma migrate` / `prisma db seed`.
- Switching to Supabase later would require only `DATABASE_URL` /
  `DATABASE_URL_DIRECT` changes — no schema or Prisma code changes (NFR-16).

Supabase remains a valid alternative; this is a soft decision, not a hard lock.

## Consequences

**Positive:**
- First-class Vercel integration and per-PR database branching make preview
  deployments trivial (each PR gets an isolated DB branch), strengthening the
  CI/CD and testing story (Phase 4 §4.6).
- Pooled + unpooled endpoints map directly onto the runtime vs. migrate/seed
  connection hygiene requirement, reducing serverless connection-exhaustion
  risk (NFR-11, R-7).
- Provider portability is preserved: Prisma code is identical, so a future
  switch is a config-only change (NFR-16).

**Negative:**
- Neon is a "soft" preference, not a hard requirement; if the team later
  prefers Supabase (e.g., to use its Auth/Storage), the decision can be
  revisited without schema changes. This is a low-risk trade-off, not a
  committed cost.

**Neutral:**
- The data model, migrations, and all application code are unaffected by the
  choice between the two providers.

## Alternatives Considered

- **Supabase (rejected as primary, remains acceptable):** Fully capable managed
  Postgres that works with Prisma + Vercel, and it bundles extra services
  (Auth, Storage, Realtime). However, its preview-DB workflow is less tightly
  integrated with Vercel's per-PR model than Neon's built-in branching, and
  DCodeBook already uses Auth.js (not Supabase Auth), so the bundled extras are
  not needed. Because the schema/Prisma code is identical, Supabase stays a
  valid fallback rather than a rejected dead-end.

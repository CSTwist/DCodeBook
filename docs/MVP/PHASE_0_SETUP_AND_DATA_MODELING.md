# Phase 0 — Setup & Data Modeling

> Part of the [DCodeBook](./MVP_IMPLEMENTATION_PLAN.md) implementation docs.
> Precedes [Phase 1 — Auth & RBAC](./PHASE_1_AUTH_AND_RBAC.md).

> **✅ Post-Implementation Notes (July 2026):** Phase 0 is complete. Key reality vs. plan: Prisma 7 moved the `datasource url`/`directUrl` out of `schema.prisma` into `prisma.config.ts`; the runtime uses `@prisma/adapter-pg` + `pg` via `lib/prisma.ts` (see updated snippet below). `next-themes` was installed in Phase 0. Shadcn UI components are built on **`@base-ui/react`**, *not* Radix UI. `pnpm typecheck` (`tsc --noEmit`) and `pnpm vercel-build` (`prisma migrate deploy && next build`) scripts exist. Migrations use `prisma migrate deploy` for prod (not `migrate dev`). `@auth/prisma-adapter` is a separate dependency added in Phase 1 (not in Phase 0's install list).

## Overview / Objective

Phase 0 is the foundation of the entire project. Its goal is to stand up a
production-grade Next.js 15 application skeleton and lock in the relational
data model that every later phase depends on. By the end of this phase we have:

- A reproducible, linted, formatted Next.js 15 + React 19 + TypeScript project.
- Tailwind CSS + Shadcn UI wired up for consistent, accessible components.
- A complete Prisma schema covering **all** domain entities (`User`,
  `Snippet`, `Tag`, `SnippetTag`, `Collection`, `Membership`) with enums
  (`Role`, `Visibility`), relations, and indexes.
- A provisioned PostgreSQL database (Neon or Supabase) with the first
  migration applied and a seed script for local development.
- A documented environment configuration (`.env.example`) and a README that
  explains how to run the project from scratch.

This phase deliberately contains **no business logic and no UI screens** — it
is about getting the bones right so Phase 1 (auth) and Phase 2 (MVP) can be
built on a stable, typed foundation.

## Prerequisites

None. This is the first phase. The only external requirement is:

- Node.js ≥ 18.18 (Next.js 15 requires Node 18.18+; recommend Node 20 LTS).
- A package manager: `pnpm` is recommended (fast, strict, disk-efficient).
  `npm` or `bun` also work; commands below assume `pnpm`.
- A PostgreSQL instance (see *Database Provider Decision* below). You do **not**
  need it provisioned before running `create-next-app`, but you will need the
  connection string before the first `prisma migrate`.

## Detailed Tasks

### 0.1 — Scaffold the Next.js 15 app

Run `create-next-app` with flags that match our architecture (App Router, RSC
by default, TypeScript, Tailwind, ESLint, no `src/` dir so the proposed
`app/`, `lib/`, `prisma/`, `actions/` layout from the plan sits at root).

```bash
pnpm create next-app@latest DCodeBook \
  --ts \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --use-pnpm \
  --turbopack
```

Notes:
- `--app` enables the App Router (RSC-first).
- `--no-src-dir` keeps the folder structure aligned with the plan's
  `app/`, `lib/`, `prisma/`, `actions/` at the repo root.
- `--import-alias "@/*"` lets us import like `@/lib/prisma`.
- `--turbopack` opts into the faster dev bundler (stable in Next 15).

After scaffolding, move into the project and verify it boots:

```bash
cd DCodeBook
pnpm dev   # visit http://localhost:3000
```

### 0.2 — Install core dependencies

```bash
# ORM + DB tooling
pnpm add prisma @prisma/client
pnpm add -D tsx            # to run TS seed/migration scripts locally

# Auth (decision finalized in Phase 1, but install the base now)
pnpm add next-auth@beta    # Auth.js v5 (beta) — Next 15 compatible

# Validation (used heavily in Phase 3, install early for shared schemas)
pnpm add zod

# Utility libs used across the app
pnpm add clsx tailwind-merge class-variance-authority
pnpm add lucide-react      # icons for Shadcn
pnpm add @tanstack/react-query   # optional; MVP uses built-in React hooks (see Phase 3), so not required
```

### 0.3 — Initialize Shadcn UI

Shadcn is a copy-in component library (not a dependency you import from a
package). It writes component source into `components/ui`.

```bash
pnpm dlx shadcn@latest init
# Prompts:
#   Style: Default (New York also fine)
#   Base color: Slate (or Zinc)
#   CSS variables: yes
#   Tailwind config: it auto-detects
```

Then add the components we know we will need up front (more can be added
later):

```bash
pnpm dlx shadcn@latest add button input textarea label card dialog \
  dropdown-menu toast sonner form table badge avatar skeleton tabs \
  select popover command
```

> `sonner` is the recommended toast primitive (replaces the older `toast`
> component) and is referenced again in [Phase 3](./PHASE_3_MUTATIONS_AND_UX.md).

### 0.4 — Database provider decision (Neon vs Supabase)

Both are managed Postgres and both work perfectly with Prisma + Vercel. The
recommendation for DCodeBook:

| Criterion | **Neon (recommended)** | Supabase |
|-----------|------------------------|----------|
| Vercel integration | First-class, native integration | Good |
| Branching / preview DBs | Built-in DB branching per PR | Via Supabase CLI + preview |
| Connection model | Pooled + unpooled endpoints | Pooler (pgbouncer) + direct |
| Free tier | Generous, scales to zero | Generous |
| Extra services | Pure Postgres | Auth, Storage, Realtime bundled |

**Recommendation: Neon.** Rationale: DCodeBook is a Vercel-deployed Next.js
app, and Neon's per-PR database branching maps cleanly onto preview
deployments, which makes Phase 4's CI/CD story trivial. The pooled
connection string (`?pgbouncer=true` / `-pooler` endpoint) is important for
Serverless functions to avoid exhausting connections.

If the team prefers Supabase (e.g., to later use its Auth/Storage), the
schema and Prisma code are identical — only the `DATABASE_URL` changes. The
plan lists Supabase as an acceptable alternative, so this is a soft decision.

**Connection string hygiene:** always use the **pooled** URL in
`DATABASE_URL` for the app runtime, and keep the direct (unpooled) URL for
`prisma migrate`/`prisma db seed` (Prisma's migration engine opens long
connections that the pooler can stall on). Store both in `.env`:

```
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dcodebook?sslmode=require"
DATABASE_URL_DIRECT="postgresql://user:pass@ep-xxx.region.aws.neon.tech/dcodebook?sslmode=require"
```

### 0.5 — Prisma initialization and schema

```bash
pnpm prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and a minimal `.env`. Replace the schema
with the full model below (see *Technical Implementation Notes*).

> **ponytail (updated — actual implementation):** Prisma 7 removed `datasource url`/`directUrl` from `schema.prisma`. The runtime uses `@prisma/adapter-pg` + a `pg` Pool via `lib/prisma.ts`, and migrations are driven by `prisma.config.ts` (which holds the `datasource.url`). `pnpm prisma init` is still valid, but the connection config now lives in `prisma.config.ts`, not the schema.

### 0.6 — First migration and generate client

```bash
pnpm prisma migrate dev --name init
pnpm prisma generate
```

`migrate dev` both creates the migration SQL under
`prisma/migrations/0001_init/` and applies it. `generate` emits the typed
Prisma Client.

> **ponytail (updated — actual implementation):** For production, use `prisma migrate deploy` (applies existing migrations, no generation prompt) — wired into the `vercel-build` script. `migrate dev` is dev-only.

### 0.7 — Seed script

Create `prisma/seed.ts` (see notes) and wire it into `package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Then run `pnpm prisma db seed` to populate a demo user, a few tags, and a
sample collection for local development.

### 0.8 — `.gitignore`, `.env.example`, README

- Ensure `.env`, `.env*.local`, `node_modules`, `.next/`, and
  `prisma/*.db` are ignored (create-next-app already covers most; add
  `.env.example` tracking and ignore real `.env`).
- Create `.env.example` documenting every variable (see table).
- Write a `README.md` with setup steps, scripts, and architecture pointers.

## Technical Implementation Notes

### Complete Prisma schema (illustrative planning example)

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_DIRECT") // used by migrate/seed
}

enum Role {
  USER
  ADMIN
}

enum Visibility {
  PRIVATE
  PUBLIC   // readable by unauthenticated (anonymous) users
  TEAM
}

enum MembershipRole {
  VIEWER
  EDITOR
  ADMIN
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String?
  image         String?
  role          Role           @default(USER)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  accounts      Account[]
  sessions      Session[]
  snippets      Snippet[]      @relation("SnippetOwner")
  ownedCollections Collection[] @relation("CollectionOwner")
  memberships   Membership[]
}

// NextAuth (Auth.js v5) required models — Prisma adapter
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Snippet {
  id           String   @id @default(cuid())
  title        String
  description  String?  @db.Text
  code         String   @db.Text
  language     String   @default("typescript")
  ownerId      String
  collectionId String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  owner      User       @relation("SnippetOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  collection Collection? @relation(fields: [collectionId], references: [id], onDelete: SetNull)
  tags       SnippetTag[]

  // Indexes for live search (ILIKE) and listing by owner/collection
  @@index([ownerId])
  @@index([collectionId])
  @@index([language])
  @@index([title])            // trigram index added in migration (see below)
  @@index([updatedAt])
}

model Tag {
  id    String @id @default(cuid())
  name  String @unique

  snippets SnippetTag[]
}

model SnippetTag {
  snippetId String
  tagId     String

  snippet Snippet @relation(fields: [snippetId], references: [id], onDelete: Cascade)
  tag     Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([snippetId, tagId])
  @@index([tagId])
}

model Collection {
  id         String      @id @default(cuid())
  name       String
  description String?    @db.Text
  ownerId    String
  visibility Visibility  @default(PRIVATE)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  owner       User         @relation("CollectionOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  snippets    Snippet[]
  memberships Membership[]

  @@index([ownerId])
  @@index([visibility])
}

model Membership {
  id           String         @id @default(cuid())
  userId       String
  collectionId String
  role         MembershipRole @default(VIEWER)
  createdAt    DateTime       @default(now())

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  collection Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)

  @@unique([userId, collectionId])
  @@index([collectionId])
}
```

Notes on the schema:
- `Account`, `Session`, `VerificationToken` are the **Auth.js Prisma adapter**
  models. They are required for Phase 1; defining them now avoids a second
  migration.
- `MembershipRole` (VIEWER/EDITOR/ADMIN) is distinct from the global `Role`
  (USER/ADMIN). The plan's `Membership` is `(userId, collectionId, role)`; we
  make `role` a typed enum rather than a free string.
- `Snippet.collectionId` is nullable and `onDelete: SetNull` — deleting a
  collection should not delete the snippets, just ungroup them.
- `User.role` is the global admin flag used by middleware RBAC in Phase 1.

### Postgres trigram index for fast `ILIKE` search

Prisma does not natively emit `pg_trgm` indexes, so add one in the migration
SQL (or a follow-up `prisma migrate dev --create-only` edit). This powers the
live search in [Phase 2](./PHASE_2_MVP_BUILD.md).

```sql
-- inside prisma/migrations/0001_init/migration.sql (appended)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS snippet_title_trgm
  ON "Snippet" USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS snippet_code_trgm
  ON "Snippet" USING gin (code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tag_name_trgm
  ON "Tag" USING gin (name gin_trgm_ops);
```

### `.env.example`

```dotenv
# ---- Database (Neon recommended) ----
DATABASE_URL="postgresql://user:pass@<pooled-host>/dcodebook?sslmode=require"
DATABASE_URL_DIRECT="postgresql://user:pass@<direct-host>/dcodebook?sslmode=require"

# ---- Auth (Auth.js v5) — Phase 1 fills these ----
AUTH_SECRET="generate-with: npx auth secret"
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# ---- App ----
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### `lib/prisma.ts` singleton (updated — actual implementation)

```ts
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ?? process.env.DATABASE_URL_DIRECT;
  if (!connectionString) throw new Error("Missing DATABASE_URL or DATABASE_URL_DIRECT");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

> **ponytail:** Prisma 7 requires the `@prisma/adapter-pg` + `pg` Pool adapter (serverless-safe); the pooled `DATABASE_URL` is used at runtime, `DATABASE_URL_DIRECT` as fallback. This avoids exhausting connections during Next.js hot-reload in dev and at the edge.

### `lib/utils.ts` (Shadcn standard)

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## File / Folder Breakdown

| Path | Action | Purpose |
|------|--------|---------|
| `app/` | scaffolded | App Router root (layout, page). |
| `components/ui/` | created by Shadcn | Copy-in accessible primitives. |
| `lib/prisma.ts` | create | Prisma client singleton. |
| `lib/utils.ts` | create | `cn()` class merge helper. |
| `prisma/schema.prisma` | create/overwrite | Full data model (above). |
| `prisma/migrations/0001_init/` | created by migrate | First migration SQL (+ trgm indexes). |
| `prisma/seed.ts` | create | Demo data for local dev. |
| `prisma.config.ts` | create (updated — actual implementation) | Holds `datasource.url` (Prisma 7 moved it out of `schema.prisma`); `migrations.path` + `migrations.seed`. |
| `middleware.ts` | create (stub) | Placeholder; real RBAC in Phase 1. |
| `.env.example` | create | Documented env template. |
| `.gitignore` | append | Ensure `.env` ignored. |
| `README.md` | create/overwrite | Setup + architecture overview. |
| `package.json` | modify | Add `prisma.seed` config. |

## Acceptance Criteria

- [x] ✅ Complete (July 2026) `pnpm dev` boots a Next.js 15 App Router app with no type errors.
- [x] ✅ Complete (July 2026) `pnpm lint` and `pnpm typecheck` pass.
- [x] ✅ Complete (July 2026) Shadcn components render (e.g., a `<Button>` on the home page).
- [x] ✅ Complete (July 2026) `prisma/schema.prisma` contains all six domain models + three enums.
- [x] ✅ Complete (July 2026) `prisma migrate dev --name init` applies cleanly; tables exist in DB.
- [x] ✅ Complete (July 2026) `prisma generate` produces a typed client; `lib/prisma.ts` imports it.
- [x] ✅ Complete (July 2026) `prisma db seed` populates demo data successfully.
- [x] ✅ Complete (July 2026) `.env.example` documents every variable; real `.env` is git-ignored.
- [x] ✅ Complete (July 2026) `README.md` explains setup from a clean clone.

## Verification / Testing

```bash
# Type-check & lint
pnpm typecheck
pnpm lint

# DB lifecycle
pnpm prisma migrate dev --name init
pnpm prisma db seed
# prod: pnpm prisma migrate deploy
pnpm prisma studio          # visually confirm tables + seed rows

# App boots
pnpm dev                    # http://localhost:3000 returns 200
```

Manual checks:
- Open `prisma/studio`, confirm `User`, `Snippet`, `Tag`, `Collection`,
  `Membership` tables exist and seed rows are present.
- Confirm `pg_trgm` extension and the three GIN indexes exist:
  `SELECT indexname FROM pg_indexes WHERE tablename='Snippet';`

## Risks & Mitigations

- **Connection exhaustion in serverless.** Mitigation: use the **pooled**
  `DATABASE_URL` at runtime; keep `directUrl` only for migrate/seed. Use the
  `lib/prisma.ts` singleton.
- **`pg_trgm` not enabled.** Mitigation: include `CREATE EXTENSION` in the
  init migration; Neon/Supabase allow it on the default role.
- **Shadcn version drift.** Mitigation: pin `shadcn` via `pnpm dlx
  shadcn@latest` and commit the generated `components.json`.
- **Auth.js v5 is beta.** Mitigation: it is the only line that supports Next
  15 / React 19 cleanly; we isolate it behind `lib/auth.ts` (Phase 1) so a
  future swap is localized.
- **Schema churn later.** Mitigation: define relations and enums now, even
  those only used in later phases, to avoid disruptive migrations.

## Dependencies & Packages

| Package | Why |
|---------|-----|
| `next@15`, `react@19`, `react-dom@19` | Core framework (App Router, RSC). |
| `typescript` | Type safety across schema, actions, UI. |
| `tailwindcss`, `postcss`, `autoprefixer` | Styling engine. |
| `prisma`, `@prisma/client` | ORM + typed data access. |
| `tsx` (dev) | Run TS seed/migration scripts. |
| `next-auth@beta` | Auth.js v5 — OAuth in Phase 1. |
| `zod` | Validation schemas (shared with Phase 3). |
| `clsx`, `tailwind-merge`, `class-variance-authority` | Shadcn styling utilities. |
| `lucide-react` | Icons. |
| `shadcn` (CLI) | Component generator. |

## Cross-references

- Main plan: [MVP_IMPLEMENTATION_PLAN.md](./MVP_IMPLEMENTATION_PLAN.md)
- Next: [Phase 1 — Auth & RBAC](./PHASE_1_AUTH_AND_RBAC.md)
- Build on this: [Phase 2 — MVP Build](./PHASE_2_MVP_BUILD.md)
- Mutations: [Phase 3 — Mutations & UX](./PHASE_3_MUTATIONS_AND_UX.md)
- Ship: [Phase 4 — Polish & Ship](./PHASE_4_POLISH_AND_SHIP.md)

# DCodeBook — Software Requirements Specification (SRS)

> **Document type:** Software Requirements Specification (IEEE-830-inspired, practical)
> **Project:** DCodeBook — a real-time full-stack knowledge base & code snippet canvas for developers
> **Status:** 🟡 Draft for review — derived from the locked planning documents (no code yet)
> **Source of truth:** `IMPLEMENTATION_PLAN.md` and the five phase docs under `docs/` (see §1.4)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional, non-functional, data, and authorization requirements for **DCodeBook**, a full-stack web application that lets developers capture, organize, search, and share code snippets and notes with role-based access for personal and team workspaces.

The SRS is the authoritative requirements baseline for the five-phase delivery plan. It exists so that implementation work (Phases 0–4) can be verified against explicit, testable requirements, and so that scope, constraints, and decisions are recorded in one place. This document does **not** contain application code; where small snippets appear, they are illustrative only and clarify a requirement.

### 1.2 Scope

**What DCodeBook is.** A Next.js 15 (App Router) web application where authenticated developers manage a personal/team knowledge base of code snippets. Core capabilities: OAuth sign-in, snippet CRUD with server-side syntax highlighting, a tagging engine, live search, collections with visibility controls, and role-based access control (RBAC).

**What this SRS covers.** All requirements needed to deliver the MVP described across Phases 0–4: data model, authentication, RBAC, UI/UX, performance, security, accessibility, and deployment. It also records the phased traceability (§4) and post-MVP direction (Appendix C).

**In scope (MVP).**
- OAuth authentication via GitHub and Google (Auth.js v5 / NextAuth.js).
- Snippet create / read / update / delete with ownership.
- Server-side syntax highlighting (Shiki, zero client JS).
- Tagging engine (unique tag names, many-to-many via `SnippetTag`).
- Live search over title, code, and tags using Postgres `ILIKE` + `pg_trgm` GIN indexes.
- Collections with `PRIVATE` | `PUBLIC` | `TEAM` visibility.
- RBAC: global `Role` (`USER` | `ADMIN`) and per-collection `MembershipRole` (`VIEWER` | `EDITOR` | `ADMIN`).
- Mutations via Server Actions with optimistic UI, Zod validation, toasts, pagination, and cache revalidation.
- UI/UX polish: dark mode, responsive layout, accessibility (WCAG 2.1 AA target), OpenGraph metadata.
- Deployment to Vercel + managed Postgres (Neon soft-preferred) with `prisma migrate deploy`.

**Out of scope / non-goals (MVP).**
- Real-time multi-user collaborative editing (live cursors) — deferred.
- Native mobile applications — responsive web only.
- AI-assisted features — out of scope for MVP.
- Full-text search / Algolia — deferred (MVP uses `ILIKE` + trigram indexes).
  - Unauthenticated public browsing of `PUBLIC` collections IS permitted — anonymous users can read `PUBLIC` collections and their snippets (no session required); see §2.3 and §3.5 for the recorded behavior (decided; resolves open item R-6).

### 1.3 Definitions, Acronyms & Abbreviations

| Term | Definition |
|------|------------|
| **RSC** | React Server Component — server-rendered component for data fetching with minimal client JS. |
| **RBAC** | Role-Based Access Control — authorization based on roles (global `Role`, per-collection `MembershipRole`). |
| **OAuth** | Open Authorization — delegated authentication protocol used by GitHub/Google providers. |
| **ORM** | Object-Relational Mapper — here, Prisma mapping TS types to Postgres. |
| **SRS** | Software Requirements Specification (this document). |
| **ILIKE** | Case-insensitive `LIKE` operator in PostgreSQL (used via Prisma `contains` + `mode: "insensitive"`). |
| **GIN** | Generalized Inverted Index — Postgres index type used with `pg_trgm` for fast substring search. |
| **pg_trgm** | PostgreSQL extension providing trigram matching and GIN operator classes. |
| **MAU** | Monthly Active Users — billing metric for hosted auth (Clerk), avoided by choosing Auth.js. |
| **CWV** | Core Web Vitals — Google performance metrics: LCP, INP, CLS. |
| **a11y** | Accessibility — usability for people with disabilities. |
| **OG** | OpenGraph — protocol for rich link previews (metadata + images). |
| **CSRF** | Cross-Site Request Forgery — mitigated by Server Action same-origin enforcement. |
| **RSC/Server Action** | Server Action — async function executed on the server, invoked from forms/components. |
| **LCP** | Largest Contentful Paint — CWV metric (target < 2.5s). |
| **INP** | Interaction to Next Paint — CWV metric (target < 200ms). |
| **CLS** | Cumulative Layout Shift — CWV metric (target < 0.1). |
| **SLA** | Service Level Agreement — uptime/availability commitment of managed providers. |
| **cuid** | Collision-resistant unique identifier used as Prisma `@id` default. |
| **Prisma Adapter** | `@auth/prisma-adapter` persisting Auth.js sessions/accounts in our DB. |
| **Vercel** | Hosting platform for the Next.js app. |
| **Neon / Supabase** | Managed PostgreSQL providers; Neon is soft-preferred. |

### 1.4 References

| Ref | Document | Relative path |
|-----|----------|---------------|
| [PLAN] | DCodeBook High-Level Implementation Plan | `../IMPLEMENTATION_PLAN.md` |
| [P0] | Phase 0 — Setup & Data Modeling | `./PHASE_0_SETUP_AND_DATA_MODELING.md` |
| [P1] | Phase 1 — Authentication & RBAC | `./PHASE_1_AUTH_AND_RBAC.md` |
| [P2] | Phase 2 — MVP Build | `./PHASE_2_MVP_BUILD.md` |
| [P3] | Phase 3 — Mutations & UX | `./PHASE_3_MUTATIONS_AND_UX.md` |
| [P4] | Phase 4 — Polish & Ship | `./PHASE_4_POLISH_AND_SHIP.md` |

### 1.5 Document Overview

- **§2 Overall Description** — product perspective, functions, user classes, environment, constraints, assumptions/dependencies.
- **§3 Specific Requirements** — external interfaces, functional requirements (FR-1…), non-functional requirements (NFR-1…), data model, authentication & authorization (incl. permission matrix).
- **§4 Requirement Traceability Matrix** — maps requirement groups to Phases 0–4.
- **§5 Appendices** — risks/open decisions, glossary supplement, post-MVP roadmap.

Requirement ID conventions: `FR-` functional, `NFR-` non-functional, `AR-` architectural/assumption. Each is intended to be individually testable.

---

## 2. Overall Description

### 2.1 Product Perspective

DCodeBook is a **standalone web application** built on Next.js 15 (App Router). It is not a component of a larger system; it is a self-contained SaaS-style product.

- **Compute/hosting:** the Next.js app is deployed on **Vercel**; Server Components and Server Actions run in the Vercel serverless/edge environment.
- **Data:** a **managed PostgreSQL** database (Neon soft-preferred, Supabase acceptable) holds all domain and auth data via Prisma.
- **Auth providers:** GitHub and Google act as external OAuth identity providers; DCodeBook remains the system of record for `User` data (persisted in our Postgres via the Prisma adapter). No user data is stored in a third-party auth vendor.
- **External boundaries:** OAuth provider consoles (GitHub/Google), the Postgres instance, and the Vercel platform are the only external dependencies. There is no separate API server — data access happens inside RSC and Server Actions.

### 2.2 Product Functions

High-level capabilities (detailed as FRs in §3.2):

1. **OAuth authentication** — sign in/up with GitHub or Google; session available in every RSC.
2. **Snippet management** — create, read, update, delete code snippets owned by the user.
3. **Syntax highlighting** — server-rendered, accurate highlighting with zero client JS (Shiki).
4. **Tagging** — assign unique, reusable tags to snippets (many-to-many).
5. **Live search** — debounced/submission-driven search across title, code, and tags via Postgres `ILIKE` + trigram indexes.
6. **Collections** — group snippets into collections with `PRIVATE` / `PUBLIC` / `TEAM` visibility.
7. **Membership & RBAC** — per-collection roles (`VIEWER`/`EDITOR`/`ADMIN`) and a global `ADMIN` role; enforcement at edge (cookie presence) and authoritatively in RSC/Server Actions.
8. **Mutations & UX** — Server Actions with optimistic UI, Zod validation, toasts, pagination, revalidation.
9. **UI/UX polish** — dark mode, responsive design, accessibility (WCAG 2.1 AA target), OpenGraph metadata, Core Web Vitals targets.

### 2.3 User Classes & Characteristics

| User class | Description | Auth state |
|-----------|-------------|-----------|
| **Unauthenticated visitor (Anonymous)** | Anyone hitting the app without a session. | No session. Can browse and read `PUBLIC` collections and the snippets within them (no session required). Middleware allows PUBLIC-collection read routes through (cookie-presence check passes); protected routes (`/dashboard`, `/snippets/new`, `/collections`, `/admin`) still redirect to `/sign-in`. Cannot authenticate-by-proxy, cannot create/edit/delete anything, cannot access `PRIVATE` or `TEAM` collections or their snippets, and cannot reach any mutation surface (Server Actions). This class is now a decided requirement (see FR-44/45/46, NFR-24, §3.5.2). |
| **Developer end-user / snippet owner** | Signed-in `USER` (global `Role = USER`). Primary persona. Creates and manages own snippets, tags, and collections. | Authenticated; global `Role = USER`. |
| **Collection member (VIEWER)** | A `USER` with a `Membership` of `VIEWER` on a `TEAM` collection. Can view the collection and its snippets; cannot edit/delete. | Authenticated. |
| **Collection member (EDITOR)** | A `USER` with a `Membership` of `EDITOR` on a `TEAM` collection (or the collection owner). Can view and edit the collection and its snippets. | Authenticated. |
| **Collection member (ADMIN)** | A `USER` with a `Membership` of `ADMIN` on a `TEAM` collection. Can manage membership and collection settings. | Authenticated. |
| **Global ADMIN** | A `USER` with global `Role = ADMIN`. Can access `/admin` and perform admin-only operations. Distinct from per-collection `MembershipRole.ADMIN`. | Authenticated; global `Role = ADMIN`. |

> Note: The global `Role` (`USER`|`ADMIN`) and the per-collection `MembershipRole` (`VIEWER`|`EDITOR`|`ADMIN`) are **independent** axes of authorization. A global `ADMIN` is not automatically a member of every collection, and a collection `ADMIN` is not a global `ADMIN`.

### 2.4 Operating Environment

- **Client:** modern evergreen browsers (latest Chrome, Edge, Firefox, Safari) with JavaScript enabled for interactive islands; core content is server-rendered (RSC) and degrades gracefully.
- **Server:** Vercel (Node.js runtime for RSC/Server Actions; edge runtime for `middleware.ts`). Node.js ≥ 18.18 required; Node 20 LTS recommended.
- **Database:** managed PostgreSQL (Neon or Supabase) with `pg_trgm` extension enabled; pooled connection for runtime, direct connection for migrations/seeds.
- **Build/deploy:** `pnpm`; production build runs `prisma migrate deploy && next build` (via `vercel-build` script).

### 2.5 Design & Implementation Constraints

- **Next.js 15 App Router + RSC-first.** Data fetching happens in Server Components; client JS is minimized to small interactive islands.
- **Server Actions for mutations.** All create/update/delete operations use `"use server"` functions, not a separate REST/GraphQL API.
- **TypeScript** is mandatory across schema, actions, and UI.
- **Prisma ORM** is the only data-access layer over PostgreSQL; the typed client is generated and committed via `prisma generate`.
- **Auth.js v5 is beta.** All Auth.js configuration is isolated in `lib/auth.ts` so a future swap (e.g., to Clerk) is localized. The `session.user.role` augmentation lives in `types/next-auth.d.ts`.
- **Edge middleware cannot query the database.** `middleware.ts` performs a **cookie-presence check only** (no `auth()`/Prisma at the edge). Authoritative role checks occur in RSC/Server Actions via `auth()` + `lib/rbac.ts`.
- **Shadcn UI** components are copy-in (source committed under `components/ui`); styling via Tailwind CSS + CSS variables.
- **Package manager:** `pnpm` (strict, disk-efficient). `npm`/`bun` are not the documented standard.
- **Connection hygiene:** runtime uses the **pooled** `DATABASE_URL`; `DATABASE_URL_DIRECT` is reserved for `prisma migrate`/`prisma db seed`.
- **Production migrations** use `prisma migrate deploy` (no generation prompt), never `prisma migrate dev` against prod.

### 2.6 Assumptions & Dependencies

- **OAuth provider availability:** GitHub and Google OAuth endpoints and developer consoles are reachable; production callback URLs are registered before deploy.
- **Managed Postgres:** a Neon or Supabase PostgreSQL instance is available with the `pg_trgm` extension permitted on the default role.
- **Vercel platform:** the app is deployable to Vercel with environment variables configurable; build can run `prisma migrate deploy`.
- **Node runtime:** the deployment target supports Node.js ≥ 18.18 (Node 20 LTS recommended).
- **Auth.js v5 beta stability:** the chosen version supports Next.js 15 / React 19; API surface is pinned in `package.json` to limit churn.
- **Internet connectivity** for OAuth round-trips and CDN-hosted assets.

---

## 3. Specific Requirements

### 3.1 External Interfaces

**3.1.1 User Interface (UI)**
- Web UI rendered primarily via RSC; interactive islands are client components (`"use client"`).
- Routes (from [P2]): `(app)/dashboard`, `(app)/snippets` (list+search), `(app)/snippets/[id]` (detail), `(app)/snippets/new` (editor), `(app)/snippets/[id]/edit` (editor), `(app)/collections` (list), `(app)/collections/[id]` (detail), `/sign-in`.
- Components built on Shadcn UI primitives (`button`, `input`, `textarea`, `label`, `card`, `dialog`, `dropdown-menu`, `toast`/`sonner`, `form`, `table`, `badge`, `avatar`, `skeleton`, `tabs`, `select`, `popover`, `command`).
- Theme: light/dark via `next-themes`; Tailwind `dark:` classes + CSS variables.

**3.1.2 Server Action / API surface**
- No public REST/GraphQL API in MVP. The mutation surface is Server Actions under `actions/` (e.g., `actions/snippets.ts`, `actions/collections.ts`): `createSnippet`, `updateSnippet`, `deleteSnippet`, `createCollection`, `updateCollectionVisibility`, `addMember`, plus a `loadMore(cursor)` for pagination.
- Server Actions are invoked from forms (`action={...}`) and client components; they authenticate, validate (Zod), mutate (Prisma), and revalidate (`revalidatePath`/`revalidateTag`).
- Auth.js route handler at `app/api/auth/[...nextauth]/route.ts` exposes `GET`/`POST` for the OAuth flow.

**3.1.3 Database interface**
- PostgreSQL accessed exclusively through Prisma Client (`lib/prisma.ts` singleton).
- Schema defined in `prisma/schema.prisma`; migrations under `prisma/migrations/`.
- Search relies on `pg_trgm` GIN indexes on `Snippet.title`, `Snippet.code`, and `Tag.name`.

**3.1.4 OAuth provider interfaces**
- GitHub OAuth 2.0 (authorization callback `…/api/auth/callback/github`).
- Google OAuth 2.0 (authorization callback `…/api/auth/callback/google`).
- Auth.js v5 with `PrismaAdapter`; session strategy = `database` (persists to `Session` table).

**3.1.5 Hosting / CDN**
- Vercel hosts the app and serves static/streamed RSC output via its CDN.
- `next/font` self-hosts fonts; `next/og` generates dynamic OG images at `app/opengraph-image.tsx`.

### 3.2 Functional Requirements

#### 3.2.1 Authentication & Session

- **FR-1** The system SHALL support user authentication via GitHub OAuth and Google OAuth using Auth.js v5 (`next-auth@beta`) with the Prisma adapter.
- **FR-2** The system SHALL auto-create a `User` (and linked `Account`) on first successful OAuth login; no separate sign-up flow is required.
- **FR-3** The system SHALL persist sessions using the `database` session strategy (Auth.js `Session` table), not JWT-only sessions.
- **FR-4** The system SHALL expose the current session (including `user.id` and `user.role`) to any React Server Component or Server Action via the `auth()` helper from `lib/auth.ts`.
- **FR-5** The system SHALL provide sign-out functionality from the authenticated user menu that clears the session.
- **FR-6** The system SHALL redirect unauthenticated users attempting protected routes to `/sign-in` (with `callbackUrl` preserved), enforced at the edge by `middleware.ts` via session-cookie presence.

#### 3.2.2 Snippet CRUD

- **FR-7** An authenticated user SHALL be able to create a snippet with: `title` (required, ≤200 chars), `code` (required, ≤50,000 chars), `language` (required, ≤50 chars, default `typescript`), `description` (optional, ≤2,000 chars), optional `tagNames` (≤20 tags, each ≤40 chars), and optional `collectionId` (valid cuid or null).
- **FR-8** The system SHALL set `ownerId` to the creating user's id on snippet creation; a snippet SHALL belong to exactly one owner.
- **FR-9** An authenticated user SHALL be able to read (view) any snippet they own, and any snippet within a collection they are authorized to view (per §3.5).
- **FR-10** The owner of a snippet SHALL be able to update its `title`, `description`, `code`, `language`, and `collectionId`; the system SHALL enforce that only the owner may update a snippet.
- **FR-11** The owner of a snippet SHALL be able to delete it; the system SHALL enforce that only the owner may delete a snippet (attempts by others SHALL be rejected with a `FORBIDDEN`/redirect, not a 500).
- **FR-12** Deleting a snippet SHALL cascade-delete its `SnippetTag` rows (`onDelete: Cascade`) and SHALL NOT delete its `Collection` (the `collectionId` is nullable with `onDelete: SetNull`).

#### 3.2.3 Syntax Highlighting

- **FR-13** The system SHALL render snippet code with **Shiki** server-side (inside the RSC that displays the snippet), producing highlighted HTML with **zero client-side JavaScript** for highlighting. The Shiki theme SHALL follow the active UI theme (`github-dark` in dark mode, `github-light` in light mode).

#### 3.2.4 Tagging

- **FR-14** Tags SHALL be stored as unique `Tag` rows (`name` unique); the system SHALL NOT create duplicate `Tag` rows for the same name (use `connectOrCreate` keyed on `name`).
- **FR-15** A snippet SHALL be associated with tags via the `SnippetTag` join table (many-to-many); a snippet MAY have zero or more tags, and a tag MAY be attached to zero or more snippets.
- **FR-16** The UI SHALL display a snippet's tags as badges and SHALL allow filtering the snippet list by clicking a tag (navigates to `/snippets?tag=<name>`).

#### 3.2.5 Live Search

- **FR-17** The system SHALL provide search over a user's snippets by `title`, `code`, and related `Tag.name`, case-insensitive.
- **FR-18** Search SHALL be implemented with PostgreSQL `ILIKE` (Prisma `contains` + `mode: "insensitive"`) backed by `pg_trgm` GIN indexes on `Snippet.title`, `Snippet.code`, and `Tag.name`.
- **FR-19** The search input SHALL update a URL query parameter (`?q=`) and the RSC SHALL re-render results (no client-side data fetch); results SHALL be limited (e.g., `take: 50`) and ordered by `updatedAt` descending. The search experience SHALL feel "live" (debounced/submission-driven) while keeping client JS minimal.

#### 3.2.6 Collections

- **FR-20** An authenticated user SHALL be able to create a collection with `name` (required, ≤120 chars), `description` (optional, ≤2,000 chars), and `visibility` (`PRIVATE` | `PUBLIC` | `TEAM`, default `PRIVATE`).
- **FR-21** A collection SHALL have exactly one owner (`ownerId`); the owner SHALL be able to update its `name`, `description`, and `visibility`.
  - **FR-22** `visibility` semantics SHALL be: `PRIVATE` (owner + members only), `PUBLIC` (viewable by **anyone, including unauthenticated/anonymous users**, in listings and detail), `TEAM` (visible/editable per `Membership`).
- **FR-23** The collections listing SHALL show the current user's own collections, all `PUBLIC` collections, and `TEAM` collections where the user holds a `Membership` (via `listVisibleCollections`).
- **FR-24** Deleting a collection SHALL cascade-delete its `Membership` rows and SHALL set `Snippet.collectionId` to null (`onDelete: SetNull`) for its snippets (snippets are not deleted).

#### 3.2.7 Membership & RBAC

- **FR-25** The system SHALL support a global `Role` enum on `User`: `USER` (default) and `ADMIN`.
- **FR-26** The system SHALL support a per-collection `Membership` entity linking `userId` + `collectionId` (unique pair) with `MembershipRole`: `VIEWER` | `EDITOR` | `ADMIN` (default `VIEWER`).
- **FR-27** `middleware.ts` SHALL perform **cookie-presence-only** checks for protected prefixes (`/dashboard`, `/snippets/new`, `/collections`, `/admin`); it SHALL NOT perform database/role queries at the edge.
- **FR-28** Authoritative authorization SHALL occur in RSC/Server Actions via `auth()` + `lib/rbac.ts` helpers (`requireUser`, `requireAdmin`, `canEditCollection`). A `USER` attempting `/admin` SHALL be denied (both middleware redirect and `requireAdmin` enforcement).
- **FR-29** Editing a `TEAM` collection (or its snippets) SHALL be permitted only to the owner or a member with `MembershipRole` of `EDITOR` or `ADMIN` (`canEditCollection` logic). `VIEWER` members SHALL NOT be able to edit.
- **FR-30** The system SHALL provide a permission matrix (see §3.5.2) defining allowed actions per role; implementation SHALL conform to it.

#### 3.2.8 Mutations & UX

- **FR-31** All mutations SHALL be implemented as Server Actions (`"use server"`) that call `requireUser()` (and ownership/role checks as needed) before any data change.
- **FR-32** All Server Action inputs SHALL be validated with Zod schemas (`snippetSchema`, `collectionSchema`) at the server boundary; validation failures SHALL return a typed error result (e.g., `{ error: fieldErrors }`) and SHALL NOT throw a 500.
- **FR-33** Server Actions SHALL return a structured result (`{ ok: true, data }` or `{ ok: false, error }`); only auth/role violations SHALL throw (resulting in a 500/redirect).
- **FR-34** The UI SHALL provide **optimistic updates** using `useOptimistic` + `useTransition` for snippet creation/listing, reverting and showing a toast on failure.
- **FR-35** The UI SHALL surface validation/error feedback via Shadcn `form`/`label` field errors and `sonner` toasts; submit controls SHALL be disabled during pending state (`useFormStatus`).
- **FR-36** Snippet lists beyond ~50 items SHALL support pagination (cursor-based, `take: 20`, peek-one) or `?page=` RSC pagination; loading more SHALL not require a full reload.
- **FR-37** After a successful mutation, the system SHALL call `revalidatePath` (and `revalidateTag` where applicable) for affected routes (`/snippets`, `/dashboard`, `/collections`, and the specific snippet/collection detail path) so RSC output stays consistent.

#### 3.2.9 UI / UX

- **FR-38** The application SHALL support **dark mode** (light/dark) via `next-themes` with no flash of incorrect theme; the Shiki highlight theme SHALL follow the active theme.
- **FR-39** The UI SHALL be **responsive** across desktop and mobile viewport sizes (no native app required).
- **FR-40** The application SHALL meet **WCAG 2.1 AA** accessibility targets: keyboard-reachable interactive elements, visible focus rings (`focus-visible:ring`), `aria-label` on icon-only buttons, focus management on route/dialog changes, color contrast ≥ 4.5:1, and a skip-to-content link in the authenticated layout.
- **FR-41** The application SHALL provide per-page dynamic metadata (`generateMetadata`) including title, description, and OpenGraph/Twitter cards; a branded dynamic OG image SHALL be generated at `app/opengraph-image.tsx`.
- **FR-42** The application SHALL include `app/robots.ts` and `app/sitemap.ts` for SEO crawlability and use semantic HTML (`<main>`, `<nav>`, `<article>`, correct heading order) with `lang="en"` on `<html>`.
- **FR-43** Loading states SHALL use `loading.tsx` skeletons with fixed dimensions (to avoid CLS) for navigation, and inline spinners for in-page mutations.

#### 3.2.10 Anonymous Access (Public Read-Only)

- **FR-44** The system SHALL allow unauthenticated (anonymous) users to read (view) any `PUBLIC` collection and the snippets within it, without requiring a session.
- **FR-45** The system SHALL deny all mutation operations (create/update/delete of snippets and collections, membership management, and tagging mutations) to anonymous users; every such Server Action SHALL require an authenticated session and SHALL reject unauthenticated invocations (401/redirect).
- **FR-46** The system SHALL deny anonymous users access to `PRIVATE` and `TEAM` collections and their snippets; such collections remain auth-gated and require an appropriate session + membership.

### 3.3 Non-Functional Requirements

#### 3.3.1 Performance

- **NFR-1** The application SHALL keep client-side JavaScript minimal by defaulting to RSC for data fetching and limiting client islands to forms/search/optimistic UI.
- **NFR-2** **LCP** SHALL be < 2.5s (mobile) by keeping RSC payloads lean and avoiding large client bundles.
- **NFR-3** **INP** SHALL be < 200ms by keeping Server Actions fast and avoiding main-thread blocking.
- **NFR-4** **CLS** SHALL be < 0.1; skeletons SHALL reserve fixed space and Shiki output SHALL have stable height to prevent layout shift. Search/list latency SHALL remain responsive (trigram indexes; `take` limits) under expected MVP data volumes.

#### 3.3.2 Security

- **NFR-5** All authorization decisions SHALL be enforced authoritatively in RSC/Server Actions (`auth()` + `lib/rbac.ts`); edge middleware SHALL only gate by cookie presence. Anonymous (unauthenticated) requests SHALL be permitted READ on `PUBLIC` collections only, and denied all mutations and `PRIVATE`/`TEAM` access (see NFR-24).
- **NFR-6** OAuth secrets (`AUTH_SECRET`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_SECRET`) and database credentials SHALL NOT be exposed to the client; only `NEXT_PUBLIC_APP_URL` is a public env var.
- **NFR-7** All Server Action inputs SHALL be validated with Zod at the server boundary; unvalidated/unsanitized input SHALL NOT reach Prisma.
- **NFR-8** Server Actions SHALL be protected against unauthorized invocation: every action SHALL authenticate (`requireUser`) and perform ownership/role checks before mutating.
- **NFR-9** Server Actions inherit Next.js same-origin/CSRF protections; actions SHALL NOT be reachable via unauthenticated cross-site requests that bypass auth checks.
- **NFR-10** Shiki-rendered HTML is generated from application-stored code (not user-injected HTML); the app SHALL NOT interpolate raw user HTML elsewhere.
- **NFR-24** Anonymous (unauthenticated) users SHALL be permitted READ access **only** to collections where `visibility === PUBLIC` (and the snippets within them); no `PRIVATE` or `TEAM` data SHALL be exposed to unauthenticated requests, and all mutation endpoints (Server Actions) SHALL require an authenticated session and SHALL reject unauthenticated invocations (401/redirect).

#### 3.3.3 Reliability & Availability

- **NFR-11** The system SHALL rely on managed Postgres (Neon/Supabase) with provider SLA; the Prisma client singleton SHALL avoid connection exhaustion in serverless (pooled `DATABASE_URL` at runtime).
- **NFR-12** The application SHALL handle errors gracefully: validation errors return structured results; unexpected server errors SHALL be caught and surfaced without leaking stack traces to clients; database unavailability SHALL not corrupt data (transactions where appropriate).

#### 3.3.4 Maintainability

- **NFR-13** The codebase SHALL be TypeScript throughout; the Prisma typed client SHALL be the single data-access contract.
- **NFR-14** Auth.js configuration SHALL be isolated in `lib/auth.ts` (and type augmentation in `types/next-auth.d.ts`) so provider/auth-library changes are localized.
- **NFR-15** The project SHALL follow the documented folder structure (`app/`, `components/`, `lib/`, `prisma/`, `actions/`, `middleware.ts`) and SHALL pass `pnpm lint` and `pnpm tsc --noEmit` with no errors.

#### 3.3.5 Portability

- **NFR-16** The application SHALL run on Vercel with any managed Postgres (Neon or Supabase); switching providers SHALL require only `DATABASE_URL` / `DATABASE_URL_DIRECT` changes (schema and Prisma code identical).
- **NFR-17** Environment configuration SHALL be documented in `.env.example`; real `.env` SHALL be git-ignored. The app SHALL support dev (pooled dev DB) and prod (pooled prod DB) via the same variables.

#### 3.3.6 Scalability

- **NFR-18** Search SHALL scale to MVP volumes via `ILIKE` + `pg_trgm` GIN indexes; the architecture SHALL permit a later migration path to Postgres full-text (`tsvector`) or Algolia without schema redesign of the domain model.
- **NFR-19** List endpoints SHALL paginate (cursor/`?page=`) to bound payload size as snippet counts grow.

#### 3.3.7 Accessibility

- **NFR-20** The application SHALL target **WCAG 2.1 AA** compliance; Lighthouse accessibility score SHALL be ≥ 90 with no critical `axe-core` violations.
- **NFR-21** All interactive elements SHALL be operable by keyboard alone, with visible focus indicators.
- **NFR-22** Color contrast SHALL meet ≥ 4.5:1 for text in both light and dark themes.
- **NFR-23** Focus SHALL be managed on route changes and dialog open/close; a skip-to-content link SHALL be present in the authenticated layout.

### 3.4 Data Model Requirements

The system SHALL implement the following entities and enums (field names and types per [P0]; illustrative Prisma shown for clarity only).

**Enums**
- `Role { USER, ADMIN }` — global user role; `User.role` defaults to `USER`.
- `Visibility { PRIVATE, PUBLIC, TEAM }` — collection visibility; `Collection.visibility` defaults to `PRIVATE`.
- `MembershipRole { VIEWER, EDITOR, ADMIN }` — per-collection membership role; `Membership.role` defaults to `VIEWER`.

**Entities (domain)**
- **User**: `id` (cuid, PK), `email` (String, **unique**), `name` (String?, nullable), `image` (String?, nullable), `role` (`Role`, default `USER`), `createdAt`, `updatedAt`; relations: `accounts`, `sessions`, `snippets` (owned), `ownedCollections`, `memberships`.
- **Snippet**: `id` (cuid, PK), `title` (String), `description` (String? @db.Text), `code` (String @db.Text), `language` (String, default `"typescript"`), `ownerId` (String, FK→User, `onDelete: Cascade`), `collectionId` (String?, FK→Collection, `onDelete: SetNull`), `createdAt`, `updatedAt`; relations: `owner`, `collection`, `tags` (SnippetTag). Indexes: `@@index([ownerId])`, `@@index([collectionId])`, `@@index([language])`, `@@index([title])` (trigram), `@@index([updatedAt])`.
- **Tag**: `id` (cuid, PK), `name` (String, **unique**); relation: `snippets` (SnippetTag).
- **SnippetTag** (join): `snippetId` (FK→Snippet, `onDelete: Cascade`), `tagId` (FK→Tag, `onDelete: Cascade`); `@@id([snippetId, tagId])`, `@@index([tagId])`.
- **Collection**: `id` (cuid, PK), `name` (String), `description` (String? @db.Text), `ownerId` (String, FK→User, `onDelete: Cascade`), `visibility` (`Visibility`, default `PRIVATE`), `createdAt`, `updatedAt`; relations: `owner`, `snippets`, `memberships`. Indexes: `@@index([ownerId])`, `@@index([visibility])`.
- **Membership**: `id` (cuid, PK), `userId` (String, FK→User, `onDelete: Cascade`), `collectionId` (String, FK→Collection, `onDelete: Cascade`), `role` (`MembershipRole`, default `VIEWER`), `createdAt`; `@@unique([userId, collectionId])`, `@@index([collectionId])`.

**Entities (Auth.js Prisma adapter — required, defined in Phase 0 to avoid a second migration)**
- **Account**: `id`, `userId` (FK→User, `onDelete: Cascade`), `type`, `provider`, `providerAccountId`, tokens (nullable), `@@unique([provider, providerAccountId])`.
- **Session**: `id`, `sessionToken` (unique), `userId` (FK→User, `onDelete: Cascade`), `expires`, relation `user`.
- **VerificationToken**: `identifier`, `token` (unique), `expires`, `@@unique([identifier, token])`.

**Data-model constraints (testable)**
- **DM-1** `User.email` SHALL be unique across the table.
- **DM-2** `Tag.name` SHALL be unique across the table (no duplicate tags).
- **DM-3** `(userId, collectionId)` SHALL be unique in `Membership` (a user has at most one membership per collection).
- **DM-4** Deleting a `User` SHALL cascade-delete their `Account`, `Session`, owned `Snippet`s, owned `Collection`s, and `Membership`s.
- **DM-5** Deleting a `Snippet` SHALL cascade-delete its `SnippetTag` rows; deleting a `Tag` SHALL cascade-delete its `SnippetTag` rows.
- **DM-6** Deleting a `Collection` SHALL cascade-delete its `Membership` rows and set `Snippet.collectionId` to null (`onDelete: SetNull`).
- **DM-7** The `pg_trgm` extension SHALL be enabled and GIN trigram indexes SHALL exist on `Snippet.title`, `Snippet.code`, and `Tag.name` (added in the init migration SQL).
- **DM-8** Indexes SHALL exist on foreign-key / frequent-filter columns: `Snippet.ownerId`, `Snippet.collectionId`, `Snippet.language`, `Snippet.title`, `Snippet.updatedAt`, `Collection.ownerId`, `Collection.visibility`, `Membership.collectionId`, `SnippetTag.tagId`.

### 3.5 Authentication & Authorization Requirements

#### 3.5.1 OAuth & session flows

- **AR-1** The system SHALL use Auth.js v5 with providers GitHub and Google; the `PrismaAdapter` persists users/accounts/sessions in our Postgres.
- **AR-2** Session strategy SHALL be `database` (uses the `Session` table); the `session` callback SHALL attach `user.id` and `user.role` to the session object (type-augmented in `types/next-auth.d.ts`).
- **AR-3** Middleware cookie names differ by transport: `authjs.session-token` (http) and `__Secure-authjs.session-token` (https); both SHALL be checked.
- **AR-4** Protected route prefixes (edge): `PROTECTED_PREFIXES = ["/dashboard", "/snippets/new", "/collections"]`, `ADMIN_PREFIXES = ["/admin"]`; matcher covers `/dashboard/:path*`, `/snippets/new`, `/collections/:path*`, `/admin/:path*`.

#### 3.5.2 RBAC permission matrix

The following matrix is the authoritative statement of who can do what. "Owner" means the `User` who owns the resource (snippet `ownerId` / collection `ownerId`). "Member (ROLE)" means a `Membership` row with that `MembershipRole` on a `TEAM` collection.

| Action | Unauth. | USER | Global ADMIN | Member VIEWER | Member EDITOR | Member ADMIN | Owner (any role) |
|--------|---------|------|--------------|---------------|---------------|--------------|------------------|
| Sign in (OAuth) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Access `/dashboard`, `/snippets/new`, `/collections` | ❌ (redirect) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create own snippet | Denied | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit/delete own snippet | Denied | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit/delete **another** user's snippet | Denied | ❌ | ❌* | ❌ | ❌ | ❌ | n/a |
| Access `/admin` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ (unless global ADMIN) |
| View `PUBLIC` collection & its snippets (incl. anonymous) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View `TEAM` collection (as member) | ❌ | ❌ | ❌* | ✅ | ✅ | ✅ | ✅ (if owner) |
| Edit `TEAM` collection / its snippets | Denied | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ (owner only) |
| Manage collection membership | Denied | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ (owner only) |

\* A global `ADMIN` is not automatically a collection member; per the source docs, global `ADMIN` can edit any `TEAM` collection (matrix row "Edit TEAM collection" lists ADMIN ✅) but is not granted implicit membership and therefore **cannot** manage a collection's membership — only the collection owner or a `MembershipRole.ADMIN` member can (see `API_CONTRACT.md` §4.7, `THREAT_MODEL.md` TM-E-01, ADR-004). **\*\*`PUBLIC` collections are readable by **anyone, including unauthenticated (anonymous) users** (decided; resolves open item R-6) via `listVisibleCollections` / a public listing; `PRIVATE`/`TEAM` collections remain auth-gated (see FR-44/45/46, NFR-24, §3.5.2).

- **AR-5** `requireUser()` SHALL throw `UNAUTHORIZED` if no session; `requireAdmin()` SHALL throw `FORBIDDEN` if `user.role !== ADMIN`.
- **AR-6** `canEditCollection(collectionId, userId)` SHALL return true if the user is the collection owner OR holds `EDITOR`/`ADMIN` `MembershipRole`; otherwise false. This helper SHALL be used by RSC/Server Actions for collection-scoped edits.

---

## 4. Requirement Traceability Matrix

Maps each major requirement group / key IDs to the phase(s) that implement them.

| Requirement group / IDs | Phase 0 (Setup & Data Modeling) | Phase 1 (Auth & RBAC) | Phase 2 (MVP Build) | Phase 3 (Mutations & UX) | Phase 4 (Polish & Ship) |
|-------------------------|:---:|:---:|:---:|:---:|:---:|
| Stack/scaffold, Tailwind, Shadcn, Prisma init (AR, NFR-13/15/16/17) | ✅ | | | | |
| Data model + enums + indexes (§3.4, DM-1…DM-8, FR-7/8/20/21 fields) | ✅ | (adapter models) | | | |
| `pg_trgm` GIN indexes (DM-7) | ✅ | | | | |
| Auth provider decision + OAuth apps (FR-1/2, AR-1) | (install) | ✅ | | | |
| Auth.js config, `auth()`, session strategy (FR-3/4, AR-2) | | ✅ | | | |
| Middleware cookie-presence RBAC (FR-6, FR-27, AR-3/4) | (stub) | ✅ | | | |
| RBAC helpers `requireUser/Admin/canEditCollection` (FR-28/29, AR-5/6) | | ✅ | | ✅ (used) | |
| Sign-in / user menu UI (FR-5) | | ✅ | (shell) | | |
| RSC dashboard/layout, route structure (FR-9 read, NFR-1) | | (layout) | ✅ | | |
| Syntax highlighting Shiki server-side (FR-13) | | | ✅ | | (theme sync) |
| Live search ILIKE + trgm (FR-17/18/19) | | | ✅ | | |
| Tagging engine display/filter (FR-14/15/16) | | | ✅ | ✅ (mutations) | |
| Collections visibility listing (FR-22/23) | | | ✅ | ✅ (mutations) | |
| Anonymous PUBLIC read + mutation/PRIVATE-TEAM denial (FR-44/45/46, NFR-24) | | ✅ (middleware allowance) | ✅ (RSC read) | ✅ (action denial) | |
| Loading/skeletons (FR-43, NFR-4) | | | ✅ | ✅ | |
| Zod validation schemas (FR-32/33, NFR-7) | | | | ✅ | |
| Server Actions CRUD (FR-7/10/11/20/21, FR-31) | | | (stubs) | ✅ | |
| Optimistic UI + toasts (FR-34/35) | | | | ✅ | |
| Pagination (FR-36, NFR-19) | | | | ✅ | |
| Revalidation (FR-37) | | | | ✅ | |
| a11y audit / WCAG AA (FR-40, NFR-20/21/22/23) | | | | | ✅ |
| Core Web Vitals (NFR-2/3/4) | | | | | ✅ |
| OpenGraph / metadata / SEO (FR-41/42) | | | | | ✅ |
| Dark mode (FR-38) | | | | | ✅ |
| Deploy Vercel + Neon, `migrate deploy` (NFR-16/17, AR) | | | | | ✅ |
| CI/CD (lint/typecheck) (NFR-15) | | | | | ✅ (optional) |

---

## 5. Appendices

### A. Risks & Open Decisions

| ID | Risk / Open decision | Source | Mitigation / Status |
|----|----------------------|--------|---------------------|
| R-1 | **Auth.js v5 is beta** — API churn possible. | [P0]/[P1] | Isolate all config in `lib/auth.ts`; pin version in `package.json`; type augmentation in `types/next-auth.d.ts`. |
| R-2 | **RSC vs client boundaries** — risk of over-clientizing. | [PLAN] | Default to server; keep interactive islands small (forms, search, optimistic list). |
| R-3 | **Search at scale** — `ILIKE` + trgm sufficient only to MVP volume. | [PLAN]/[P2] | Defer full-text (`tsvector`) / Algolia; architecture permits later swap without domain-model change (NFR-18). |
| R-4 | **Supabase vs Neon** — soft decision. | [P0] | Neon recommended (Vercel branching, pooled URLs); schema/Prisma identical, only `DATABASE_URL` changes (NFR-16). |
| R-5 | **Edge middleware cannot query DB** — only cookie check possible. | [P1] | Authoritative checks in RSC/Server Actions via `auth()` + `lib/rbac.ts` (FR-27/28). |
| R-6 | **Unauthenticated access to `PUBLIC` collections** — DECIDED. | [P1]/[P2] | **Resolved:** `PUBLIC` collections SHALL be viewable by unauthenticated (anonymous) users; anonymous users can READ `PUBLIC` collections and their snippets but cannot mutate anything. `PRIVATE`/`TEAM` remain auth-gated. Rationale: enables public sharing/discovery of snippets while keeping the entire mutation surface authenticated. (Supersedes prior "open" framing; see FR-44/45/46, NFR-24, §3.5.2.) |
| R-7 | **Connection exhaustion in serverless.** | [P0]/[P4] | Pooled `DATABASE_URL` at runtime; `DATABASE_URL_DIRECT` for migrate/seed; Prisma singleton. |
| R-8 | **Dark-mode flash / Shiki theme mismatch.** | [P4] | `next-themes` `suppressHydrationWarning` + class strategy; server renders matching theme. |
| R-9 | **`migrate dev` against prod fails.** | `migrate deploy` in `vercel-build` only. | [P4] |

### B. Glossary (supplement to §1.3)

- **Collection** — a user-created group of snippets with a visibility setting.
- **Membership** — a per-collection association of a user to a `MembershipRole`.
- **Optimistic UI** — UI updates immediately on user action and reconciles with the server result.
- **Revalidation** — Next.js cache invalidation (`revalidatePath`/`revalidateTag`) to refresh RSC output after a mutation.
- **Trigram** — a 3-character substring used by `pg_trgm` for fuzzy/substring indexing.
- **Server Action** — an async server function invoked from a form/component, the sole mutation mechanism in MVP.

### C. Future / Post-MVP

- **Real-time multi-user collaborative editing** (live cursors, CRDT/OT) — explicitly deferred in [PLAN] non-goals.
- **Native mobile applications** — responsive web only for MVP.
- **AI-assisted features** — out of scope for MVP.
- **Full-text search / Algolia** — migrate from `ILIKE` + `pg_trgm` to Postgres `tsvector` full-text or an external search service as data volume grows (NFR-18).
  - **Unauthenticated public snippet/collection browsing** — NOW IN SCOPE for `PUBLIC` collections (decided; R-6 resolved — see FR-44). `PRIVATE`/`TEAM` collections remain auth-gated.
- **Additional OAuth providers / SSO** — architecture permits adding providers in `lib/auth.ts`.
- **Collection member management UI** — `addMember` action exists; full membership administration UI may be expanded post-MVP.

---

*This SRS is derived solely from `IMPLEMENTATION_PLAN.md` and `docs/PHASE_0..4_*.md`. It introduces no new requirements that contradict those documents and is intended as the requirements baseline for the DCodeBook MVP.*

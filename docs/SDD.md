# DCodeBook — Software Design Document (SDD)

> **Document type:** Software Design Document (IEEE-1016-inspired, practical)
> **Project:** DCodeBook — a real-time full-stack knowledge base & code snippet canvas for developers
> **Status:** 🟡 Draft for review — derived from the locked planning documents (no code yet)
> **Source of truth:** `IMPLEMENTATION_PLAN.md` and the five phase docs under `docs/` (see §1.4), plus the locked decisions captured in the project brief.

---

## 1. Introduction

### 1.1 Purpose

This Software Design Document (SDD) describes **how** DCodeBook is built — the
component boundaries, data flow, module ownership, caching, error handling, and
security design that implement the requirements in the SRS. It is the
architectural companion to the requirements baseline and the phase delivery
docs. Where this document shows code, the snippets are **illustrative only**
and clarify a design decision; they are not committed application files.

### 1.2 Scope

This SDD covers the design of the MVP described across Phases 0–4:

- **Architecture** — the full request/response flow from browser to Postgres,
  and where auth, RBAC, and caching sit (§2).
- **Component design** — server vs. client component boundaries per feature
  area (§3).
- **Data flow / sequence diagrams** — OAuth login, anonymous PUBLIC read,
  authenticated snippet creation, and search (§4).
- **Module / folder responsibility map** — ownership of `app/`, `components/`,
  `lib/`, `prisma/`, `actions/`, `middleware.ts` (§5).
- **Caching & revalidation strategy** — `revalidatePath`/`revalidateTag`,
  static/ISR for PUBLIC pages, dynamic for PRIVATE/TEAM (§6).
- **Error handling strategy** — typed Server Action results, `error.tsx`,
  `not-found.tsx`, validation/forbidden handling (§7).
- **Security design** — layered RBAC, IDOR prevention, anonymous boundary,
  session handling (§8).
- **Cross-references** — SRS requirement IDs (FR-*, NFR-*, AR-*) and phase
  doc sections throughout (§9 and inline).

### 1.3 Definitions, Acronyms & Abbreviations

See the SRS §1.3 glossary (`RSC`, `RBAC`, `OAuth`, `ORM`, `ILIKE`, `GIN`,
`pg_trgm`, `MAU`, `CWV`, `a11y`, `OG`, `CSRF`, `cuid`, `Prisma Adapter`,
`Vercel`, `Neon`/`Supabase`, `LCP`/`INP`/`CLS`, `SLA`). This SDD adds:

| Term | Definition |
|------|------------|
| **ISR** | Incremental Static Regeneration — Next.js static generation with on-demand/time-based revalidation. |
| **Edge runtime** | The Vercel/Next.js middleware runtime; no direct database access. |
| **Node runtime** | The serverless runtime used for RSC and Server Actions; can reach Postgres via Prisma. |
| **Optimistic UI** | UI updates immediately on user action and reconciles with the server result. |

### 1.4 References

| Ref | Document | Relative path |
|-----|----------|---------------|
| [PLAN] | DCodeBook High-Level Implementation Plan | `../IMPLEMENTATION_PLAN.md` |
| [SRS] | DCodeBook Software Requirements Specification | `./SRS.md` |
| [P0] | Phase 0 — Setup & Data Modeling | `./PHASE_0_SETUP_AND_DATA_MODELING.md` |
| [P1] | Phase 1 — Authentication & RBAC | `./PHASE_1_AUTH_AND_RBAC.md` |
| [P2] | Phase 2 — MVP Build | `./PHASE_2_MVP_BUILD.md` |
| [P3] | Phase 3 — Mutations & UX | `./PHASE_3_MUTATIONS_AND_UX.md` |
| [P4] | Phase 4 — Polish & Ship | `./PHASE_4_POLISH_AND_SHIP.md` |

### 1.5 Locked Decisions (must not be contradicted)

These are fixed by the project brief and the source docs; the design below
conforms to all of them:

- **Auth:** Auth.js v5 (NextAuth.js), GitHub + Google OAuth, Prisma adapter
  (NOT Clerk; Clerk is an alternative only). Session strategy = `database`.
- **Syntax highlighting:** Shiki, server-side, **zero client JS** (NOT Prism).
- **DB:** Neon (soft-preferred) or Supabase, PostgreSQL, Prisma ORM.
- **Package manager:** `pnpm`.
- **Data model entities:** `User` (field is **`image`**, NOT `avatar`),
  `Snippet`, `Tag`, `SnippetTag`, `Collection`, `Membership`. Enums:
  `Role` (`USER`|`ADMIN`), `Visibility` (`PRIVATE`|`PUBLIC`|`TEAM`),
  `MembershipRole` (`VIEWER`|`EDITOR`|`ADMIN`).
- **PUBLIC collections:** readable by anonymous/unauthenticated users. Anon can
  READ PUBLIC collections + their snippets ONLY. ALL mutations are auth-gated.
  PRIVATE/TEAM access is auth-gated.
- **Middleware:** cookie-presence check ONLY (edge runtime, cannot query DB).
  Authoritative role/membership checks happen in RSC/Server Actions via
  `auth()` + `lib/rbac.ts`. Middleware does NOT block PUBLIC read routes.
- **Search:** Postgres `ILIKE` + `pg_trgm` GIN indexes on `Snippet.title`,
  `Snippet.code`, and `Tag.name`.
- **Prod migrations:** `prisma migrate deploy` (NOT `migrate dev`) in the
  Vercel build step.
- **Tech stack:** Next.js 15 App Router, React 19, RSC, Server Actions,
  Tailwind CSS + Shadcn UI, TypeScript strict.
- **Hosting:** Vercel + managed Postgres (Neon or Supabase).
- **Mutations:** Server Actions with Zod validation, `useOptimistic` /
  `useTransition` on the client, `revalidatePath` / `revalidateTag` after
  mutations.

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                                │
│   RSC-rendered HTML + minimal client islands (forms, search, optimistic)   │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │  HTTP request (cookie may be present)
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              Next.js MIDDLEWARE  (edge runtime — NO DB access)              │
│                                                                            │
│   cookie-presence check ONLY:                                              │
│     sessionCookie = authjs.session-token                                   │
│                    ?? __Secure-authjs.session-token                        │
│                                                                            │
│   PROTECTED_PREFIXES = ["/dashboard","/snippets/new","/collections"]       │
│   ADMIN_PREFIXES     = ["/admin"]                                          │
│                                                                            │
│   • anon + protected route  ──► redirect /sign-in?callbackUrl=...          │
│   • anon + PUBLIC read route ──► PASS (middleware does NOT block it)       │
│   • authed                  ──► PASS                                       │
│                                                                            │
│   ⚠ Authoritative role/membership checks are NOT done here (no DB).        │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │  (request proceeds to route)
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     Next.js APP ROUTER  (Node runtime)                     │
│                                                                            │
│   ┌─────────────────────────────┐      ┌──────────────────────────────┐  │
│   │  RSC (Server Component)      │      │  Server Action ("use server") │  │
│   │  — data fetching / display   │      │  — mutations                  │  │
│   │                             │      │                               │  │
│   │  auth()  ───────────────┐   │      │  requireUser()  ─────────┐    │  │
│   │  lib/rbac.ts             │   │      │  Zod validation          │    │  │
│   │   canViewCollection()    │   │      │  lib/rbac.ts            │    │  │
│   │   requireUser/Admin()    │   │      │   canEditCollection()   │    │  │
│   │  lib/search.ts (ILIKE)   │   │      │  Prisma mutation        │    │  │
│   │  lib/highlight.ts        │   │      │  revalidatePath/Tag ────┼──┐ │  │
│   │   (Shiki, server-side)   │   │      │                          │  │ │  │
│   └────────────┬─────────────┘      └──────────────┬────────────┘  │ │  │
│                │ Prisma Client                       │ Prisma Client │ │  │
└────────────────┼─────────────────────────────────────┼──────────────┼─┼──┘
                 │                                     │              │ │
                 ▼                                     ▼              │ │
┌──────────────────────────────────────────────────────────────────────────┐
│                       Prisma ORM  (lib/prisma.ts singleton)                │
└──────────────────────────────────────────────────────────────────────────┘
                 │                                     │
                 ▼                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│        PostgreSQL  (Neon soft-preferred / Supabase)                        │
│   • Domain tables: User, Snippet, Tag, SnippetTag, Collection, Membership  │
│   • Auth.js tables: Account, Session, VerificationToken                    │
│   • pg_trgm GIN indexes on Snippet.title, Snippet.code, Tag.name           │
└──────────────────────────────────────────────────────────────────────────┘

CACHING LAYER (Next.js Data Cache / Full Route Cache):
   • PUBLIC collection pages  ──► static / ISR (edge-cacheable, anonymous)
   • PRIVATE / TEAM pages     ──► dynamic (per-user session)
   • After mutations          ──► revalidatePath / revalidateTag invalidates
```

### 2.2 Auth Flow (OAuth → session)

```
User
  │  visits /sign-in
  ▼
[app/sign-in/page.tsx]  (RSC shell)  ──► renders <SignInButtons/> (client)
  │  user clicks "Continue with GitHub/Google"
  ▼
[components/sign-in-buttons.tsx]  ──► signIn("github"|"google", { callbackUrl:"/dashboard" })
  │  (client-safe signIn re-exported from lib/auth.ts)
  ▼
OAuth Provider (GitHub / Google)  ──► user authorizes
  │  redirect to …/api/auth/callback/{github,google}
  ▼
[app/api/auth/[...nextauth]/route.ts]  ──► handlers (GET/POST)
  │  Auth.js v5 + PrismaAdapter
  ▼
Prisma writes:  User (auto-created on first login, FR-2) + Account + Session
  │  session callback attaches user.id + user.role to the session (AR-2)
  ▼
Session cookie set:  authjs.session-token (http) / __Secure-authjs.session-token (https)
  │
  ▼
Redirect to callbackUrl (/dashboard)
  │
  ▼
Subsequent RSC / Server Actions read the session via auth() (FR-4)
```

### 2.3 Where Auth, RBAC, and Caching Sit

| Concern | Layer | Mechanism |
|---------|-------|-----------|
| Coarse gate (cookie presence) | Edge middleware | `middleware.ts` checks session cookie; redirects anon away from protected prefixes only. |
| Authoritative auth | RSC / Server Action | `auth()` from `lib/auth.ts` returns the session (incl. `user.id`, `user.role`). |
| Authoritative RBAC | RSC / Server Action | `lib/rbac.ts` helpers (`requireUser`, `requireAdmin`, `canEditCollection`, `canViewCollection`). |
| Mutation auth | Server Action | `requireUser()` rejects anonymous invocations (FR-45 / NFR-24). |
| Caching | Next.js Data/Route Cache | PUBLIC pages static/ISR; PRIVATE/TEAM dynamic; mutations invalidate via `revalidatePath`/`revalidateTag`. |
| Session storage | Postgres `Session` table | `database` strategy via Prisma adapter (FR-3). |

---

## 3. Component Design

### 3.1 Principle: Server-first, small client islands

Per [PLAN] §4 and SRS NFR-1, the default is **RSC** for data fetching and
display; client components (`"use client"`) are limited to interactive islands:
forms, the search input, optimistic lists, theme toggle, and dialogs. This keeps
client JS minimal and supports the Core Web Vitals targets (NFR-2/3/4).

### 3.2 Server vs. Client breakdown by feature area

| Feature area | Server (RSC) parts | Client (`"use client"`) parts | RSC/client boundary & why |
|--------------|--------------------|-------------------------------|---------------------------|
| **Auth / sign-in** ([P1] §1.7) | `app/sign-in/page.tsx` (shell), `app/api/auth/[...nextauth]/route.ts` | `components/sign-in-buttons.tsx` (calls `signIn`) | Boundary at the button: only the click handler needs the client `signIn` helper; the page shell is RSC. |
| **Snippet CRUD** ([P2]/[P3]) | List/detail RSC pages; the Server Action `actions/snippets.ts` | `components/snippet-form.tsx` (`useFormState`/`useFormStatus`), `components/snippet-list.tsx` (`useOptimistic`/`useTransition`) | Boundary at the form/list: RSC renders initial data; client handles optimistic submit + pending state. Mutation logic stays server-side. |
| **Snippet editor + Shiki** ([P2] §2.3) | `app/(app)/snippets/[id]/page.tsx` and `/new`, `lib/highlight.ts` | None for highlighting | **Shiki runs entirely in the RSC** (`lib/highlight.ts` is server-only). Highlighted HTML is emitted server-side with **zero client JS** (FR-13). Never import `lib/highlight.ts` into a client component. |
| **Search** ([P2] §2.4) | `lib/search.ts` (ILIKE query), the `/snippets` RSC that re-renders results | `components/search-box.tsx` (updates `?q=` via `router.replace`) | Boundary at the input: client only writes the URL query param; the RSC reads `?q=` and re-renders (no client fetch). Keeps JS minimal while feeling "live" (FR-19). |
| **Collections** ([P2] §2.6) | `app/(app)/collections/page.tsx`, `app/(app)/collections/[id]/page.tsx`, `lib/collections.ts` (`listVisibleCollections`, `listPublicCollections`) | `components/collection-form.tsx`, `components/visibility-badge.tsx` (display only, can be server) | Boundary at the editor form. Listing/detail are RSC; visibility logic is enforced server-side. |
| **Membership / admin** ([P1]/[P3]) | `actions/memberships.ts`, `app/admin/*` (RSC, `requireAdmin`) | Membership management form (client) | Boundary at the form. `requireAdmin` enforces global `ADMIN` in RSC/Action (FR-28, AR-5). |
| **Dashboard** ([P2] §2.2) | `app/(app)/dashboard/page.tsx` (RSC, `auth()` + Prisma) | `components/sidebar.tsx` (can be server), `components/user-menu.tsx` (dropdown needs client), `components/theme-toggle.tsx` (client) | Boundary at interactive widgets; data is server-fetched. |

### 3.3 Shiki highlighting is server-side (zero client JS)

The snippet detail RSC calls `highlight(code, lang, dark)` (from
`lib/highlight.ts`, server-only) and injects the resulting HTML via
`dangerouslySetInnerHTML`. This is safe because the HTML is generated from
application-stored code, not user-injected HTML (NFR-10). The client receives
fully highlighted markup with **no highlighter bundle** — satisfying FR-13 and
supporting the CLS target (NFR-4) because Shiki output has stable height.

---

## 4. Data Flow / Sequence Diagrams

Each flow is a numbered, text-based sequence. Cross-references to requirements
are inline.

### 4.1 (a) OAuth login flow

```
1.  User navigates to /sign-in (RSC shell renders SignInButtons).
2.  User clicks "Continue with GitHub" → client signIn("github", { callbackUrl:"/dashboard" }).
3.  Browser redirected to GitHub OAuth consent screen.
4.  User authorizes → GitHub redirects to …/api/auth/callback/github.
5.  Auth.js handlers (app/api/auth/[...nextauth]/route.ts) verify the code.
6.  PrismaAdapter:
      - first login → auto-create User (field: image, role defaults USER) + Account (FR-2).
      - create Session row (database strategy, FR-3).
7.  session callback attaches user.id + user.role to the session object (AR-2).
8.  Session cookie set (authjs.session-token / __Secure-authjs.session-token, AR-3).
9.  Browser redirected to callbackUrl (/dashboard).
10. Dashboard RSC calls auth() → session present → renders personalized UI.
```
*Cross-refs: FR-1, FR-2, FR-3, FR-4, AR-1, AR-2, AR-3, [P1] §1.3–1.4.*

### 4.2 (b) Anonymous PUBLIC collection read

```
1.  Anonymous user (no session cookie) requests /collections/[id] for a PUBLIC collection.
2.  Middleware runs:
      - route is NOT in PROTECTED_PREFIXES/ADMIN_PREFIXES (only /collections/:path* is protected
        for the LIST; the detail read is allowed through — middleware does NOT block PUBLIC reads).
      - no session cookie → but this is a PUBLIC read route → PASS (no redirect).
3.  RSC for /collections/[id] executes:
      - auth() returns null (anonymous).
      - lib/rbac.ts canViewCollection(collectionId, undefined):
          • collection.visibility === "PUBLIC" → returns true (FR-44, NFR-24).
      - Prisma fetches the collection + its snippets (scoped, no owner filter needed for PUBLIC).
      - For each snippet, lib/highlight.ts renders Shiki HTML (server-side, zero client JS).
4.  RSC returns fully-rendered HTML (highlighted code, tags as badges).
5.  Client receives HTML; no session required; no mutation surface exposed.
6.  (Caching) This PUBLIC page may be served from the static/ISR cache (see §6).
```
*Cross-refs: FR-44, FR-9, NFR-24, AR-4, [P1] §1.5, [P2] §2.6.*

### 4.3 (c) Authenticated snippet creation

```
1.  Authenticated user opens /snippets/new (RSC editor; middleware passed because cookie present).
2.  Client renders <SnippetForm/> with useFormState/useFormStatus.
3.  User submits → client calls Server Action createSnippet(formData).
4.  Server Action (actions/snippets.ts):
      a. requireUser() → auth() returns session; if null → throws UNAUTHORIZED (FR-45).
      b. snippetSchema.safeParse(...) → Zod validation (FR-32, NFR-7).
         - on failure → return { error: fieldErrors } (typed result, NO 500) (FR-33).
      c. prisma.snippet.create({ data: { ...validated, ownerId: user.id,
         tags: connectOrCreate by unique name } })  (FR-8, FR-14, DM-2).
      d. revalidatePath("/snippets"); revalidatePath("/dashboard") (FR-37).
      e. return { ok: true, snippetId }.
5.  Client:
      - on ok → sonner toast "saved"; optimistic list reconciles with real id.
      - on error → field errors shown via Shadcn form/label; toast on global failure.
6.  useOptimistic had inserted a temp item; on success it is replaced by server data
   (or the revalidated RSC list reflects the new row) (FR-34, FR-35).
```
*Cross-refs: FR-7, FR-8, FR-10, FR-31, FR-32, FR-33, FR-34, FR-35, FR-37, FR-45, NFR-7, NFR-8, AR-5, [P3] §3.2–3.4.*

### 4.4 (d) Search flow

```
1.  User types in <SearchBox/> (client island).
2.  onChange → router.replace(`/snippets?q=<term>`) (debounced/submission-driven) (FR-19).
3.  /snippets RSC re-renders (no client fetch):
      - reads ?q= and ?tag= from searchParams.
      - for an authenticated user: lib/search.ts → searchSnippets(userId, term)
        (scoped to ownerId; OR on title/code/tags.name, mode insensitive → ILIKE).
      - for anonymous on a PUBLIC browse surface: scoped to visibility:"PUBLIC" only
        (FR-44/NFR-24); MUST NOT return PRIVATE/TEAM data.
4.  Prisma compiles contains + mode:"insensitive" → Postgres ILIKE,
   using pg_trgm GIN indexes on Snippet.title, Snippet.code, Tag.name (FR-18, DM-7).
5.  Results limited (take: 50) and ordered by updatedAt desc (FR-19, NFR-19).
6.  RSC returns highlighted-free list HTML; client shows results.
```
*Cross-refs: FR-17, FR-18, FR-19, NFR-18, NFR-19, DM-7, [P2] §2.4.*

---

## 5. Module / Folder Responsibility Map

The structure below expands [PLAN] §8 and assigns ownership. Paths use the
`@/*` import alias (configured in Phase 0).

```
DCodeBook/
  app/                         # App Router: routes, layouts, pages (RSC by default)
  components/                  # Shadcn UI primitives (components/ui) + custom components
  lib/                         # auth, rbac, prisma singleton, search, highlight, validations, utils
  prisma/                      # schema.prisma, migrations/, seed.ts
  actions/                     # Server Actions grouped by domain
  middleware.ts                # edge cookie-presence RBAC gate
  types/next-auth.d.ts         # session.user.role type augmentation
```

### 5.1 `app/` — routes, layouts, pages

| Route | Type | Auth | Owner / Notes |
|-------|------|------|---------------|
| `/` (home / explore) | RSC | **Public** | Landing / public browse entry. May link to PUBLIC collections. |
| `/sign-in` | RSC shell + client buttons | **Public** | OAuth entry ([P1] §1.7). |
| `/api/auth/[...nextauth]/route.ts` | Route handler | Public (OAuth) | `handlers` from `lib/auth.ts` (FR-1, AR-1). |
| `app/(app)/layout.tsx` | RSC | Protected | Authenticated shell: `auth()` + redirect; sidebar, `UserMenu`, skip-link ([P1] §1.8, [P2] §2.2, [P4] §4.1). |
| `app/(app)/dashboard/page.tsx` | RSC | **Protected** | Recent snippets + collection count. |
| `app/(app)/snippets/page.tsx` | RSC | **Protected** (list of own) | List + search via `lib/search.ts`. |
| `app/(app)/snippets/[id]/page.tsx` | RSC | **Public-if-PUBLIC** | Detail + Shiki. If snippet belongs to a PUBLIC collection, anonymous may view; else auth-gated (canViewCollection). |
| `app/(app)/snippets/new/page.tsx` | RSC + client form | **Protected** | Editor; `middleware` blocks anon (`/snippets/new`). |
| `app/(app)/snippets/[id]/edit/page.tsx` | RSC + client form | **Protected** | Editor; ownership enforced in action. |
| `app/(app)/collections/page.tsx` | RSC | **Protected** (list) | `listVisibleCollections` (own + PUBLIC + TEAM membership). |
| `app/(app)/collections/[id]/page.tsx` | RSC | **Public-if-PUBLIC** | Detail; anonymous allowed only when `visibility === PUBLIC` (canViewCollection). |
| `/admin/*` (e.g., `app/admin/page.tsx`) | RSC | **Protected + ADMIN** | `requireAdmin()`; middleware + RSC both gate (FR-28, AR-5). |
| `/settings` (optional) | RSC | **Protected** | User settings; auth-gated. |
| `app/opengraph-image.tsx` | RSC | Public | Dynamic OG image ([P4] §4.3). |
| `app/robots.ts`, `app/sitemap.ts` | RSC | Public | SEO ([P4] §4.5). |
| `app/(app)/snippets/loading.tsx`, `loading.tsx` | RSC | per route | Skeleton fallbacks (FR-43, NFR-4). |
| `app/(app)/error.tsx`, `app/(app)/not-found.tsx` | RSC/Client | per route | Error boundaries (§7). |

> **Public vs. protected summary.** Public: `/`, `/sign-in`, PUBLIC collection
> detail + its snippet details, `/api/auth/*`, OG/robots/sitemap. Protected
> (redirect anon): `/dashboard`, `/snippets/new`, `/collections`, `/admin`,
> `/settings`, and any editor route. Middleware enforces the *prefix* gate; the
> RSC enforces the *resource* gate (visibility/ownership) for detail routes
> ([P1] §1.5, AR-4).

### 5.2 `components/` — shared UI

| Component | Type | Responsibility |
|-----------|------|----------------|
| `components/ui/*` | Shadcn (copy-in) | `button`, `input`, `textarea`, `label`, `card`, `dialog`, `dropdown-menu`, `sonner`, `form`, `table`, `badge`, `avatar`, `skeleton`, `tabs`, `select`, `popover`, `command`. |
| `components/sidebar.tsx` | Server (or client) | Nav within `(app)` layout. |
| `components/user-menu.tsx` | Client | Avatar (`image` field) + sign-out dropdown ([P1] §1.8). |
| `components/sign-in-buttons.tsx` | Client | OAuth buttons → `signIn` ([P1] §1.7). |
| `components/search-box.tsx` | Client | Writes `?q=` to URL ([P2] §2.4). |
| `components/snippet-form.tsx` | Client | `useFormState`/`useFormStatus` form ([P3] §3.4). |
| `components/snippet-list.tsx` | Client | `useOptimistic`/`useTransition` list ([P3] §3.3). |
| `components/collection-form.tsx` | Client | Collection editor. |
| `components/visibility-badge.tsx` | Server | Renders `Visibility` state. |
| `components/theme-toggle.tsx` | Client | Dark-mode toggle ([P4] §4.4). |
| `components/providers.tsx` | Client | `next-themes` provider ([P4] §4.4). |

> Note: `User.image` (NOT `avatar`) is the field rendered by `avatar`/menu
> components — consistent with the locked data model ([P0] schema, SRS §3.4).

### 5.3 `lib/` — core logic

| File | Responsibility | Notes |
|------|----------------|-------|
| `lib/auth.ts` | Auth.js v5 config: `handlers`, `auth`, `signIn`, `signOut`; providers GitHub+Google; `PrismaAdapter`; `session` callback attaching `id`+`role`; `pages.signIn="/sign-in"`. | Isolated so a future provider swap is localized (NFR-14, R-1). |
| `lib/rbac.ts` | Permission helpers: `requireUser()`, `requireAdmin()`, `canEditCollection(collectionId, userId)`, `canViewCollection(collectionId, userId?)`. | Authoritative RBAC used by RSC + Server Actions (FR-28, AR-5, AR-6, [P1] §1.6). |
| `lib/prisma.ts` | **Prisma client singleton** (the `lib/db.ts` role in planning outlines). | Avoids connection exhaustion in serverless (NFR-11, R-7, [P0] §0.5). |
| `lib/search.ts` | `searchSnippets(userId, term)` and a PUBLIC-scoped variant; `ILIKE` via Prisma `contains` + `mode:"insensitive"`. | Backed by `pg_trgm` GIN (FR-18, DM-7). |
| `lib/highlight.ts` | `highlight(code, lang, dark)` — Shiki server-side. | Server-only; zero client JS (FR-13). |
| `lib/collections.ts` | `listVisibleCollections(userId)`, `listPublicCollections()`. | Visibility-aware queries ([P2] §2.6). |
| `lib/tags.ts` | `getPopularTags(userId)`. | Tag queries ([P2] §2.5). |
| `lib/validations.ts` | Zod `snippetSchema`, `collectionSchema`. | Shared server-boundary validation (FR-32, [P3] §3.1). |
| `lib/utils.ts` | `cn()` class merge (Shadcn standard). | — |

> **Naming note:** the Prisma client singleton is `lib/prisma.ts` throughout the
> SRS and all phase docs (e.g., SRS §3.1.3, [P0] §0.5). This SDD uses that
> canonical name; planning outlines that call it `lib/db.ts` refer to the same
> module.

### 5.4 `prisma/` — schema, migrations, seed

| Path | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | All domain models (`User`, `Snippet`, `Tag`, `SnippetTag`, `Collection`, `Membership`) + enums (`Role`, `Visibility`, `MembershipRole`) + Auth.js models (`Account`, `Session`, `VerificationToken`). |
| `prisma/migrations/` | SQL migrations. Init migration includes `CREATE EXTENSION pg_trgm` + GIN trigram indexes on `Snippet.title`, `Snippet.code`, `Tag.name` (DM-7). |
| `prisma/seed.ts` | Demo data for local dev (wired via `package.json` `prisma.seed`). |

### 5.5 `actions/` — Server Actions (grouped by domain)

All `"use server"`; all call `requireUser()` first (FR-31, FR-45).

| File | Actions | Auth / checks |
|------|---------|---------------|
| `actions/snippets.ts` | `createSnippet`, `updateSnippet` (owner check), `deleteSnippet` (owner check), `loadMore(cursor)` | `requireUser`; ownership enforced; Zod `snippetSchema`. |
| `actions/collections.ts` | `createCollection`, `updateCollectionVisibility`, `deleteCollection` | `requireUser`; `canEditCollection` for updates/deletes. |
| `actions/memberships.ts` | `addMember`, `removeMember`, `updateMemberRole` | `requireUser`; `canEditCollection` (ADMIN membership role). |
| `actions/tags.ts` | tag connect/manage helpers used by snippet mutations | `requireUser`; scoped by snippet ownership. |

### 5.6 `middleware.ts` — edge cookie-presence gate

- Runs at the edge; **no Prisma/`auth()`** (no DB) (FR-27, AR-3, R-5).
- Checks both `authjs.session-token` and `__Secure-authjs.session-token`.
- Redirects anon away from `PROTECTED_PREFIXES` (`/dashboard`, `/snippets/new`,
  `/collections`) and `ADMIN_PREFIXES` (`/admin`) to `/sign-in?callbackUrl=...`.
- **Does NOT block PUBLIC collection read routes** — those pass through and are
  authorized in the RSC via `canViewCollection` ([P1] §1.5, AR-4).

---

## 6. Caching & Revalidation Strategy

### 6.1 Static / ISR for PUBLIC pages

Because PUBLIC collections and their snippets are **anonymous-readable**, their
detail pages (`/collections/[id]` when `visibility === PUBLIC`, and snippet
details within them) can be rendered statically and served from the CDN/edge
cache. Design:

- PUBLIC collection/snippet pages are rendered without a per-user session
  dependency, so they are eligible for **static generation / ISR**.
- Use `revalidateTag` (or time-based `revalidate`) so that when a PUBLIC
  collection's snippets change, the cached page is invalidated (see §6.3).
- This directly supports LCP < 2.5s (NFR-2) because anonymous visitors get
  pre-rendered HTML at the edge.

### 6.2 Dynamic for PRIVATE / TEAM pages

- Any RSC that calls `auth()` (e.g., `/dashboard`, `/snippets` list,
  `/collections` list, editor routes) is **dynamic** per request because the
  output depends on the user's session.
- PRIVATE/TEAM collection detail pages are dynamic and gated by
  `canViewCollection` — they must never be cached for anonymous users (NFR-24).
- These pages should not be statically cached; Next.js marks them dynamic once
  `auth()` / cookies are read.

### 6.3 Revalidation triggers per mutation type

After a Server Action mutates data, it calls `revalidatePath` (primary, since
we use Prisma directly) and `revalidateTag` where a fetch is tagged ([P3] §3.7).

| Mutation | Revalidate calls |
|----------|------------------|
| `createSnippet` / `updateSnippet` / `deleteSnippet` | `revalidatePath("/snippets")`, `revalidatePath("/dashboard")`, `revalidatePath("/snippets/" + id)` (detail), and the parent collection path `revalidatePath("/collections/" + collectionId)` if applicable. |
| `createCollection` / `updateCollectionVisibility` / `deleteCollection` | `revalidatePath("/collections")`, `revalidatePath("/dashboard")`, `revalidatePath("/collections/" + id)`. For PUBLIC collections, also `revalidateTag("public-collections")` (or the public browse route) so the static/ISR cache refreshes. |
| `addMember` / `removeMember` / `updateMemberRole` | `revalidatePath("/collections/" + collectionId)`, `revalidatePath("/collections")`. |
| Tag mutations (within snippet actions) | same as snippet revalidation; optionally `revalidatePath("/snippets?tag=...")`. |

> Rule of thumb ([P3] §3.7): **always revalidate the affected listing routes
> and the specific detail route** after a mutation so RSC output stays
> consistent (FR-37). Prefer `revalidateTag` only when data is fetched via a
> tagged `fetch`; with direct Prisma, `revalidatePath` is the primary tool.

### 6.4 Cache invalidation summary

- **Trigger:** a successful Server Action (auth-gated) is the only writer of
  domain data; it is responsible for invalidation.
- **Anonymous reads are never writers**, so PUBLIC cache entries are only
  invalidated by an authenticated mutation to that PUBLIC collection/snippet.
- **PRIVATE/TEAM** data is never edge-cached for anon; per-user dynamic
  rendering + `revalidatePath` keeps it fresh.

---

## 7. Error Handling Strategy

### 7.1 Server Action error shapes (typed results)

Server Actions return a structured result rather than throwing for
*validation* failures (FR-32, FR-33, [P3] §3.2/3.4):

```ts
// Illustrative only — not a committed file
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Record<string, string[]> | string };
```

- **Validation failure** → return `{ ok: false, error: fieldErrors }` (from
  Zod `safeParse().error.flatten().fieldErrors`). No 500 (FR-32).
- **Auth/role violation** → `requireUser()` / `requireAdmin()` /
  `canEditCollection` throw (`UNAUTHORIZED` / `FORBIDDEN`), which surfaces as a
  500/redirect (FR-33, AR-5). These are exceptional, not "bad input."
- **Client display:** forms read the returned `error` and render field errors
  via Shadcn `form`/`label`; a `sonner` toast reports global failures (FR-35).

### 7.2 Next.js error boundaries

- **`error.tsx`** (route-level, client component) catches render/runtime errors
  in the segment and shows a fallback UI with a "try again" reset. Used in
  `app/(app)/` and possibly per-feature segments.
- **`not-found.tsx`** handles 404s — e.g., a snippet/collection id that does
  not exist (`findUniqueOrThrow` rejection or `notFound()` call). Renders a
  friendly not-found page.
- **`global-error.tsx`** (root) as a last-resort boundary.

### 7.3 Validation error display

- Zod schemas (`lib/validations.ts`) validate at the server boundary (NFR-7).
- Field errors map back to form fields; `useFormStatus().pending` disables
  submit during the request (FR-35, [P3] §3.5).
- Inline spinners for in-page mutations; `loading.tsx` skeletons for navigation
  (FR-43, NFR-4).

### 7.4 Auth / forbidden handling

- **Unauthenticated access to a protected route** → middleware redirects to
  `/sign-in?callbackUrl=...` (FR-6, AR-4). Defense-in-depth: the `(app)` layout
  also calls `auth()` and `redirect("/sign-in")` if absent ([P2] §2.2).
- **Authenticated but forbidden** (e.g., USER hitting `/admin`, or editing
  another user's snippet) → `requireAdmin()` / ownership check throws
  `FORBIDDEN`; the action redirects or returns an error, **never a 500 from a
  missing guard** (FR-11, FR-28, AR-5).
- **Anonymous mutation attempt** → `requireUser()` throws `UNAUTHORIZED`;
  Server Actions reject all unauthenticated invocations (FR-45, NFR-24).

### 7.5 Unexpected server errors

- Caught and surfaced without leaking stack traces to clients (NFR-12).
- Database unavailability should not corrupt data; transactions used where
  appropriate.

---

## 8. Security Design

### 8.1 Layered RBAC enforcement

| Layer | What it enforces | What it CANNOT do |
|-------|------------------|-------------------|
| **Edge middleware** (`middleware.ts`) | Coarse cookie-presence gate on protected prefixes; redirects anon from `/dashboard`, `/snippets/new`, `/collections`, `/admin`. | Cannot query DB → cannot know role/visibility; therefore does NOT block PUBLIC read routes. |
| **RSC** (data-level auth) | `auth()` + `lib/rbac.ts`: `canViewCollection` (anonymous READ only when `visibility === PUBLIC`), ownership/session checks before rendering. | — |
| **Server Actions** (mutation auth) | `requireUser()` (reject anon), `requireAdmin()` (global ADMIN), `canEditCollection` (owner or EDITOR/ADMIN membership) before any Prisma write. | — |

This three-layer model satisfies NFR-5/NFR-24 and FR-27/FR-28: the edge is a
fast coarse gate; the authoritative decision is always in RSC/Server Actions.

### 8.2 IDOR prevention (scope every query)

- **Snippet reads/writes** are always scoped by `ownerId` (FR-8, FR-9, FR-10,
  FR-11). `updateSnippet`/`deleteSnippet` verify `existing.ownerId === user.id`
  before mutating; otherwise `FORBIDDEN` (FR-11, [P3] §3.2).
- **Collection reads** go through `listVisibleCollections` /
  `canViewCollection` — never a raw `findUnique` without a visibility/ownership
  guard ([P2] §2.6 risk note).
- **Membership-scoped edits** use `canEditCollection(collectionId, userId)`
  which checks owner OR `MembershipRole` ∈ {EDITOR, ADMIN} (AR-6, FR-29).
- **Search** is scoped: authenticated users search their own snippets
  (`ownerId`); anonymous PUBLIC browse is scoped to `visibility:"PUBLIC"` and
  MUST NOT return PRIVATE/TEAM rows (FR-44/NFR-24, [P2] §2.4).

### 8.3 Anonymous boundary

- Anonymous users can **only** reach PUBLIC read paths (collection detail +
  its snippets, public browse, sign-in, home, OG/robots/sitemap).
- **All Server Actions require an authenticated session** and reject
  unauthenticated invocations (FR-45, NFR-24). The mutation surface is 100%
  authenticated because anonymous reads are RSC pages, not actions ([P3] §3.2).
- PRIVATE/TEAM collections and their snippets are denied to anonymous users
  (redirected to `/sign-in` by the RSC `canViewCollection` check) (FR-46).

### 8.4 Session handling

- **Strategy:** `database` (Postgres `Session` table) via Prisma adapter
  (FR-3, AR-1/AR-2).
- **Cookie:** `authjs.session-token` (http) / `__Secure-authjs.session-token`
  (https); both checked in middleware (AR-3).
- **Session contents:** `session.user.id` + `session.user.role` attached via the
  `session` callback and type-augmented in `types/next-auth.d.ts` (AR-2, [P1]
  §1.3 technical note).
- **Secrets:** `AUTH_SECRET`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_SECRET`, and DB
  credentials are server-only; only `NEXT_PUBLIC_APP_URL` is public (NFR-6).
- **CSRF:** Server Actions inherit Next.js same-origin protections; they are
  not reachable via unauthenticated cross-site requests that bypass auth checks
  (NFR-9).
- **Sign-out:** clears the session via `signOut()` from the user menu (FR-5).

### 8.5 Input safety

- All Server Action inputs validated with Zod at the boundary; unvalidated
  input never reaches Prisma (NFR-7, FR-32).
- Shiki HTML is generated from stored code (not user-injected HTML); raw user
  HTML is never interpolated elsewhere (NFR-10).

---

## 9. Cross-References

This SDD is traceable to the SRS and phase docs. Key mappings:

| SDD section | SRS / Phase refs |
|-------------|------------------|
| §2 Architecture | [PLAN] §4; SRS §2.1, §2.4, §2.5; [P1] §1.3–1.6; [P2] §2.2–2.4 |
| §2.2 Auth flow | FR-1, FR-2, FR-3, FR-4; AR-1, AR-2, AR-3; [P1] §1.2–1.4 |
| §3 Component design | NFR-1; FR-13; [P2] §2.3, §2.4; [P3] §3.3, §3.4; [P4] §4.4 |
| §4.1 OAuth login | FR-1…FR-6; AR-1…AR-3; [P1] §1.2–1.4 |
| §4.2 Anonymous PUBLIC read | FR-9, FR-44, FR-46; NFR-24; AR-4; [P1] §1.5; [P2] §2.6 |
| §4.3 Snippet creation | FR-7, FR-8, FR-10, FR-31…FR-37; AR-5; [P3] §3.1–3.4 |
| §4.4 Search | FR-17, FR-18, FR-19; NFR-18, NFR-19; DM-7; [P2] §2.4 |
| §5 Module map | [PLAN] §8; SRS §3.1; [P0] §0.5; [P1] §1.6–1.8; [P2] §2.1; [P3] §3.1 |
| §6 Caching | FR-37; NFR-2, NFR-4; [P3] §3.7; [P4] §4.2 |
| §7 Errors | FR-11, FR-32, FR-33, FR-35, FR-43; NFR-12; AR-5; [P3] §3.4 |
| §8 Security | FR-27, FR-28, FR-29, FR-44, FR-45, FR-46; NFR-5, NFR-6, NFR-7, NFR-8, NFR-9, NFR-24; AR-4, AR-5, AR-6; [P1] §1.5, §1.6 |
| Data model (throughout) | SRS §3.4 (DM-1…DM-8); [P0] schema; enums `Role`/`Visibility`/`MembershipRole` |

### 9.1 Requirement Traceability (design → phase)

The SRS §4 Traceability Matrix already maps requirements to Phases 0–4; this
SDD's modules map onto those phases as:

- **Phase 0:** `prisma/`, `lib/prisma.ts`, `lib/utils.ts`, `middleware.ts`
  (stub), `.env.example`.
- **Phase 1:** `lib/auth.ts`, `types/next-auth.d.ts`, `app/api/auth/...`,
  `middleware.ts` (real), `lib/rbac.ts`, `app/sign-in/*`,
  `app/(app)/layout.tsx`, `components/user-menu.tsx`.
- **Phase 2:** `app/(app)/dashboard`, `app/(app)/snippets/*`,
  `app/(app)/collections/*`, `lib/highlight.ts`, `lib/search.ts`,
  `lib/collections.ts`, `lib/tags.ts`, `components/search-box.tsx`,
  `components/visibility-badge.tsx`, `loading.tsx`.
- **Phase 3:** `lib/validations.ts`, `actions/snippets.ts`,
  `actions/collections.ts`, `actions/memberships.ts`, `actions/tags.ts`,
  `components/snippet-form.tsx`, `components/snippet-list.tsx`,
  `components/collection-form.tsx`, `hooks/use-infinite-scroll.ts`.
- **Phase 4:** `app/layout.tsx` (metadata/lang/theme), `app/opengraph-image.tsx`,
  `app/robots.ts`, `app/sitemap.ts`, `components/theme-toggle.tsx`,
  `components/providers.tsx`, `lib/highlight.ts` (theme-aware), `vercel-build`
  script, CI workflow, `docs/RETRO.md`.

---

## 10. Assumptions & Open Items (carried from SRS)

- Auth.js v5 is beta → all config isolated in `lib/auth.ts` (R-1, NFR-14).
- Edge middleware cannot query DB → authoritative checks in RSC/actions (R-5,
  FR-27).
- Search scales to MVP volume via `ILIKE` + `pg_trgm`; later path to
  `tsvector`/Algolia without domain-model change (R-3, NFR-18).
- Neon soft-preferred over Supabase; only `DATABASE_URL`/`DATABASE_URL_DIRECT`
  differ (R-4, NFR-16).
- Connection hygiene: pooled `DATABASE_URL` at runtime; `DATABASE_URL_DIRECT`
  for migrate/seed; Prisma singleton (R-7, NFR-11).
- Prod migrations use `prisma migrate deploy` in `vercel-build`, never
  `migrate dev` (R-9, [P4] §4.6).

---

*This SDD is derived solely from `IMPLEMENTATION_PLAN.md`, `docs/SRS.md`, and
`docs/PHASE_0..4_*.md`. It introduces no design that contradicts those
documents and is intended as the architectural baseline for the DCodeBook MVP.*

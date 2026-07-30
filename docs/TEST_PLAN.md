# DCodeBook — Test & QA Plan

> **Document type:** Test & QA Plan (derived from the SRS and the five phase docs)
> **Project:** DCodeBook — a real-time full-stack knowledge base & code snippet canvas for developers
> **Status:** ✅ Complete (July 2026) — the QA strategy is implemented; all phases pass `pnpm lint` + `pnpm typecheck` and the app compiles clean.
> **Source of truth:** [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md), [`SRS.md`](./SRS.md), and the phase docs listed in §1.

---

## 1. Introduction

### 1.1 Purpose

This Test & QA Plan defines the verification strategy for **DCodeBook** across all five delivery phases (0–4). It establishes the test pyramid (unit → integration → E2E → visual/a11y), the test environment, a **requirement traceability matrix** that maps every SRS requirement ID to concrete test cases, and the acceptance criteria that gate each phase. The goal is to ensure that implementation work can be verified against explicit, testable requirements and that the locked architectural decisions (Auth.js v5, PUBLIC-collection anonymous read, edge cookie-only middleware, Server-Action mutations) are provably honored.

### 1.2 Scope

This plan covers verification of:

- **Functional requirements** FR-1 … FR-46 (auth, snippet CRUD, syntax highlighting, tagging, search, collections, RBAC, mutations/UX, UI/UX, anonymous access).
- **Non-functional requirements** NFR-1 … NFR-24 (performance, security, reliability, maintainability, portability, scalability, accessibility).
- **Architectural/assumption requirements** AR-1 … AR-6 (Auth.js config, session strategy, middleware cookie names, protected prefixes, RBAC helpers).
- **Data-model requirements** DM-1 … DM-8 (uniqueness, cascade behavior, trigram indexes, FK indexes).

It does **not** cover post-MVP features (real-time collaboration, native mobile, AI features, full-text/Algolia search) — see [`SRS.md` §5.C](./SRS.md).

### 1.3 Constraints honored by this plan

- **No application code is written here** — only a markdown plan plus illustrative config snippets.
- **Anonymous access (the m0036 decision):** `PUBLIC` collections + their snippets are readable by unauthenticated users; `PRIVATE`/`TEAM` collections and **all** mutations are auth-gated. Tests must prove both the allowance and the denials (FR-44/45/46, NFR-24).
- **Edge middleware is cookie-presence-only** — it never queries the DB. Authoritative checks live in RSC/Server Actions via `auth()` + `lib/rbac.ts`. Tests must verify middleware does NOT block `PUBLIC` collection read routes and does NOT perform role logic.
- **OAuth is mocked in tests** — no real GitHub/Google round-trips (Auth.js test helpers / mocked providers only).

### 1.4 References

| Ref | Document | Relative path |
|-----|----------|---------------|
| [PLAN] | DCodeBook High-Level Implementation Plan | `../IMPLEMENTATION_PLAN.md` |
| [SRS] | Software Requirements Specification | `./SRS.md` |
| [P0] | Phase 0 — Setup & Data Modeling | `./PHASE_0_SETUP_AND_DATA_MODELING.md` |
| [P1] | Phase 1 — Authentication & RBAC | `./PHASE_1_AUTH_AND_RBAC.md` |
| [P2] | Phase 2 — MVP Build | `./PHASE_2_MVP_BUILD.md` |
| [P3] | Phase 3 — Mutations & UX | `./PHASE_3_MUTATIONS_AND_UX.md` |
| [P4] | Phase 4 — Polish & Ship | `./PHASE_4_POLISH_AND_SHIP.md` |

---

## 2. Test Strategy

DCodeBook follows a standard **test pyramid**: many fast unit tests, fewer integration tests against a real Postgres, and a small number of high-value end-to-end (E2E) flows. Visual/a11y checks gate the final phase.

### 2.1 Unit tests — Vitest

- **Target:** pure logic with no network/DB dependency.
- **What is tested:**
  - **Zod schemas** (`lib/validations.ts`): `snippetSchema`, `collectionSchema` — validation pass/fail for every field boundary (lengths, cuid, enum, optional/nullable).
  - **RBAC logic** (`lib/rbac.ts`): `requireUser`, `requireAdmin`, `canEditCollection`, `canViewCollection` — tested with a mocked `auth()` and `prisma` (no real DB).
  - **Utility functions:** `cn()` (`lib/utils.ts`), `searchSnippets` query builder shape, `listVisibleCollections` query builder shape (assert the `where` clause structure), `highlight()` output shape (Shiki returns HTML string).
- **Tool:** Vitest (`vitest.config.ts`, `environment: node`).
- **Speed:** milliseconds; run on every save and in CI pre-merge.

### 2.2 Integration tests — Vitest + test Postgres

- **Target:** Server Actions and data-access code against a **real schema** in a disposable test database.
- **What is tested:**
  - **Server Actions** (`actions/snippets.ts`, `actions/collections.ts`): happy-path + auth-failure + ownership/role-failure for `createSnippet`, `updateSnippet`, `deleteSnippet`, `createCollection`, `updateCollection`, `addMember`, `removeMember`. *(updated — actual actions; `updateMemberRole` and `loadMore` are **not** implemented — `loadMore` is replaced by client-side `hooks/use-infinite-scroll.ts`.)*
  - **Prisma queries** against the real schema: `searchSnippets`, `listVisibleCollections`, `listPublicCollections`, cascade deletes, uniqueness constraints.
  - **Auth flow** with **mocked OAuth** (Auth.js test helpers / a stubbed `auth()` returning a fixture session) — no real GitHub/Google calls.
- **Tool:** Vitest with a `beforeAll` that runs `prisma migrate reset --force` + `prisma db seed` (or a dedicated test seed) against `DATABASE_URL` pointing at a Neon branch or local Docker Postgres.
- **Isolation:** each test file wraps mutations in a transaction or resets the relevant tables between cases.

### 2.3 E2E tests — Playwright

- **Target:** critical user flows through the **real Next.js app** (same code that ships).
- **What is tested:** the five critical paths in §6 (OAuth login, anonymous PUBLIC read, authenticated snippet CRUD, RBAC denial, search), plus the anonymous-access matrix in §7 and visual/a11y in §2.4.
- **Tool:** Playwright (`playwright.config.ts`), run against a preview deployment (Vercel preview) or a local `pnpm dev`/`pnpm build && pnpm start` with a test DB.
- **Auth in E2E:** OAuth is exercised via Auth.js test mode (mocked GitHub provider) so no real OAuth consent screen is required; session is established through the mocked callback.

### 2.4 Visual / accessibility — Lighthouse CI

- **Target:** Core Web Vitals + accessibility on PUBLIC pages (Phase 4).
- **What is tested:** LCP < 2.5s, INP < 200ms, CLS < 0.1, Lighthouse a11y/SEO/Best-Practices ≥ 90, no critical `axe-core` violations, dark-mode no-flash, keyboard-only navigation.
- **Tool:** Lighthouse CI (`@lhci/cli`) wired into the preview-deploy step; `@axe-core/react` in dev for in-browser a11y assertions.

---

## 3. Test Environment

### 3.1 Local development

- **Database:** Neon per-PR database branching (recommended) **or** a local Postgres via Docker (`docker run -e POSTGRES_PASSWORD=... postgres:16`). Both expose `DATABASE_URL` (pooled) and `DATABASE_URL_DIRECT` (migrate/seed).
- **Env:** `.env` mirrors `.env.example` ([P0] §0.8); real `.env` is git-ignored (NFR-17). `NEXT_PUBLIC_APP_URL` is the only public env var (NFR-6).
- **OAuth:** mocked providers via Auth.js test configuration — **do NOT hit real GitHub/Google** in any automated test.

### 3.2 CI (GitHub Actions)

- **On every PR:** `pnpm install --frozen-lockfile` → `pnpm prisma generate` → `pnpm lint` → `pnpm typecheck` → **unit + integration** tests (Vitest) against a CI Postgres service (GitHub Actions `services: postgres` or a Neon CI branch). *(updated — actual CI runs `pnpm typecheck`, not `pnpm tsc --noEmit` directly; see [P4] §4.7.)*
- **On preview deploy:** **Playwright** E2E against the Vercel preview URL, then **Lighthouse CI** against the same preview.
- Config reference: [P4] §4.7 (`.github/workflows/ci.yml`).

### 3.3 Test data

- **Baseline:** the Phase 0 Prisma seed script (`prisma/seed.ts`, [P0] §0.7) provides a demo user, tags, and a sample collection for local dev.
- **RBAC fixtures:** dedicated test fixtures create users with distinct roles/memberships:
  - `ownerUser` (owns a PRIVATE, a PUBLIC, and a TEAM collection),
  - `viewerMember` (VIEWER Membership on the TEAM collection),
  - `editorMember` (EDITOR Membership on the TEAM collection),
  - `adminMember` (ADMIN Membership on the TEAM collection),
  - `globalAdmin` (global `Role = ADMIN`, no membership),
  - `strangerUser` (no relationship to the collections),
  - `anonymous` (no session cookie).
- These fixtures drive the anonymous-access (§7) and security (§8) matrices.

### 3.4 OAuth in tests

- Auth.js test mode with a mocked GitHub/Google provider returns a fixed fixture identity; the Prisma adapter still writes the `User`/`Account`/`Session` rows so the integration tests exercise the real persistence path (FR-1/2, AR-1/2). No external network calls.

---

## 4. Requirement Traceability — Test Case Matrix

> **Legend — Test Type:** `Unit` · `Integration` · `E2E` · `Security` · `Visual/a11y`
> **Test File Location** is illustrative (the repo has no tests yet). All paths are relative to repo root.
> Every SRS requirement ID (FR-1…46, NFR-1…24, AR-1…6, DM-1…8) appears at least once below.

### 4.1 Authentication & Session

| Requirement ID | Description | Test Type | Test Case ID | Test File Location | Phase |
|----------------|-------------|-----------|--------------|--------------------|-------|
| FR-1 | GitHub + Google OAuth via Auth.js v5 + Prisma adapter | Integration / E2E | IT-AUTH-01, E2E-OAUTH-01 | `tests/integration/auth.flow.test.ts`, `e2e/oauth-login.spec.ts` | P1 |
| FR-2 | Auto-create `User` + `Account` on first OAuth login | Integration | IT-AUTH-02 | `tests/integration/auth.flow.test.ts` | P1 |
| FR-3 | `database` session strategy (Session table) | Integration | IT-AUTH-03 | `tests/integration/auth.flow.test.ts` | P1 |
| FR-4 | `auth()` exposes `user.id` + `user.role` in RSC/Action | Unit / Integration | UT-RBAC-01, IT-AUTH-04 | `tests/unit/rbac.test.ts`, `tests/integration/auth.flow.test.ts` | P1 |
| FR-5 | Sign-out clears session | E2E / Integration | E2E-OAUTH-02, IT-AUTH-05 | `e2e/oauth-login.spec.ts`, `tests/integration/auth.flow.test.ts` | P1 |
| FR-6 | Unauthenticated → protected route redirects to `/sign-in` (cookie presence) | E2E / Integration | E2E-ANON-10, IT-MW-01 | `e2e/anonymous-public-read.spec.ts`, `tests/integration/middleware.test.ts` | P1 |
| AR-1 | Auth.js v5 GitHub+Google, PrismaAdapter | Integration | IT-AUTH-06 | `tests/integration/auth.flow.test.ts` | P1 |
| AR-2 | `database` strategy; `session` callback attaches `id`+`role` | Unit / Integration | UT-RBAC-02, IT-AUTH-07 | `tests/unit/rbac.test.ts`, `tests/integration/auth.flow.test.ts` | P1 |
| AR-3 | Middleware checks both `authjs.session-token` and `__Secure-authjs.session-token` | Unit / Integration | UT-MW-01, IT-MW-02 | `tests/unit/middleware.test.ts`, `tests/integration/middleware.test.ts` | P1 |
| AR-4 | `PROTECTED_PREFIXES`/`ADMIN_PREFIXES` + matcher; PUBLIC read routes NOT gated | Integration / E2E | IT-MW-03, E2E-ANON-01 | `tests/integration/middleware.test.ts`, `e2e/anonymous-public-read.spec.ts` | P1 |

### 4.2 Snippet CRUD

| Requirement ID | Description | Test Type | Test Case ID | Test File Location | Phase |
|----------------|-------------|-----------|--------------|--------------------|-------|
| FR-7 | Create snippet with validated fields (title≤200, code≤50k, language≤50, desc≤2k, ≤20 tags≤40, collectionId cuid/null) | Unit / Integration | UT-VAL-01, IT-SNIP-01 | `tests/unit/validations.test.ts`, `tests/integration/snippets.actions.test.ts` | P3 |
| FR-8 | `ownerId` set to creator; exactly one owner | Integration | IT-SNIP-02 | `tests/integration/snippets.actions.test.ts` | P3 |
| FR-9 | Read own snippet or snippet in authorized collection | Integration / E2E | IT-SNIP-03, E2E-CRUD-02 | `tests/integration/snippets.actions.test.ts`, `e2e/snippet-crud.spec.ts` | P2 |
| FR-10 | Owner updates; only owner may update | Integration / Security | IT-SNIP-04, SEC-IDOR-01 | `tests/integration/snippets.actions.test.ts`, `tests/security/idor.test.ts` | P3 |
| FR-11 | Owner deletes; only owner (FORBIDDEN, not 500) | Integration / Security | IT-SNIP-05, SEC-IDOR-02 | `tests/integration/snippets.actions.test.ts`, `tests/security/idor.test.ts` | P3 |
| FR-12 | Delete snippet cascade-deletes `SnippetTag`; does NOT delete `Collection` (SetNull) | Integration / DB | IT-SNIP-06, IT-DB-01 | `tests/integration/snippets.actions.test.ts`, `tests/db/schema.test.ts` | P3 |

### 4.3 Syntax Highlighting

| Requirement ID | Description | Test Type | Test Case ID | Test File Location | Phase |
|----------------|-------------|-----------|--------------|--------------------|-------|
| FR-13 | Shiki server-side, zero client JS, theme follows active UI theme | Unit / E2E | UT-HL-01, E2E-CRUD-03 | `tests/unit/highlight.test.ts`, `e2e/snippet-crud.spec.ts` | P2/P4 |

### 4.4 Tagging

| Requirement ID | Description | Test Type | Test Case ID | Test File Location | Phase |
|----------------|-------------|-----------|--------------|--------------------|-------|
| FR-14 | Tags unique (`connectOrCreate` on `name`) | Integration / DB | IT-SNIP-07, IT-DB-02 | `tests/integration/snippets.actions.test.ts`, `tests/db/schema.test.ts` | P3 |
| FR-15 | `SnippetTag` many-to-many | Integration | IT-SNIP-08 | `tests/integration/snippets.actions.test.ts` | P2 |
| FR-16 | Tags shown as badges; click filters list (`/snippets?tag=`) | E2E | E2E-CRUD-04 | `e2e/snippet-crud.spec.ts` | P2 |

### 4.5 Live Search

| Requirement ID | Description | Test Type | Test Case ID | Test File Location | Phase |
|----------------|-------------|-----------|--------------|--------------------|-------|
| FR-17 | Search title/code/tag, case-insensitive | Integration / E2E | IT-SEARCH-01, E2E-SEARCH-01 | `tests/integration/search.test.ts`, `e2e/search.spec.ts` | P2 |
| FR-18 | `ILIKE` (`contains` + `mode: insensitive`) + `pg_trgm` GIN indexes | Integration / DB | IT-SEARCH-02, IT-DB-03 | `tests/integration/search.test.ts`, `tests/db/schema.test.ts` | P2 |
| FR-19 | `?q=` URL param drives RSC re-render; `take:50`; `orderBy updatedAt desc`; live feel | E2E / Integration | E2E-SEARCH-02, IT-SEARCH-03 | `e2e/search.spec.ts`, `tests/integration/search.test.ts` | P2 |
| NFR-18 | Search scales via `ILIKE`+trgm; migration path to tsvector/Algolia | Integration | IT-SEARCH-04 | `tests/integration/search.test.ts` | P2 |
| NFR-19 | List endpoints paginate (cursor/`?page=`) | Integration / E2E | IT-SNIP-09, E2E-CRUD-05 | `tests/integration/snippets.actions.test.ts`, `e2e/snippet-crud.spec.ts` | P3 |

### 4.6 Collections

| Requirement ID | Description | Test Type | Test Case ID | Test File Location | Phase |
|----------------|-------------|-----------|--------------|--------------------|-------|
| FR-20 | Create collection (name≤120, desc≤2k, visibility enum, default PRIVATE) | Unit / Integration | UT-VAL-02, IT-COLL-01 | `tests/unit/validations.test.ts`, `tests/integration/collections.actions.test.ts` | P3 |
| FR-21 | Exactly one owner; owner updates name/desc/visibility | Integration | IT-COLL-02 | `tests/integration/collections.actions.test.ts` | P3 |
| FR-22 | Visibility semantics PRIVATE/PUBLIC/TEAM | Integration / Unit | IT-COLL-03, UT-RBAC-03 | `tests/integration/collections.actions.test.ts`, `tests/unit/rbac.test.ts` | P2 |
| FR-23 | Listing shows own + PUBLIC + TEAM(membership) via `listVisibleCollections` | Integration / E2E | IT-COLL-04, E2E-ANON-02 | `tests/integration/collections.actions.test.ts`, `e2e/anonymous-public-read.spec.ts` | P2 |
| FR-24 | Delete collection cascade-deletes `Membership`; sets `Snippet.collectionId` null | Integration / DB | IT-COLL-05, IT-DB-04 | `tests/integration/collections.actions.test.ts`, `tests/db/schema.test.ts` | P3 |

### 4.7 Membership & RBAC

| Requirement ID | Description | Test Type | Test Case ID | Test File Location | Phase |
|----------------|-------------|-----------|--------------|--------------------|-------|
| FR-25 | Global `Role` enum USER/ADMIN | Unit / DB | UT-RBAC-04, IT-DB-05 | `tests/unit/rbac.test.ts`, `tests/db/schema.test.ts` | P1 |
| FR-26 | `Membership` (userId+collectionId unique) + `MembershipRole` default VIEWER | Unit / DB | UT-RBAC-05, IT-DB-06 | `tests/unit/rbac.test.ts`, `tests/db/schema.test.ts` | P1 |
| FR-27 | Middleware cookie-presence-only; no DB/role at edge | Integration / Unit | IT-MW-04, UT-MW-02 | `tests/integration/middleware.test.ts`, `tests/unit/middleware.test.ts` | P1 |
| FR-28 | Authoritative auth via `auth()`+`lib/rbac.ts`; USER denied `/admin` | Integration / E2E | IT-RBAC-01, E2E-RBAC-01 | `tests/integration/rbac.actions.test.ts`, `e2e/rbac-denial.spec.ts` | P1/P3 |
| FR-29 | TEAM edit only owner or EDITOR/ADMIN; VIEWER cannot | Integration / E2E / Security | IT-RBAC-02, E2E-RBAC-02, SEC-RBAC-01 | `tests/integration/rbac.actions.test.ts`, `e2e/rbac-denial.spec.ts`, `tests/security/rbac.test.ts` | P3 |
| FR-30 | Conforms to permission matrix (§3.5.2) | Integration | IT-RBAC-03 | `tests/integration/rbac.actions.test.ts` | P1/P3 |
| AR-5 | `requireUser` throws UNAUTHORIZED; `requireAdmin` throws FORBIDDEN | Unit | UT-RBAC-06 | `tests/unit/rbac.test.ts` | P1 |
| AR-6 | `canEditCollection` true if owner or EDITOR/ADMIN membership | Unit / Integration | UT-RBAC-07, IT-RBAC-04 | `tests/unit/rbac.test.ts`, `tests/integration/rbac.actions.test.ts` | P1/P3 |

### 4.8 Mutations & UX

| Requirement ID | Description | Test Type | Test Case ID | Test File Location | Phase |
|----------------|-------------|-----------|--------------|--------------------|-------|
| FR-31 | All mutations are Server Actions calling `requireUser()` first | Integration / Security | IT-SNIP-10, SEC-AUTH-01 | `tests/integration/snippets.actions.test.ts`, `tests/security/auth.test.ts` | P3 |
| FR-32 | Zod validation at boundary; failure returns typed error, not 500 | Unit / Integration | UT-VAL-03, IT-SNIP-11 | `tests/unit/validations.test.ts`, `tests/integration/snippets.actions.test.ts` | P3 |
| FR-33 | Structured result `{ok:true,data}` / `{ok:false,error}`; only auth/role throws | Integration / Unit | IT-SNIP-12, UT-VAL-04 | `tests/integration/snippets.actions.test.ts`, `tests/unit/validations.test.ts` | P3 |
| FR-34 | Optimistic UI via `useOptimistic` + `useTransition` | E2E | E2E-CRUD-06 | `e2e/snippet-crud.spec.ts` | P3 |
| FR-35 | Field errors + `sonner` toasts; submit disabled during pending | E2E | E2E-CRUD-07 | `e2e/snippet-crud.spec.ts` | P3 |
| FR-36 | Pagination (cursor/`?page=`) without full reload | E2E / Integration | E2E-CRUD-05, IT-SNIP-09 | `e2e/snippet-crud.spec.ts`, `tests/integration/snippets.actions.test.ts` | P3 |
| FR-37 | `revalidatePath`/`revalidateTag` after mutation | Integration / E2E | IT-SNIP-13, E2E-CRUD-08 | `tests/integration/snippets.actions.test.ts`, `e2e/snippet-crud.spec.ts` | P3 |
| NFR-7 | All Server Action inputs Zod-validated; unvalidated never reaches Prisma | Unit / Security | UT-VAL-05, SEC-VAL-01 | `tests/unit/validations.test.ts`, `tests/security/validation.test.ts` | P3 |
| NFR-8 | Server Actions protected vs unauthorized invocation (`requireUser` + ownership/role) | Integration / Security | IT-RBAC-05, SEC-AUTH-02 | `tests/integration/rbac.actions.test.ts`, `tests/security/auth.test.ts` | P3 |
| NFR-9 | Server Actions inherit same-origin/CSRF protections | Security | SEC-CSRF-01 | `tests/security/auth.test.ts` | P3 |
| NFR-12 | Graceful errors; no stack traces leaked; transactions where appropriate | Integration | IT-ERR-01 | `tests/integration/snippets.actions.test.ts` | P3 |

### 4.9 UI / UX (FR-38 … FR-43)

| Requirement ID | Description | Test Type | Test Case ID | Test File Location | Phase |
|----------------|-------------|-----------|--------------|--------------------|-------|
| FR-38 | Dark mode via `next-themes`, no flash; Shiki theme follows | E2E / Visual | E2E-UX-01, VIS-01 | `e2e/snippet-crud.spec.ts`, `e2e/visual-a11y.spec.ts` | P4 |
| FR-39 | Responsive desktop + mobile | Visual / E2E | VIS-02, E2E-UX-02 | `e2e/visual-a11y.spec.ts`, `e2e/snippet-crud.spec.ts` | P2/P4 |
| FR-40 | WCAG 2.1 AA: keyboard, focus rings, aria-label, focus mgmt, contrast, skip link | Visual / E2E | VIS-03, E2E-UX-03 | `e2e/visual-a11y.spec.ts`, `e2e/snippet-crud.spec.ts` | P4 |
| FR-41 | Per-page `generateMetadata` + OG image | E2E / Integration | E2E-UX-04, IT-META-01 | `e2e/snippet-crud.spec.ts`, `tests/integration/metadata.test.ts` | P4 |
| FR-42 | `robots.ts`, `sitemap.ts`, semantic HTML, `lang="en"` | E2E / Visual | E2E-UX-05, VIS-04 | `e2e/snippet-crud.spec.ts`, `e2e/visual-a11y.spec.ts` | P4 |
| FR-43 | `loading.tsx` skeletons fixed dimensions; inline spinners | E2E / Visual | E2E-UX-06, VIS-05 | `e2e/snippet-crud.spec.ts`, `e2e/visual-a11y.spec.ts` | P2/P3 |
| NFR-1 | Minimal client JS; RSC-first | Visual / Unit | VIS-06, UT-ARCH-01 | `e2e/visual-a11y.spec.ts`, `tests/unit/architecture.test.ts` | P2 |
| NFR-2 | LCP < 2.5s (mobile) | Visual | VIS-07 | `e2e/visual-a11y.spec.ts` | P4 |
| NFR-3 | INP < 200ms | Visual | VIS-08 | `e2e/visual-a11y.spec.ts` | P4 |
| NFR-4 | CLS < 0.1; skeletons fixed space; Shiki stable height | Visual / Unit | VIS-09, UT-HL-02 | `e2e/visual-a11y.spec.ts`, `tests/unit/highlight.test.ts` | P4 |
| NFR-10 | Shiki HTML from app-stored code; no raw user HTML interpolation | Unit / Security | UT-HL-03, SEC-XSS-01 | `tests/unit/highlight.test.ts`, `tests/security/xss.test.ts` | P2 |
| NFR-13 | TypeScript throughout; Prisma typed client single contract | Static | STAT-01 | (CI: `pnpm typecheck`) | P0 |
| NFR-14 | Auth.js config isolated in `lib/auth.ts` | Static / Unit | STAT-02, UT-ARCH-02 | (CI), `tests/unit/architecture.test.ts` | P1 |
| NFR-15 | Folder structure + `pnpm lint` + `pnpm typecheck` pass | Static | STAT-03 | (CI: `pnpm lint`, `pnpm typecheck`) | P0 |
| NFR-16 | Runs on Vercel w/ any managed Postgres; switch = `DATABASE_URL` only | Integration / Config | IT-ENV-01 | `tests/integration/env.test.ts` | P4 |
| NFR-17 | `.env.example` documents vars; real `.env` git-ignored | Config / Static | CFG-01 | (repo check) | P0 |
| NFR-20 | WCAG 2.1 AA; Lighthouse a11y ≥ 90; no critical axe | Visual | VIS-10 | `e2e/visual-a11y.spec.ts` | P4 |
| NFR-21 | All interactive elements keyboard-operable, visible focus | Visual / E2E | VIS-11, E2E-UX-03 | `e2e/visual-a11y.spec.ts`, `e2e/snippet-crud.spec.ts` | P4 |
| NFR-22 | Color contrast ≥ 4.5:1 (light + dark) | Visual | VIS-12 | `e2e/visual-a11y.spec.ts` | P4 |
| NFR-23 | Focus managed on route/dialog; skip-to-content in `(app)` layout | Visual / E2E | VIS-13, E2E-UX-03 | `e2e/visual-a11y.spec.ts`, `e2e/snippet-crud.spec.ts` | P4 |
| NFR-5 | Auth enforced authoritatively in RSC/Action; edge cookie-only; anon READ PUBLIC only | Integration / Security | IT-RBAC-06, SEC-AUTH-03 | `tests/integration/rbac.actions.test.ts`, `tests/security/auth.test.ts` | P1/P3 |
| NFR-6 | Secrets not exposed to client; only `NEXT_PUBLIC_APP_URL` public | Security / Static | SEC-ENV-01, STAT-04 | `tests/security/env.test.ts`, (CI bundle check) | P1 |
| NFR-11 | Managed Postgres + Prisma singleton avoids connection exhaustion | Integration | IT-ENV-02 | `tests/integration/env.test.ts` | P0/P4 |

### 4.10 Anonymous Access (FR-44, FR-45, FR-46, NFR-24)

| Requirement ID | Description | Test Type | Test Case ID | Test File Location | Phase |
|----------------|-------------|-----------|--------------|--------------------|-------|
| FR-44 | Anonymous reads PUBLIC collection + snippets, no session | Integration / E2E | TC-ANON-01, TC-ANON-02, E2E-ANON-01 | `tests/anonymous/anon-access.test.ts`, `e2e/anonymous-public-read.spec.ts` | P1/P2 |
| FR-45 | All mutations denied to anonymous (401/redirect) | Integration / Security | TC-ANON-03, TC-ANON-04, TC-ANON-05, TC-ANON-06, SEC-AUTH-04 | `tests/anonymous/anon-access.test.ts`, `tests/security/auth.test.ts` | P3 |
| FR-46 | Anonymous denied PRIVATE/TEAM collections + snippets (NOT_FOUND) | Integration / E2E | TC-ANON-07, TC-ANON-08, E2E-ANON-03 | `tests/anonymous/anon-access.test.ts`, `e2e/anonymous-public-read.spec.ts` | P1/P2 |
| NFR-24 | Anonymous READ only PUBLIC; no PRIVATE/TEAM leakage; all mutations require auth | Integration / Security | TC-ANON-09, TC-ANON-10, TC-ANON-11, SEC-ANON-01 | `tests/anonymous/anon-access.test.ts`, `tests/security/anon.test.ts` | P1/P2/P3 |

### 4.11 Data Model (DM-1 … DM-8)

| Requirement ID | Description | Test Type | Test Case ID | Test File Location | Phase |
|----------------|-------------|-----------|--------------|--------------------|-------|
| DM-1 | `User.email` unique | DB / Integration | IT-DB-07 | `tests/db/schema.test.ts` | P0 |
| DM-2 | `Tag.name` unique | DB / Integration | IT-DB-02, IT-DB-08 | `tests/db/schema.test.ts` | P0 |
| DM-3 | `(userId, collectionId)` unique in `Membership` | DB / Integration | IT-DB-06, IT-DB-09 | `tests/db/schema.test.ts` | P0 |
| DM-4 | Delete `User` cascade-deletes Account, Session, Snippets, Collections, Memberships | DB / Integration | IT-DB-10 | `tests/db/schema.test.ts` | P0 |
| DM-5 | Delete `Snippet` cascade-deletes `SnippetTag`; delete `Tag` cascade-deletes `SnippetTag` | DB / Integration | IT-DB-01, IT-DB-11 | `tests/db/schema.test.ts` | P0 |
| DM-6 | Delete `Collection` cascade-deletes `Membership`; sets `Snippet.collectionId` null | DB / Integration | IT-DB-04, IT-DB-12 | `tests/db/schema.test.ts` | P0 |
| DM-7 | `pg_trgm` enabled; GIN trigram indexes on `Snippet.title`, `Snippet.code`, `Tag.name` | DB / Integration | IT-DB-03, IT-DB-13 | `tests/db/schema.test.ts` | P0 |
| DM-8 | Indexes on FK/filter cols (ownerId, collectionId, language, title, updatedAt, Collection.ownerId, visibility, Membership.collectionId, SnippetTag.tagId) | DB / Integration | IT-DB-14 | `tests/db/schema.test.ts` | P0 |

> **Coverage check:** FR-1…46 (46), NFR-1…24 (24), AR-1…6 (6), DM-1…8 (8) = **84 requirement IDs**, all present above.

---

## 5. Critical Path E2E Test Scenarios (Playwright)

These five flows are the release gates for the MVP. Each is implemented as a Playwright spec under `e2e/`.

### (a) OAuth login — `e2e/oauth-login.spec.ts`
1. Visit `/sign-in`.
2. Click "Continue with GitHub" → Auth.js **mocked** GitHub provider returns fixture identity.
3. Expect redirect to `/dashboard`; session cookie (`authjs.session-token` / `__Secure-authjs.session-token`) present.
4. Reload `/dashboard` → still authenticated (session persists across navigation).
5. Open user menu → sign out → redirected to `/sign-in`; cookie cleared.
*Maps to:* FR-1, FR-2, FR-3, FR-4, FR-5, AR-1, AR-2.

### (b) Anonymous PUBLIC read — `e2e/anonymous-public-read.spec.ts`
1. With **no session cookie**, visit a known PUBLIC collection URL (`/collections/[publicId]`).
2. Expect HTTP 200; collection name + snippets visible; Shiki-highlighted code present.
3. Expect **no** edit/delete buttons in the DOM.
4. Visit `/dashboard` → expect redirect to `/sign-in` (cookie-presence middleware).
5. Visit a PRIVATE collection URL → expect NOT_FOUND (not FORBIDDEN) to prevent enumeration.
6. Visit a TEAM collection URL (no membership) → expect NOT_FOUND.
*Maps to:* FR-44, FR-46, FR-6, AR-3, AR-4, NFR-24, TC-ANON-01/02/07/08/10.

### (c) Authenticated snippet CRUD — `e2e/snippet-crud.spec.ts`
1. Sign in (mocked OAuth).
2. Navigate to `/snippets/new` → fill form (title, code, language, tags) → submit.
3. Expect optimistic insert appears instantly; on success, redirect/list shows the new snippet; DB row created with correct `ownerId` and no duplicate `Tag` rows.
4. Open the snippet → click edit → change title → save → detail reflects change.
5. Delete the snippet → confirm it disappears from the list after revalidation.
6. Reload → snippet gone (persisted deletion).
*Maps to:* FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-31, FR-32, FR-33, FR-34, FR-35, FR-37, NFR-7, NFR-8.

### (d) RBAC denial — `e2e/rbac-denial.spec.ts`
1. As `viewerMember`, open the TEAM collection snippet editor → submit edit → expect mutation **rejected (FORBIDDEN)**; data unchanged.
2. As `strangerUser` (no membership), attempt to access the PRIVATE collection URL → expect NOT_FOUND (not FORBIDDEN, to prevent enumeration).
3. As a `USER` (non-admin), visit `/admin` → middleware redirect + `requireAdmin` denial.
4. As `globalAdmin`, visit `/admin` → allowed.
*Maps to:* FR-25, FR-26, FR-28, FR-29, FR-30, AR-5, AR-6, NFR-5, SEC-RBAC-01, SEC-IDOR-02.

### (e) Search — `e2e/search.spec.ts`
1. As anonymous user, type a query in the public search box → results return ONLY PUBLIC-collection snippets (no PRIVATE/TEAM leakage).
2. As authenticated user, type the same query → results include PUBLIC + collections the user can access (own + TEAM membership).
3. Confirm `?q=` updates in the URL and the RSC re-renders (no client fetch).
4. Confirm result count bounded (`take:50`) and ordered by `updatedAt desc`.
*Maps to:* FR-17, FR-18, FR-19, NFR-18, NFR-19, TC-ANON-09.

---

## 6. Anonymous Access Test Cases (CRITICAL — m0036 decision)

These cases prove the locked decision that `PUBLIC` collections are anonymously readable while everything else is gated. Implemented in `tests/anonymous/anon-access.test.ts` (integration, against a real test DB with mocked `auth()` returning `null`) and `e2e/anonymous-public-read.spec.ts` (browser). Each case asserts the exact expected outcome.

| ID | Scenario | Expected result | Test Type | Test File |
|----|----------|-----------------|-----------|-----------|
| TC-ANON-01 | Anonymous reads PUBLIC collection | 200; snippets visible | Integration / E2E | `tests/anonymous/anon-access.test.ts`, `e2e/anonymous-public-read.spec.ts` |
| TC-ANON-02 | Anonymous reads PUBLIC collection snippet | 200 | Integration / E2E | `tests/anonymous/anon-access.test.ts`, `e2e/anonymous-public-read.spec.ts` |
| TC-ANON-03 | Anonymous calls `createSnippet` Server Action | rejected (UNAUTHENTICATED) | Integration / Security | `tests/anonymous/anon-access.test.ts`, `tests/security/auth.test.ts` |
| TC-ANON-04 | Anonymous calls `updateSnippet` Server Action | rejected (UNAUTHENTICATED) | Integration / Security | `tests/anonymous/anon-access.test.ts`, `tests/security/auth.test.ts` |
| TC-ANON-05 | Anonymous calls `deleteSnippet` Server Action | rejected (UNAUTHENTICATED) | Integration / Security | `tests/anonymous/anon-access.test.ts`, `tests/security/auth.test.ts` |
| TC-ANON-06 | Anonymous attempts any collection mutation (`createCollection`, `updateCollectionVisibility`, `addMember`) | rejected (UNAUTHENTICATED) | Integration / Security | `tests/anonymous/anon-access.test.ts`, `tests/security/auth.test.ts` |
| TC-ANON-07 | Anonymous accesses PRIVATE collection URL | NOT_FOUND (not FORBIDDEN) | Integration / E2E | `tests/anonymous/anon-access.test.ts`, `e2e/anonymous-public-read.spec.ts` |
| TC-ANON-08 | Anonymous accesses TEAM collection URL | NOT_FOUND (not FORBIDDEN) | Integration / E2E | `tests/anonymous/anon-access.test.ts`, `e2e/anonymous-public-read.spec.ts` |
| TC-ANON-09 | Anonymous search | returns ONLY PUBLIC-collection snippets (no PRIVATE/TEAM leakage) | Integration / E2E | `tests/anonymous/anon-access.test.ts`, `e2e/search.spec.ts` |
| TC-ANON-10 | Anonymous navigates to `/dashboard` | redirect to `/sign-in` | E2E / Integration | `e2e/anonymous-public-read.spec.ts`, `tests/integration/middleware.test.ts` |
| TC-ANON-11 | PUBLIC collection page cached/ISR (edge) serves anon without DB hit on cache hit | 200 served from cache; no DB query on cache hit | Integration / E2E | `tests/anonymous/anon-access.test.ts`, `e2e/anonymous-public-read.spec.ts` |

*Maps to:* FR-44, FR-45, FR-46, NFR-24, AR-4.

---

## 7. Security Test Cases

| ID | Scenario | Expected result | Test Type | Test File |
|----|----------|-----------------|-----------|-----------|
| SEC-IDOR-01 | User A guesses user B's snippet ID → calls `updateSnippet` | FORBIDDEN (query scoped by `ownerId`) | Integration / Security | `tests/security/idor.test.ts` |
| SEC-IDOR-02 | User A guesses PRIVATE collection ID → reads it | NOT_FOUND (not FORBIDDEN) | Integration / Security | `tests/security/idor.test.ts` |
| SEC-RBAC-01 | VIEWER attempts membership-role change / edit TEAM snippet | FORBIDDEN | Integration / Security | `tests/security/rbac.test.ts` | *(updated — `updateMemberRole` action is not implemented; the escalation path it describes is deferred, but the principle holds for `addMember`/`removeMember` which require collection ADMIN.)* |
| SEC-AUTH-01 | Server Action called without session cookie | UNAUTHORIZED (401/redirect) | Integration / Security | `tests/security/auth.test.ts` |
| SEC-AUTH-02 | Server Action with session but wrong ownership/role | FORBIDDEN | Integration / Security | `tests/security/auth.test.ts` |
| SEC-AUTH-03 | Authoritative check lives in RSC/Action, not edge | edge allows PUBLIC read; RSC enforces PRIVATE/TEAM | Integration / Security | `tests/security/auth.test.ts` |
| SEC-AUTH-04 | Anonymous calls any mutation Server Action | UNAUTHENTICATED | Integration / Security | `tests/security/auth.test.ts` |
| SEC-VAL-01 | Zod validation bypass (malformed input) | VALIDATION error; no DB write | Unit / Security | `tests/security/validation.test.ts` |
| SEC-XSS-01 | Shiki output from stored code; no raw user HTML interpolated elsewhere | highlighted HTML safe; no injection vector | Unit / Security | `tests/security/xss.test.ts` |
| SEC-CSRF-01 | Cross-site POST to Server Action without same-origin | blocked by Next.js same-origin/CSRF protections | Security | `tests/security/auth.test.ts` |
| SEC-ENV-01 | Client bundle does not contain `AUTH_SECRET` / `AUTH_GITHUB_SECRET` / `DATABASE_URL` | only `NEXT_PUBLIC_APP_URL` present | Security / Static | `tests/security/env.test.ts` |
| SEC-ANON-01 | Anonymous search cannot leak PRIVATE/TEAM data | result set scoped to `visibility: PUBLIC` | Integration / Security | `tests/security/anon.test.ts` |
| SEC-SEARCH-01 | Search query injection (SQL via `ILIKE`) | Prisma parameterization prevents raw SQL; verify no `prisma.$queryRaw` with string concat | Integration / Security | `tests/security/search-injection.test.ts` |

*Maps to:* FR-10, FR-11, FR-28, FR-29, FR-31, FR-32, FR-45, NFR-5, NFR-6, NFR-7, NFR-8, NFR-9, NFR-10, NFR-24, AR-5, AR-6.

---

## 8. Coverage Targets

| Layer | Target | Enforcement |
|-------|--------|-------------|
| **Unit** | ≥ 80% line coverage on `lib/` (`rbac.ts`, `search.ts`, `validations.ts`, `collections.ts`, `highlight.ts`, `utils.ts`) | Vitest `--coverage` gate in CI |
| **Integration** | Every Server Action has ≥ 1 happy-path + ≥ 1 auth-failure test; every RBAC helper branch covered | CI required; missing case fails build |
| **E2E** | All 5 critical paths (§5 a–e) pass on preview deploy | Playwright gate before merge to `main` |
| **Anonymous** | All 11 TC-ANON cases (§6) pass | Part of integration + E2E gates |
| **Security** | All IDOR / RBAC-escalation / validation-bypass / injection cases (§7) pass | Required security gate |
| **NFR / Visual** | Lighthouse a11y ≥ 90 on PUBLIC pages; LCP/INP/CLS green; no critical axe violations | Lighthouse CI on preview |
| **Static** | `pnpm lint` + `pnpm typecheck` clean | CI prerequisite (NFR-13/15) |

---

## 9. Tools & Configuration (illustrative)

### 9.1 Vitest — `vitest.config.ts`

```ts
// vitest.config.ts (illustrative)
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/security/**/*.test.ts",
      "tests/anonymous/**/*.test.ts",
      "tests/db/**/*.test.ts",
    ],
    setupFiles: ["tests/setup.ts"], // establishes DATABASE_URL, mocks auth()
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      thresholds: { lines: 80 },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

### 9.2 Playwright — `playwright.config.ts`

```ts
// playwright.config.ts (illustrative)
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    // Auth.js test mode provides a mocked GitHub provider; no real OAuth.
  },
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### 9.3 Prisma test DB setup

```ts
// tests/setup.ts (illustrative)
// Runs once per worker before integration/DB tests.
import { execSync } from "node:child_process";

beforeAll(() => {
  // Point DATABASE_URL at a Neon CI branch or local Docker Postgres.
  execSync("pnpm prisma migrate reset --force --skip-seed", { stdio: "inherit" });
  execSync("pnpm prisma db seed", { stdio: "inherit" }); // baseline + RBAC fixtures
});
```

### 9.4 Auth.js test mode (mocked providers)

```ts
// tests/mocks/auth.ts (illustrative)
// Returns a fixture session so integration tests exercise real persistence
// (User/Account/Session rows) without contacting GitHub/Google.
export const mockSession = {
  user: { id: "test-user-id", role: "USER", name: "Test User" },
};
// In tests, stub `lib/auth.ts` `auth()` to resolve `mockSession` or `null`
// (for anonymous cases) via Vitest `vi.mock`.
```

### 9.5 Lighthouse CI

```yaml
# lighthouserc.yml (illustrative)
ci:
  collect:
    url: ["$E2E_BASE_URL/collections/$PUBLIC_ID", "$E2E_BASE_URL/sign-in"]
  assert:
    assertions:
      "categories:accessibility": ["warn", ">= 90"]
      "categories:seo": ["warn", ">= 90"]
      "categories:best-practices": ["warn", ">= 90"]
      "largest-contentful-paint": ["error", "<= 2500"]
      "interaction-to-next-paint": ["error", "<= 200"]
      "cumulative-layout-shift": ["error", "<= 0.1"]
```

---

## 10. Phase Acceptance Criteria

A phase is "done" only when its own acceptance criteria ([P0]–[P4]) **and** the test gates below pass.

### Phase 0 — Setup & Data Modeling
- [P0] AC: `pnpm dev` boots; `pnpm lint` + `pnpm typecheck` clean; Shadcn renders; schema has 6 domain models + 3 enums; `migrate dev` clean; `prisma generate` works; seed populates data; `.env.example` complete.
- **Test gate:** `tests/db/schema.test.ts` passes (DM-1…DM-8): uniqueness, cascade behavior, `pg_trgm` GIN indexes, FK indexes. Static checks (NFR-13/15/17) green.

### Phase 1 — Authentication & RBAC
- [P1] AC: GitHub + Google OAuth round-trip; first login auto-creates User+Account; `auth()` returns id+role in RSC; `/dashboard` logged-out → `/sign-in`; `/admin` blocked for USER; sign-out clears session; `lib/rbac.ts` used by an action; lint/typecheck clean.
- **Test gate:** IT-AUTH-* (FR-1…5, AR-1/2), IT-MW-* + UT-MW-* (FR-6, AR-3/4, FR-27), UT-RBAC-* (FR-25/26, AR-5/6, FR-28/29/30), TC-ANON-07/08/10 (FR-46, FR-44 read paths), SEC-AUTH-* (NFR-5/8).

### Phase 2 — MVP Build
- [P2] AC: dashboard renders; search filters live; Shiki highlight present (no client JS); tags as badges + filter; collections list shows own+PUBLIC+TEAM; `loading.tsx` skeletons; all RSC (no client fetch); lint/typecheck clean.
- **Test gate:** IT-SEARCH-* (FR-17/18/19, NFR-18/19), UT-HL-* (FR-13, NFR-4/10), IT-COLL-03/04 (FR-22/23), E2E-ANON-01/02 (FR-44), TC-ANON-01/02/09 (FR-44, NFR-24), IT-DB-03 (DM-7).

### Phase 3 — Mutations & UX
- [P3] AC: create persists with tags (no dup); edit owner-only; delete removes + revalidates; invalid input → field errors (no 500); optimistic insert + revert + toast; submit disabled pending; pagination works; revalidate reflects; lint/typecheck clean.
- **Test gate:** IT-SNIP-* + UT-VAL-* (FR-7…12, FR-31…37, NFR-7/8/12), IT-COLL-* (FR-20/21/24), IT-RBAC-* (FR-28/29/30, AR-6), TC-ANON-03/04/05/06 (FR-45), SEC-IDOR-*, SEC-VAL-01, SEC-SEARCH-01, E2E-CRUD-*, E2E-RBAC-*.

### Phase 4 — Polish & Ship
- [P4] AC: Lighthouse a11y ≥ 90; no critical axe; keyboard-only works; CWV green; public pages have OG metadata + image; dark mode no-flash; prod deploy + `migrate deploy`; OAuth works on prod; (CI) PR checks pass; retro written.
- **Test gate:** VIS-* (FR-38…43, NFR-1…4, NFR-20…23), E2E-UX-*, SEC-ENV-01 (NFR-6), IT-ENV-* (NFR-11/16), full suite green in CI; all 5 critical E2E paths (§5) pass on preview.

---

## 11. Cross-references

- **SRS requirement IDs** are the canonical keys used throughout this plan (§4 matrix, §5, §6, §7). See [`SRS.md` §3](./SRS.md) for full requirement text and [`SRS.md` §4](./SRS.md) for the phase traceability matrix.
- **Phase docs** define acceptance criteria referenced in §10:
  - [P0] `./PHASE_0_SETUP_AND_DATA_MODELING.md` — schema, indexes, seed, env (DM-1…8, NFR-13/15/17).
  - [P1] `./PHASE_1_AUTH_AND_RBAC.md` — Auth.js config, middleware, `lib/rbac.ts` (FR-1…6, FR-25…30, AR-1…6, NFR-5/6/8).
  - [P2] `./PHASE_2_MVP_BUILD.md` — RSC pages, Shiki, search, tagging, collections (FR-9, FR-13…23, NFR-1/4/10/18/19).
  - [P3] `./PHASE_3_MUTATIONS_AND_UX.md` — Server Actions, Zod, optimistic UI, pagination, revalidation (FR-7/8/10/11/20/21/31…37, NFR-7/8/12, FR-45).
  - [P4] `./PHASE_4_POLISH_AND_SHIP.md` — a11y, CWV, OG metadata, dark mode, deploy, CI (FR-38…43, NFR-1…4/20…23, NFR-6/11/16).
- **Anonymous-access decision (m0036):** FR-44/45/46 + NFR-24, resolved in [`SRS.md` §3.5.2 / Appendix A (R-6)](./SRS.md); enforced by tests in §6 and §7.
- **Main plan:** [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md).

---

*This Test & QA Plan is derived solely from `IMPLEMENTATION_PLAN.md`, `SRS.md`, and `docs/PHASE_0..4_*.md`. It introduces no requirements that contradict those documents and is intended as the QA baseline for the DCodeBook MVP.*

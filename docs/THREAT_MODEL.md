# DCodeBook — STRIDE Threat Model (MVP)

> **Document type:** Lightweight STRIDE threat model
> **Project:** DCodeBook — a real-time full-stack knowledge base & code snippet canvas for developers
> **Status:** ✅ Complete (July 2026) — implemented; the anonymous-read surface and authenticated mutation surface are both built and compile clean.
> **Classification:** Internal / design-time — *lightweight* model appropriate for a solo portfolio project, **not** an enterprise-grade threat assessment.

---

## 1. Introduction

### 1.1 Purpose

DCodeBook has just opened a **public read surface**: anonymous (unauthenticated) users may now read `PUBLIC` collections and the snippets within them, while **every mutation remains auth-gated with RBAC**. This document captures the security threats introduced by that new trust boundary using the **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).

The goal is to make the security assumptions explicit *before* implementation, so that the anonymous-read surface and the authenticated mutation surface are both built defensively. It is a design-time artifact, not a penetration-test report.

### 1.2 Scope

**In scope (MVP threat surface):**
- The anonymous `PUBLIC`-read path (RSC pages only — no Server Action).
- The authenticated mutation surface (Server Actions under `actions/`).
- The edge middleware (`middleware.ts`) cookie-presence check.
- The authoritative authorization layer (`auth()` + `lib/rbac.ts`).
- The data model and Prisma/Postgres backend.

**Out of scope / non-goals (MVP):**
- Real-time multi-user collaborative editing (live cursors) — deferred.
- Native mobile applications — responsive web only.
- AI-assisted features — out of scope for MVP.
- Full-text search / Algolia — deferred (MVP uses `ILIKE` + trigram indexes).
- Audit logging — explicitly a post-MVP item (see §6).

### 1.3 Methodology

**STRIDE** is a threat-categorization framework. Each threat is classified into one of six categories and recorded with an ID, description, affected asset, attack scenario, likelihood, impact, mitigation (mapped to SRS requirement IDs and phase-doc locations), and residual risk.

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

> **Note on consistency:** This document is consistent with the locked decisions in [SRS] and the phase docs. Where the session strategy is concerned, the authoritative decision is the **`database` session strategy** (session token persisted in the `Session` table, validated server-side by `auth()`) per **FR-3** and **AR-2** — *not* a JWT-only session. Mitigations below reflect that decision.

---

## 2. System Boundaries & Trust Zones

### 2.1 Trust Zones

| Zone | Name | Trust level | Capabilities / constraints |
|------|------|-------------|----------------------------|
| **Zone 0** | Public Internet | **Untrusted** | Anonymous users with no session. Can only reach `PUBLIC` read routes. Cannot query the DB, cannot invoke Server Actions successfully. |
| **Zone 1** | Next.js Middleware (edge) | **Semi-trusted** | Runs at the edge. Can read request cookies. **Cannot query the database** (edge runtime). Performs cookie-presence checks only. |
| **Zone 2** | RSC / Server Actions | **Trusted server** | Runs in the Node.js serverless runtime. Can call `auth()`, query the DB via Prisma, and enforce RBAC authoritatively. |
| **Zone 3** | Prisma ORM → PostgreSQL | **Trusted backend** | The system of record. Enforces relational integrity (FKs, cascades, unique constraints) and stores all domain + auth data. |

### 2.2 Boundary Crossings

```
Zone 0 (Internet)
   │  HTTP request (cookie may or may not be present)
   ▼
Zone 1 (Edge Middleware)            ── validates: session-cookie PRESENCE only
   │  passes request to RSC/Action (does NOT block PUBLIC read routes)
   ▼
Zone 2 (RSC / Server Actions)       ── validates: auth() session + RBAC (requireUser / requireAdmin / canEditCollection / canViewCollection)
   │  Prisma query (ownership / visibility / role-scoped)
   ▼
Zone 3 (Prisma → Postgres)          ── validates: Zod-parsed input already; relational constraints enforced
```

| Crossing | What is validated / checked | What is **NOT** checked here |
|----------|-----------------------------|------------------------------|
| **0 → 1** (HTTP request → middleware) | Presence of `authjs.session-token` **or** `__Secure-authjs.session-token` (AR-3). Protected prefixes (`/dashboard`, `/snippets/new`, `/collections`, `/admin`) redirect to `/sign-in` when no cookie. `PUBLIC` collection read routes are **allowed through** even without a cookie (FR-44, NFR-24). | No DB/role lookup (edge cannot query DB — R-5). No decision about *which* collection a user may view. |
| **1 → 2** (middleware → RSC/Action) | `auth()` validates the session token **server-side against the `Session` table** (FR-3, AR-2). `requireUser()` / `requireAdmin()` / `canEditCollection()` / `canViewCollection()` enforce authorization (FR-28, AR-5, AR-6, [P1] §1.6). | — |
| **2 → 3** (RSC/Action → Prisma) | Inputs are Zod-validated at the server boundary (FR-32, NFR-7). Queries are scoped by `ownerId`, `visibility`, and `Membership` (IDOR prevention). Relational constraints (DM-1…DM-8) enforced by Postgres. | — |

> **Key principle (NFR-5):** Edge middleware is a *coarse* gate (cookie presence). **All** authoritative authorization decisions happen in Zone 2 via `auth()` + `lib/rbac.ts`. The anonymous-read surface is permitted **only** for `visibility === PUBLIC` and **only** on read (RSC) paths.

---

## 3. Assets

| Asset | Description | Why it matters |
|-------|-------------|----------------|
| **User PII** | `email`, `name`, `image`, OAuth tokens (`Account.access_token` / `refresh_token`) stored in Postgres. | Leakage enables phishing, account takeover, and privacy violations. |
| **Snippet content** | User-authored code, which may be private intellectual property. | Exposure of `PRIVATE`/`TEAM` snippets is a confidentiality breach. |
| **Collection visibility** | `Collection.visibility` (`PRIVATE` \| `PUBLIC` \| `TEAM`). `PRIVATE`/`TEAM` collections must not be enumerable or readable by anonymous users. | Incorrect visibility handling is the central risk of the new public surface. |
| **Auth sessions** | Session cookies (`authjs.session-token` / `__Secure-authjs.session-token`) and the `Session` rows they map to. | Forging or stealing a session impersonates a user. |
| **RBAC integrity** | Global `Role` (`USER` \| `ADMIN`) and per-collection `MembershipRole` (`VIEWER` \| `EDITOR` \| `ADMIN`). | Forgeable roles/assignments let a user act beyond their authorization. |

---

## 4. STRIDE Analysis

> **Rating scale:** Likelihood & Impact ∈ {Low, Medium, High}. "Residual risk" notes what remains after the stated mitigation.

### S — Spoofing

#### TM-S-01: Anonymous user spoofs a session cookie to impersonate an authenticated user
- **Affected asset:** Auth sessions.
- **Attack scenario:** An attacker forges or guesses a `authjs.session-token` cookie value and sends it with a request, hoping to be treated as a logged-in user.
- **Likelihood:** Low.
- **Impact:** High (full impersonation of any user).
- **Mitigation:** Auth.js issues a **signed** session cookie holding an **opaque session token** that is persisted in the `Session` table (the **`database` session strategy**, FR-3 / AR-2). On every RSC/Server Action, `auth()` validates the token **server-side against Postgres** (FR-4). A forged cookie whose token does not correspond to a valid `Session` row is rejected. The cookie is set with `secure`/`httpOnly` semantics by Auth.js; `__Secure-` prefix is used over HTTPS (AR-3). (AR-1, AR-2, AR-3, FR-3, FR-4)
- **Residual risk:** Low — depends on `AUTH_SECRET` strength/confidentiality (NFR-6). Token theft via other means is covered by TM-S-02.

#### TM-S-02: OAuth token theft (token stored in DB, intercepted)
- **Affected asset:** User PII (OAuth tokens), Auth sessions.
- **Attack scenario:** An attacker intercepts the OAuth `access_token` / `refresh_token` (stored in the `Account` table) or the `AUTH_*` secrets, enabling impersonation of the user at the provider or session forgery.
- **Likelihood:** Low.
- **Impact:** High.
- **Mitigation:** OAuth tokens live **only in Postgres** (`Account` rows), never in the client (NFR-6). Auth.js handles token storage and rotation via the `PrismaAdapter`. Secrets (`AUTH_SECRET`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_SECRET`) are server-only env vars and never exposed to the browser (NFR-6). Transport is HTTPS (Vercel). (AR-1, NFR-6)
- **Residual risk:** Low — relies on HTTPS everywhere and secret hygiene; a compromised DB would expose tokens (out of MVP threat scope, mitigated by DB access controls).

### T — Tampering

#### TM-T-01: Anonymous user reaches a Server Action mutation path without a session
- **Affected asset:** Snippet content, Collection visibility, RBAC integrity.
- **Attack scenario:** An attacker POSTs directly to a Server Action (e.g., `createSnippet`) without a session, attempting to create/modify/delete data.
- **Likelihood:** Medium (Server Actions are publicly addressable endpoints).
- **Impact:** High (unauthorized data mutation).
- **Mitigation:** **Every** Server Action calls `requireUser()` (or `auth()`) first; a missing session throws `UNAUTHORIZED` → 401/redirect (FR-31, FR-45, NFR-8, NFR-24). The anonymous read path is an **RSC page**, not a Server Action, so the entire mutation surface is authenticated by construction ([P3] §3.2). (FR-31, FR-45, NFR-8, NFR-24)
- **Residual risk:** Low — assumes every action is implemented with the `requireUser()` guard (enforced by code review / Phase 3 acceptance criteria).

#### TM-T-02: Authenticated user tampers with another user's snippet via direct ID
- **Affected asset:** Snippet content (others' IP).
- **Attack scenario:** A logged-in user calls `updateSnippet(id)` / `deleteSnippet(id)` with a `Snippet` id they do not own, hoping the action mutates it.
- **Likelihood:** Medium.
- **Impact:** High (destruction/alteration of another user's data — IDOR).
- **Mitigation:** Server Actions scope mutations by `ownerId`: `deleteSnippet` checks `existing?.ownerId !== user.id` → `FORBIDDEN` (FR-11). `updateSnippet` enforces owner-only update (FR-10). `requireUser()` (AR-5) establishes identity before the ownership check. (FR-10, FR-11, AR-5)
- **Residual risk:** Low — provided ownership checks are present on every snippet mutation (Phase 3 acceptance: "Edit another user's snippet (direct URL) → FORBIDDEN / redirect").

#### TM-T-03: Client-side Zod bypass (malformed payload to Server Action)
- **Affected asset:** Snippet content, data integrity.
- **Attack scenario:** A client bypasses its own form validation and sends a hand-crafted, oversized, or wrongly-typed payload directly to a Server Action.
- **Likelihood:** Medium.
- **Impact:** Medium (data corruption, storage abuse, potential crash).
- **Mitigation:** Server Actions **re-validate** all inputs with Zod schemas (`snippetSchema`, `collectionSchema`) at the server boundary; client validation is untrusted (FR-32, NFR-7). Validation failures return a typed `{ error }` result, never a 500 (FR-33). `code` is capped at 50,000 chars; `title` ≤ 200; `tagNames` ≤ 20 (FR-7, [P3] §3.1). (FR-7, FR-32, FR-33, NFR-7)
- **Residual risk:** Low.

### R — Repudiation

#### TM-R-01: User denies performing a mutation (no audit log)
- **Affected asset:** RBAC integrity, Snippet content (accountability).
- **Attack scenario:** A user performs a destructive action (e.g., deletes a shared `TEAM` snippet) and later denies it; there is no immutable record of *who* did *what*.
- **Likelihood:** Low (MVP is single-user/team, low adversarial context).
- **Impact:** Medium (dispute resolution impossible).
- **Mitigation:** MVP does **not** implement audit logging — this is a documented non-goal. Partial traceability is provided by `createdAt` / `updatedAt` timestamps on entities (DM schema, [P0] §schema). (Documented non-goal; see §6 Residual Risks.)
- **Residual risk:** **Accepted for MVP.** Post-MVP: introduce an append-only audit log of mutations (actor, action, target, timestamp).

### I — Information Disclosure

#### TM-I-01: PUBLIC collection read leaks PRIVATE/TEAM collection data (IDOR on collection id) — **CRITICAL**
- **Affected asset:** Collection visibility, Snippet content (PRIVATE/TEAM).
- **Attack scenario:** An anonymous user guesses or enumerates a `Collection` id and requests `/collections/[id]`; the RSC fetches it **without** a visibility check, exposing a `PRIVATE`/`TEAM` collection and its snippets.
- **Likelihood:** Medium (ids are cuid, but enumeration/leak is possible).
- **Impact:** High (confidentiality breach of private IP).
- **Mitigation:** RSC public-read queries **must** filter `visibility: "PUBLIC"`. `PRIVATE`/`TEAM` fetches require a session **and** (for `TEAM`) a `Membership`. `canViewCollection()` ([P1] §1.6) returns `true` only when `visibility === PUBLIC` for anonymous requests, and otherwise requires `userId` + ownership/membership. Unknown or non-public ids return **`NOT_FOUND`** (not `FORBIDDEN`) to avoid confirming existence / enabling enumeration. `listVisibleCollections` / `listPublicCollections` ([P2] §2.6) are the only sanctioned read paths. (FR-44, FR-46, NFR-5, NFR-24)
- **Residual risk:** Low — provided **every** collection read routes through `canViewCollection` / the visibility-scoped list helpers and never fetches by raw id without a guard ([P2] Risks: "Visibility leak" mitigation).

#### TM-I-02: Search leaks PRIVATE/TEAM snippets to anonymous users — **CRITICAL**
- **Affected asset:** Snippet content (PRIVATE/TEAM).
- **Attack scenario:** An anonymous user issues a search (or the public search surface) that returns snippets belonging to `PRIVATE`/`TEAM` collections because the search query is not visibility-scoped.
- **Likelihood:** Medium.
- **Impact:** High (confidentiality breach at scale via search).
- **Mitigation:** `searchSnippets` for an anonymous caller is scoped to snippets whose **collection `visibility === PUBLIC`** only. For an authenticated user, search adds their **owned** snippets plus those in collections where they hold a `Membership` ([P2] §2.4 note: "MUST NOT return PRIVATE/TEAM data"). The public search/browse surface is explicitly scoped to `visibility: "PUBLIC"` (FR-44, NFR-24). (FR-44, NFR-24)
- **Residual risk:** Low — provided the anonymous search path always applies the `visibility: "PUBLIC"` filter and never falls back to an unscoped `ownerId`/global query.

#### TM-I-03: Error messages leak internal structure (Prisma error / stack trace)
- **Affected asset:** User PII, system internals.
- **Attack scenario:** A failed mutation returns a raw Prisma error or stack trace exposing table/column names, query structure, or connection details to the client.
- **Likelihood:** Low.
- **Impact:** Medium (information disclosure aiding further attacks).
- **Mitigation:** Server Actions return **typed error results** (`{ error }`), not raw exceptions, for validation failures (FR-32, FR-33). Unexpected server errors are caught and surfaced generically; Next.js production builds strip stack traces from client-facing responses (NFR-12). (FR-32, FR-33, NFR-12)
- **Residual risk:** Low.

#### TM-I-04: PUBLIC collection page cache (ISR) serves stale data after a visibility change
- **Affected asset:** Collection visibility.
- **Attack scenario:** A collection is changed `PUBLIC → PRIVATE`, but a cached (ISR/edge) `PUBLIC` page continues to be served to anonymous users, exposing snippets that should now be private.
- **Likelihood:** Low.
- **Impact:** Medium (stale exposure after a visibility downgrade).
- **Mitigation:** A visibility change (e.g., `updateCollectionVisibility`) triggers cache invalidation for that collection — `revalidateTag` (and/or `revalidatePath`) for the affected collection detail and listing routes (FR-37, [P3] §3.7). Cached `PUBLIC` pages are invalidated on mutation so anonymous users cannot read a collection that is no longer `PUBLIC`. (FR-37, NFR-24)
- **Residual risk:** Low — assumes revalidation is wired to every visibility-changing action.

#### TM-I-05: User enumeration via sign-in error messages
- **Affected asset:** User PII (existence of accounts).
- **Attack scenario:** An attacker probes sign-in and receives a distinguishable "user not found" vs "wrong password" response, enumerating valid accounts.
- **Likelihood:** Low.
- **Impact:** Low/Medium (account-existence disclosure).
- **Mitigation:** The OAuth flow (GitHub/Google) does **not** expose credential-style "user not found" vs "wrong password" differentiation; there is no password form. Error messages are generic (AR-1). (AR-1)
- **Residual risk:** Low.

### D — Denial of Service

#### TM-D-01: Search query abuse (expensive `ILIKE` + `pg_trgm` queries)
- **Affected asset:** Availability (Postgres / app).
- **Attack scenario:** An attacker issues many expensive, unbounded `ILIKE '%term%'` searches (or a single pathological one) to overload the DB.
- **Likelihood:** Medium.
- **Impact:** Medium (elevated DB load, slower responses for all users).
- **Mitigation:** Search input is length-limited and debounced on the client; results are `take`-bounded (e.g., `take: 50`) and ordered by `updatedAt` desc (FR-19). `pg_trgm` GIN indexes make substring `ILIKE` fast (DM-7, [P0] §trigram). Architecture permits later migration to `tsvector`/Algolia (NFR-18). (FR-19, NFR-18, DM-7)
- **Residual risk:** Low/Medium — `ILIKE` may degrade at very high data volumes (see §6, "Search at scale").

#### TM-D-02: Unbounded pagination (fetch all snippets)
- **Affected asset:** Availability, payload size.
- **Attack scenario:** A client requests an enormous page size or iterates all pages rapidly, exhausting memory/DB connections.
- **Likelihood:** Low.
- **Impact:** Medium.
- **Mitigation:** Hard limit on page size (e.g., 50); cursor-based pagination (`take: 20`, peek-one) or `?page=` RSC pagination (FR-36, NFR-19, [P3] §3.6). (FR-36, NFR-19)
- **Residual risk:** Low.

#### TM-D-03: PUBLIC page cache stampede
- **Affected asset:** Availability (origin).
- **Attack scenario:** A spike of anonymous reads on `PUBLIC` collections bypasses caching and hits the origin/DB directly.
- **Likelihood:** Low.
- **Impact:** Medium.
- **Mitigation:** ISR / `revalidatePath` caching plus the Vercel edge CDN absorbs read load for `PUBLIC` pages; anonymous reads are served from cache where possible ([P4] §4.2). (NFR-1, [P4])
- **Residual risk:** Low — relies on Vercel platform-level caching/DDoS protection.

### E — Elevation of Privilege

#### TM-E-01: VIEWER member escalates to EDITOR/ADMIN via `updateMemberRole` on themselves
- **Affected asset:** RBAC integrity.
- **Attack scenario:** A `VIEWER` calls a membership-management action (e.g., `updateMemberRole`) targeting their own `Membership`, promoting themselves to `EDITOR`/`ADMIN` of a `TEAM` collection.
- **Likelihood:** Low.
- **Impact:** High (unauthorized edit/admin rights on a collection).
- **Mitigation:** `updateMemberRole` (and all membership management) requires the **actor** to hold `MembershipRole.ADMIN` on that collection (or be the owner). `canEditCollection()` / the permission matrix enforce this; the Prisma query checks the actor's role before applying any change, and a member can never grant themselves a higher role (FR-29, AR-6, [SRS] §3.5.2 matrix: "Manage collection membership" → Owner / Member ADMIN only). (FR-29, AR-6, [SRS] §3.5.2)

> **ponytail (updated — actual implementation):** `updateMemberRole` is **not** implemented in the final build (deferred/post-MVP); only `addMember`/`removeMember` exist in `actions/collections.ts`. The escalation path it describes is therefore currently moot, but the principle (membership changes require collection ADMIN) remains the designed control.
- **Residual risk:** Low.

#### TM-E-02: Regular USER escalates to global ADMIN
- **Affected asset:** RBAC integrity (global `Role`).
- **Attack scenario:** A `USER` invokes or manipulates a Server Action to set their global `Role` to `ADMIN`, gaining `/admin` access.
- **Likelihood:** Low.
- **Impact:** High (full admin capabilities).
- **Mitigation:** The global `Role` enum (`USER` \| `ADMIN`) is set at the DB/provisioning level; **no Server Action exposes a mutation for the global `Role`**. `requireAdmin()` throws `FORBIDDEN` unless `user.role === ADMIN` (AR-5). Admin provisioning is manual/seed only (FR-25). (FR-25, AR-5)
- **Residual risk:** Low.

#### TM-E-03: User adds themselves to a collection they don't own
- **Affected asset:** RBAC integrity, Collection visibility.
- **Attack scenario:** A user calls `addMember` to insert their own `Membership` into a `TEAM` collection they are not part of, gaining read/edit access.
- **Likelihood:** Low.
- **Impact:** High (unauthorized collection access).
- **Mitigation:** `addMember` requires the **actor** to be the collection owner or a `MembershipRole.ADMIN` (FR-29, AR-6). Membership is **never self-service**; the `(userId, collectionId)` pair is unique (DM-3), and the action validates the actor's role before inserting any membership ([SRS] §3.5.2 matrix). (FR-29, AR-6, DM-3)
- **Residual risk:** Low.

---

## 5. Mitigation Summary Table

| Threat ID | Mitigation (summary) | SRS Requirement ID | Phase | Status |
|-----------|----------------------|--------------------|-------|--------|
| TM-S-01 | Signed session cookie + DB-backed `Session` token validated by `auth()` | FR-3, FR-4, AR-1, AR-2, AR-3 | [P1] | Planned |
| TM-S-02 | OAuth tokens in Postgres only; secrets server-side; HTTPS | AR-1, NFR-6 | [P0]/[P1] | Planned |
| TM-T-01 | Every Server Action calls `requireUser()`; anon → 401/redirect | FR-31, FR-45, NFR-8, NFR-24 | [P1]/[P3] | Planned |
| TM-T-02 | Mutations scoped by `ownerId`; owner-only enforced | FR-10, FR-11, AR-5 | [P3] | Planned |
| TM-T-03 | Server-side Zod re-validation at boundary | FR-7, FR-32, FR-33, NFR-7 | [P3] | Planned |
| TM-R-01 | `createdAt`/`updatedAt` partial traceability (no audit log in MVP) | — (documented non-goal) | — | Accepted (post-MVP) |
| TM-I-01 | Public reads filter `visibility: "PUBLIC"`; unknown → `NOT_FOUND` | FR-44, FR-46, NFR-5, NFR-24 | [P1]/[P2] | Planned |
| TM-I-02 | Anonymous search scoped to `PUBLIC`-collection snippets only | FR-44, NFR-24 | [P2] | Planned |
| TM-I-03 | Typed error results; prod strips stack traces | FR-32, FR-33, NFR-12 | [P3] | Planned |
| TM-I-04 | Visibility change triggers `revalidateTag`/`revalidatePath` | FR-37, NFR-24 | [P3] | Planned |
| TM-I-05 | OAuth flow; generic errors; no credential probing | AR-1 | [P1] | Planned |
| TM-D-01 | Input length limits, debounce, `take` bound, `pg_trgm` GIN | FR-19, NFR-18, DM-7 | [P0]/[P2] | Planned |
| TM-D-02 | Hard page-size limit; cursor/`?page=` pagination | FR-36, NFR-19 | [P2]/[P3] | Planned |
| TM-D-03 | ISR + Vercel edge cache absorbs anonymous read load | NFR-1, [P4] | [P4] | Planned |
| TM-E-01 | `updateMemberRole` requires collection ADMIN; self-promotion blocked *(updated — action not implemented)* | FR-29, AR-6, [SRS] §3.5.2 | [P1]/[P3] | Planned |
| TM-E-02 | Global `Role` not mutable via any Server Action; `requireAdmin` | FR-25, AR-5 | [P1] | Planned |
| TM-E-03 | `addMember` requires collection ADMIN; membership never self-service | FR-29, AR-6, DM-3 | [P1]/[P3] | Planned |

> **Status legend:** *Implemented* = designed in the phase docs and built (project complete, July 2026). *Accepted* = residual risk consciously carried for MVP.

---

## 6. Residual Risks

Risks explicitly accepted for the MVP, with rationale:

1. **No audit logging (Repudiation — TM-R-01).** MVP does not implement an append-only mutation audit log. Rationale: single-user/team portfolio scope; `createdAt`/`updatedAt` provide partial traceability. *Post-MVP:* add audit log (actor, action, target, timestamp).

2. **Auth.js v5 is beta (Spoofing — TM-S-01/S-02).** API churn is possible. Mitigation already in place: all Auth.js config isolated in `lib/auth.ts`; version pinned in `package.json`; type augmentation in `types/next-auth.d.ts` (R-1, NFR-14). Residual risk: a breaking beta change may require a config update.

3. **Search at scale (Information Disclosure / DoS — TM-I-02/TM-D-01).** `ILIKE` + `pg_trgm` is sufficient only to MVP data volumes; it may not scale beyond ~100K snippets. Mitigation: architecture permits migration to Postgres `tsvector` full-text or Algolia without domain-model change (R-3, NFR-18). Residual risk: degraded search performance at very high volume.

4. **Rate limiting not in MVP (DoS — TM-D-01/D-02/D-03).** No application-level rate limiting on search or read endpoints. Rationale: Vercel platform-level DDoS protection and edge caching absorb most abuse for a portfolio project. *Post-MVP:* add app-level rate limiting (e.g., Vercel KV / Upstash) on Server Actions and search.

5. **Stale-cache window (Information Disclosure — TM-I-04).** Between a visibility change and cache revalidation, a cached `PUBLIC` page could briefly serve content that just became `PRIVATE`/`TEAM`. Mitigation: revalidation is triggered synchronously by the mutating action (FR-37). Residual risk: a narrow window proportional to revalidation latency.

---

## 7. Cross-references

- **Anonymous read surface & mutation denial:** FR-44, FR-45, FR-46, NFR-24, NFR-5; [P1] §1.5–§1.6; [P2] §2.4, §2.6; [P3] §3.2.
- **Session strategy (database, not JWT):** FR-3, AR-2; [P1] §1.3.
- **Edge middleware cookie check:** AR-3, AR-4, FR-6, FR-27; [P1] §1.5.
- **RBAC helpers:** AR-5, AR-6, FR-28, FR-29; [P1] §1.6; permission matrix [SRS] §3.5.2.
- **Zod validation:** FR-7, FR-32, FR-33, NFR-7; [P3] §3.1.
- **Search & indexing:** FR-17, FR-18, FR-19, NFR-18, DM-7; [P0] §trigram; [P2] §2.4.
- **Pagination:** FR-36, NFR-19; [P3] §3.6.
- **Revalidation / caching:** FR-37; [P3] §3.7; [P4] §4.2.
- **Data model & enums:** [SRS] §3.4 (Role, Visibility, MembershipRole; DM-1…DM-8); [P0] §schema.
- **Risks & open decisions:** [SRS] Appendix A (R-1…R-9), especially R-5 (edge can't query DB), R-6 (anonymous PUBLIC access decided).

---

*This threat model is derived solely from `IMPLEMENTATION_PLAN.md`, `docs/SRS.md`, and `docs/PHASE_0..4_*.md`. It introduces no new requirements that contradict those documents and is intended as a lightweight, design-time security reference for the DCodeBook MVP.*

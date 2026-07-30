# ADR-005: Allow anonymous read of PUBLIC collections

- **Status:** Accepted
- **Date:** 2026-07-30
- **Decision Maker:** Chakinzo Sombito (project owner)
- **References:**
  - `../MVP_IMPLEMENTATION_PLAN.md` §6 (MVP Feature Scope — PUBLIC collections readable by anyone, including anonymous)
  - `../SRS.md` §1.2 (Out-of-scope note — unauthenticated public browsing of PUBLIC collections IS permitted), §2.3 (User Classes — Unauthenticated visitor), FR-44, FR-45, FR-46, NFR-24, §3.5.2 (RBAC permission matrix), Appendix A (R-6 — DECIDED), Appendix C (Post-MVP — public browsing now in scope)
  - `../PHASE_1_AUTH_AND_RBAC.md` §1.5 (Public collection read routes NOT gated by middleware), §1.6 (`canViewCollection` — anonymous may READ PUBLIC only)
  - `../PHASE_2_MVP_BUILD.md` §2.4 (Public browse/search), §2.6 (`listPublicCollections` — anonymous-readable)
  - `../PHASE_3_MUTATIONS_AND_UX.md` §3.2 (Anonymous requests to Server Actions rejected; read path is RSC, not an action)

## Context

The SRS originally left unauthenticated access to `PUBLIC` collections as an
open item (R-6). The product needs a sharing/discovery story: a user who
publishes a snippet collection should be able to share a link that anyone can
open, without forcing recipients to sign in. At the same time, the entire
mutation surface and all `PRIVATE`/`TEAM` data must remain strictly
authenticated.

The decision had to balance **public sharing/discovery** (a core value of a
snippet canvas) against **security** (no leakage of private data, no anonymous
mutations). This was a user (project owner) decision that resolved the open
item.

## Decision

**Allow unauthenticated (anonymous) users to READ any `PUBLIC` collection and
the snippets within it, without a session.**

- `PUBLIC` collections are viewable by anyone, including anonymous visitors, in
  both listings and detail pages.
- `PRIVATE` and `TEAM` collections remain auth-gated: they require a valid
  session and (for `TEAM`) an appropriate membership; anonymous users are
  denied and redirected to `/sign-in`.
- **All mutations remain auth-gated.** Every Server Action (`createSnippet`,
  `updateSnippet`, `deleteSnippet`, `createCollection`,
  `updateCollectionVisibility`, `addMember`, tagging mutations) calls
  `requireUser()` and rejects unauthenticated invocations (401/redirect). The
  anonymous read path is an RSC page (e.g., `listPublicCollections`, a public
  search scoped to `visibility: "PUBLIC"`), never a Server Action, so the
  entire mutation surface stays authenticated.

## Consequences

**Positive:**
- Enables public sharing and discovery of snippets — a link to a `PUBLIC`
  collection can be opened by anyone, supporting the product's sharing goal.
- Clear, enforceable security boundary: anonymous users get READ on `PUBLIC`
  only; `PRIVATE`/`TEAM` data is never exposed, and no mutation is possible
  without a session (FR-44/45/46, NFR-24, NFR-5).
- The RBAC permission matrix (SRS §3.5.2) now has an explicit, decided row for
  anonymous access, removing ambiguity for implementers.

**Negative:**
- Public collection pages must include OpenGraph/Twitter metadata so shared
  links render rich previews (Phase 4 §4.3) — a small additional requirement,
  not a cost.
- Anonymous reads must be carefully scoped in queries (e.g.,
  `listPublicCollections`, `canViewCollection`) to never return `PRIVATE`/`TEAM`
  data — a discipline requirement, mitigated by centralized query helpers.

**Neutral:**
- Authenticated-user behavior, the global `Role`, and `MembershipRole` logic are
  unchanged.

## Alternatives Considered

- **Require authentication for all collection reads, including PUBLIC (rejected):**
  Would have been simpler from a middleware standpoint (every route gated) but
  would defeat the public-sharing/discovery value proposition and force every
  link recipient to sign in. Rejected because it conflicted with the product's
  sharing goal and the owner's explicit decision.
- **Allow anonymous reads of all collections (rejected):** Would leak
  `PRIVATE`/`TEAM` data and violate the core security requirement. Rejected as
  insecure.
- **Allow anonymous mutations on PUBLIC collections (rejected):** Would let
  unauthenticated users edit/delete shared content, a non-starter for
  integrity and security. Rejected; all mutations stay auth-gated.

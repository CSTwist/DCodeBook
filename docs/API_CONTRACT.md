# DCodeBook — Server Action & API Contract

> **Document type:** API / Server Action Contract (the security boundary)
> **Project:** DCodeBook — a real-time full-stack knowledge base & code snippet canvas for developers
> **Status:** ✅ Complete (July 2026) — implemented; all Server Actions present except `updateMemberRole` (deferred) and `loadMore` (replaced by client-side infinite scroll).
> **Source of truth:** [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) and the five phase docs under `docs/` (see §1.4)

---

## 1. Introduction

### 1.1 Purpose

DCodeBook is **Server-Actions-first**: it exposes **no REST or GraphQL API** in the MVP. Every create / update / delete operation is performed by a Next.js **Server Action** (`"use server"` function) invoked from a form or client component. Because there is no separate HTTP API layer, **the Server Action surface *is* the API contract and the security boundary** for all mutations.

This document is the authoritative contract for that surface. It defines:

- Where each Server Action lives and what it does.
- The input (Zod) schema, output shape, and standard error envelope for every action.
- The authentication and authorization (RBAC) checks each action must perform.
- The cache-revalidation triggers each action fires.
- The edge middleware contract and the data-access-layer (DAL) scoping rules that back every action.

Reads (snippet/collection/tag viewing and search) are **not** Server Actions — they are performed by React Server Components (RSC) calling the data-access layer directly. This document documents those read paths as RSC data fetches so the full access-control picture is complete.

### 1.2 Scope

**In scope.**

- All mutation Server Actions under `actions/` (snippets, collections, memberships, tags).
- The standard result/error envelope returned by every action.
- The `middleware.ts` edge contract (cookie-presence only).
- The `lib/prisma.ts` (a.k.a. `lib/db.ts`) data-access-layer scoping rules, including IDOR prevention.
- RSC read paths for `getSnippet`, collection reads, and `searchSnippets` (documented for completeness of the access-control model, even though they are not Server Actions).

**Out of scope / non-goals (MVP).**

- Real-time multi-user collaborative editing — deferred.
- Full-text search / Algolia — deferred (MVP uses Postgres `ILIKE` + `pg_trgm` GIN indexes).
- AI-assisted features — out of scope.
- Native mobile apps — responsive web only.

### 1.3 Why there is no OpenAPI / REST spec

Server Actions are invoked by the Next.js framework over the same-origin POST that renders the calling route; they are not addressable REST endpoints and do not emit an OpenAPI document. The contract here is expressed as prose + Zod schemas + TypeScript result types instead of an OpenAPI YAML. This is consistent with the locked decision in [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) §4 ("Server Actions for mutations") and SRS §3.1.2 / FR-31.

### 1.4 References

| Ref | Document | Relative path |
|-----|----------|---------------|
| [PLAN] | DCodeBook High-Level Implementation Plan | [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) |
| [SRS] | Software Requirements Specification | [`./SRS.md`](./SRS.md) |
| [P0] | Phase 0 — Setup & Data Modeling | [`./PHASE_0_SETUP_AND_DATA_MODELING.md`](./PHASE_0_SETUP_AND_DATA_MODELING.md) |
| [P1] | Phase 1 — Authentication & RBAC | [`./PHASE_1_AUTH_AND_RBAC.md`](./PHASE_1_AUTH_AND_RBAC.md) |
| [P2] | Phase 2 — MVP Build | [`./PHASE_2_MVP_BUILD.md`](./PHASE_2_MVP_BUILD.md) |
| [P3] | Phase 3 — Mutations & UX | [`./PHASE_3_MUTATIONS_AND_UX.md`](./PHASE_3_MUTATIONS_AND_UX.md) |
| [P4] | Phase 4 — Polish & Ship | [`./PHASE_4_POLISH_AND_SHIP.md`](./PHASE_4_POLISH_AND_SHIP.md) |

---

## 2. Conventions

### 2.1 Location & grouping

- All Server Actions live in `actions/*.ts`, grouped by domain:
  - `actions/snippets.ts` — snippet mutations (`createSnippet`, `updateSnippet`, `deleteSnippet`, `loadMore`).
  - `actions/collections.ts` — collection + membership mutations (`createCollection`, `updateCollection`, `deleteCollection`, `addMember`, `removeMember`). *(updated — there is **no** `actions/memberships.ts`; `updateMemberRole` is **not** implemented — deferred/post-MVP.)*
  - `actions/tags.ts` — tag mutations (`createTag`).
- Each file begins with `"use server";` at the top (or each exported function is individually marked).
- Read paths are **not** Server Actions. They are RSC data fetches that call the data-access layer (`lib/prisma.ts`, `lib/search.ts`, `lib/collections.ts`, `lib/tags.ts`) directly.

### 2.2 The five-step mutation pipeline

Every **mutation** Server Action SHALL follow this pipeline, in order:

1. **Authenticate** — call `requireUser()` from `lib/rbac.ts` (which calls `auth()` from `lib/auth.ts`). If there is no session, `requireUser()` throws `UNAUTHORIZED`, which this contract surfaces as the `UNAUTHENTICATED` error code (see §3). This rejects anonymous invocations (FR-45, NFR-24).
2. **Validate** — parse the input with the relevant Zod schema (`lib/validations.ts`). On failure, return a `VALIDATION` error with `fieldErrors`; **do not throw** (FR-32, NFR-7).
3. **Authorize (RBAC)** — perform the ownership / role check via `lib/rbac.ts` (`canEditCollection`, `requireAdmin`, or an explicit owner/membership check). On failure, throw `FORBIDDEN` (surfaced as the `FORBIDDEN` error code).
4. **Mutate** — execute the Prisma write through the `lib/prisma.ts` singleton. Never trust a client-provided `ownerId`; always derive the owner from the session user (IDOR prevention, §6).
5. **Revalidate** — call `revalidatePath` (and `revalidateTag` where applicable) for every affected route so RSC output stays consistent (FR-37).

> **Throwing vs. returning.** Validation failures return a structured error result. Auth/role/ownership violations **throw** (the framework converts these into a 401/redirect or 500 as appropriate). This matches SRS FR-33 and [P3] §3.2 / §3.4.

### 2.3 Anonymous users and the mutation surface

- **Anonymous (unauthenticated) users CANNOT invoke any Server Action.** Every mutation action calls `requireUser()` first and rejects a missing session with `UNAUTHENTICATED` (401/redirect) (FR-45, NFR-24, [P3] §3.2).
- **Anonymous reads are allowed ONLY for `PUBLIC` collections and their snippets**, and those reads happen via **RSC data fetching, not Server Actions** ([P1] §1.5/§1.6, [P2] §2.6, FR-44). There is therefore no Server Action that an anonymous user can call.

### 2.4 Standard result envelope

Every Server Action returns a structured result of one of these two shapes (TypeScript, illustrative contract definition — not a real file):

```ts
// actions/_types.ts (illustrative contract type)
export type ActionError = {
  code: ActionErrorCode;        // "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "INTERNAL"
  message: string;              // human-readable, safe to surface to the client
  fieldErrors?: Record<string, string[]>; // present only for VALIDATION
};

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ActionError };

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INTERNAL";
```

> **Consistency note (SRS FR-33).** SRS §3.2.8 (FR-33) describes the same structured-result pattern as `{ ok: true, data }` / `{ ok: false, error }`. This contract adopts `success` as the canonical boolean field name; `success` and `ok` are equivalent in intent. The `error` object here is the typed, code-bearing form required by §3.

### 2.5 Shared Zod schemas

Defined once in `lib/validations.ts` ([P3] §3.1) and reused by actions and (optionally) client forms.

```ts
// lib/validations.ts (illustrative contract schema)
import { z } from "zod";

export const snippetCreateSchema = z.object({
  title: z.string().min(1, "Title required").max(200),
  description: z.string().max(2000).optional(),
  code: z.string().min(1, "Code required").max(50_000),
  language: z.string().min(1).max(50),
  tagNames: z.array(z.string().min(1).max(40)).max(20).optional(),
  collectionId: z.string().cuid().optional().nullable(),
});

export const snippetUpdateSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  code: z.string().min(1).max(50_000).optional(),
  language: z.string().min(1).max(50).optional(),
  tagNames: z.array(z.string().min(1).max(40)).max(20).optional(),
});

export const collectionCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC", "TEAM"]),
});

export const collectionUpdateSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC", "TEAM"]).optional(),
});

export const membershipAddSchema = z.object({
  collectionId: z.string().cuid(),
  userEmail: z.string().email(),
  role: z.enum(["VIEWER", "EDITOR", "ADMIN"]),
});

export const membershipUpdateRoleSchema = z.object({
  collectionId: z.string().cuid(),
  userId: z.string().cuid(),
  role: z.enum(["VIEWER", "EDITOR", "ADMIN"]),
});

export const membershipRemoveSchema = z.object({
  collectionId: z.string().cuid(),
  userId: z.string().cuid(),
});

export const tagCreateSchema = z.object({
  name: z.string().min(1).max(40),
});
```

---

## 3. Error Code Reference

All error codes are returned in the `error.code` field of the standard envelope (§2.4). Auth/role violations are thrown by the action and surfaced by the framework as a 401/redirect or 500; validation and conflict errors are **returned** as data (never thrown).

| Code | HTTP-semantic meaning | Returned by (thrown vs. returned) | Trigger |
|------|----------------------|-----------------------------------|---------|
| `UNAUTHENTICATED` | 401 / redirect to `/sign-in` | **thrown** by `requireUser()` (SRS/rbac throws `"UNAUTHORIZED"` → mapped to this code) | No session on any mutation Server Action. |
| `FORBIDDEN` | 403 | **thrown** by RBAC check (rbac throws `"FORBIDDEN"`) | Authenticated but lacks ownership / `MembershipRole` / global `ADMIN` for the operation. |
| `NOT_FOUND` | 404 | **thrown** after a `findUnique` miss, or returned | Target resource (snippet, collection, user, membership) does not exist or is not visible to the caller. |
| `VALIDATION` | 422 | **returned** (never thrown) | Zod `safeParse` failure; `fieldErrors` populated. |
| `CONFLICT` | 409 | **returned** (or thrown as `INTERNAL` if unhandled) | Unique-constraint violation — duplicate `Tag.name` (`DM-2`) or duplicate `(userId, collectionId)` membership (`DM-3`). |
| `INTERNAL` | 500 | **thrown** (unexpected) | Unhandled DB/runtime error; must not leak stack traces to the client (NFR-12). |

**Which actions can return each code**

| Action | UNAUTH | FORBIDDEN | NOT_FOUND | VALIDATION | CONFLICT | INTERNAL |
|--------|:------:|:---------:|:---------:|:----------:|:--------:|:--------:|
| `createSnippet` | ✅ | ✅* | ✅** | ✅ | — | ✅ |
| `updateSnippet` | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| `deleteSnippet` | ✅ | ✅ | ✅ | ✅*** | — | ✅ |
| `loadMore` | ✅ | — | — | ✅ | — | ✅ |
| `createCollection` | ✅ | — | — | ✅ | — | ✅ |
| `updateCollection` | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| `deleteCollection` | ✅ | ✅ | ✅ | ✅*** | — | ✅ |
| `addMember` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `updateMemberRole` *(not implemented)* | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| `removeMember` | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| `createTag` | ✅ | — | — | ✅ | ✅ | ✅ |

\* `createSnippet` returns `FORBIDDEN` only when a `collectionId` is supplied and the caller is neither the collection owner nor a member with `EDITOR`/`ADMIN` `MembershipRole` (i.e., cannot add a snippet to that collection).
\*\* `createSnippet` returns `NOT_FOUND` when the supplied `collectionId` references a non-existent collection.
\*\*\* `deleteSnippet` / `deleteCollection` take only an `id` (cuid); `VALIDATION` covers a malformed id. `updateSnippet` / `updateCollection` include `id` in their update schema.

---

## 4. Server Action Catalog

For each action: **name**, **file**, **Zod input**, **output `data`**, **auth requirement**, **RBAC check** (`lib/rbac.ts`), **revalidate triggers**, and **error cases**.

> **RBAC helper reference** (`lib/rbac.ts`, [P1] §1.6):
> - `requireUser()` → throws `UNAUTHORIZED` if no session; returns `session.user` (`{ id, role }`).
> - `requireAdmin()` → `requireUser()` + `user.role === "ADMIN"`, else throws `FORBIDDEN`.
> - `canEditCollection(collectionId, userId)` → `true` if owner OR member with `EDITOR`/`ADMIN` `MembershipRole`.
> - `canViewCollection(collectionId, userId?)` → `true` for `PUBLIC` (even anonymous), or for owner / member with any `MembershipRole` on `PRIVATE`/`TEAM`.

### 4.1 Snippet actions — `actions/snippets.ts`

#### 4.1.1 `createSnippet`

- **File:** `actions/snippets.ts`
- **Auth requirement:** Authenticated session (`requireUser`). The creating user becomes the snippet `ownerId`.
- **Zod input:** `snippetCreateSchema` (§2.5) — `title`, `description?`, `code`, `language`, `tagNames?` (≤20, each ≤40), `collectionId?` (cuid | null).
- **RBAC check:**
  - `requireUser()` (step 1).
  - If `collectionId` is provided: verify the collection exists and the user may add to it — owner OR `canEditCollection(collectionId, user.id)` is `true`. Otherwise `FORBIDDEN`. (A snippet may live in a collection the user can edit; the snippet itself is always owned by the caller.)
- **Prisma mutation:** `prisma.snippet.create({ data: { ...fields, ownerId: user.id, tags: { create: tagNames.map(name => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } }) ) } } })`. Uses `connectOrCreate` keyed on `Tag.name` so no duplicate `Tag` rows are created (FR-14, `DM-2`, [P3] §3.2).
- **Output `data`:** `{ snippetId: string }`.
- **Revalidate triggers:** `revalidatePath("/snippets")`, `revalidatePath("/dashboard")`, and `revalidatePath("/collections/" + collectionId)` when `collectionId` is set.
- **Error cases:** `UNAUTHENTICATED` (no session), `VALIDATION` (Zod fail → `fieldErrors`), `NOT_FOUND` (supplied `collectionId` not found), `FORBIDDEN` (collection supplied but caller lacks write access), `INTERNAL` (unexpected).
- **Cross-references:** FR-7, FR-8, FR-14, FR-31, FR-32, FR-37; [P3] §3.2; NFR-7, NFR-24.

#### 4.1.2 `updateSnippet`

- **File:** `actions/snippets.ts`
- **Auth requirement:** Authenticated session (`requireUser`).
- **Zod input:** `snippetUpdateSchema` (§2.5) — `id` (cuid, required), plus any of `title?`, `description?`, `code?`, `language?`, `tagNames?`.
- **RBAC check:**
  - `requireUser()` (step 1).
  - Load the snippet; if `snippet.ownerId === user.id` → allowed.
  - Else if the snippet has a `collectionId` and `canEditCollection(collectionId, user.id)` is `true` → allowed (collection `EDITOR`/`ADMIN` may edit snippets within the collection).
  - Otherwise `FORBIDDEN`. (A plain `TEAM` `VIEWER` may not edit; another user's privately-owned snippet is `FORBIDDEN`.)
- **Prisma mutation:** `prisma.snippet.update({ where: { id }, data: { ...providedFields, tags: { ... } } })`. Tag array is reconciled via `connectOrCreate` (and disconnect of removed tags) keyed on `Tag.name`.
- **Output `data`:** `{ snippetId: string }`.
- **Revalidate triggers:** `revalidatePath("/snippets")`, `revalidatePath("/snippets/" + id)`, `revalidatePath("/dashboard")`, and `revalidatePath("/collections/" + collectionId)` when applicable.
- **Error cases:** `UNAUTHENTICATED`, `VALIDATION`, `NOT_FOUND` (snippet id missing or not found), `FORBIDDEN` (not owner and not collection editor/admin), `INTERNAL`.
- **Cross-references:** FR-10, FR-31, FR-32, FR-37; [P3] §3.2; NFR-7, NFR-24.

#### 4.1.3 `deleteSnippet`

- **File:** `actions/snippets.ts`
- **Auth requirement:** Authenticated session (`requireUser`).
- **Zod input:** `{ id: string.cuid() }` (id only).
- **RBAC check:**
  - `requireUser()` (step 1).
  - If `snippet.ownerId === user.id` → allowed.
  - Else if the snippet has a `collectionId` and the user is the collection **ADMIN** (owner OR `MembershipRole.ADMIN`) → allowed. (Collection `EDITOR` may *edit* but only owner / collection `ADMIN` may *delete* a snippet — see permission matrix §4.7.)
  - Otherwise `FORBIDDEN`.
- **Prisma mutation:** `prisma.snippet.delete({ where: { id } })`. Cascades `SnippetTag` rows (`onDelete: Cascade`); `collectionId` is `SetNull` so the collection is preserved (FR-12, `DM-5`, `DM-6`).
- **Output `data`:** `{ snippetId: string }` (echo of deleted id).
- **Revalidate triggers:** `revalidatePath("/snippets")`, `revalidatePath("/dashboard")`, and `revalidatePath("/collections/" + collectionId)` when applicable.
- **Error cases:** `UNAUTHENTICATED`, `VALIDATION` (malformed id), `NOT_FOUND` (snippet missing), `FORBIDDEN` (not owner and not collection admin), `INTERNAL`.
- **Cross-references:** FR-11, FR-12, FR-31, FR-37; [P3] §3.2; NFR-24.

#### 4.1.4 `loadMore` (pagination — supplementary)

- **File:** `actions/snippets.ts`
- **Auth requirement:** Authenticated session (`requireUser`). (It is a Server Action returning data; anonymous users cannot call it — they use the public RSC listing instead.)
- **Zod input:** `{ cursor?: string.cuid(), take?: number.default(20) }`.
- **RBAC check:** `requireUser()` only; query is scoped to `ownerId: user.id` (IDOR-safe, §6).
- **Prisma query:** `prisma.snippet.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" }, take: take + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })` ([P3] §3.6).
- **Output `data`:** `{ items: Snippet[], nextCursor: string | null }`.
- **Revalidate triggers:** none (read path; relies on RSC cache + `revalidatePath` from mutations).
- **Error cases:** `UNAUTHENTICATED`, `VALIDATION`, `INTERNAL`.
- **Cross-references:** FR-36, NFR-19; [SRS] §3.1.2; [P3] §3.6.

#### 4.1.5 `getSnippet` — **READ (RSC, not a Server Action)**

- **Nature:** This is a **read**, performed inside a React Server Component (e.g., `app/(app)/snippets/[id]/page.tsx` or the public collection detail RSC), **not** a Server Action. Documented here for access-control completeness.
- **Auth scoping:**
  - If the snippet belongs to a `PUBLIC` collection → readable by **anyone, including anonymous** (FR-44, NFR-24).
  - If the snippet is owned by the caller → readable.
  - If the snippet belongs to a `PRIVATE`/`TEAM` collection → readable only by the owner or a member with any `MembershipRole` (`canViewCollection`); anonymous users are redirected to `/sign-in` (FR-46).
- **Implementation:** RSC calls `prisma.snippet.findUniqueOrThrow({ where: { id } })` (or `findUnique` + `canViewCollection` guard) and renders Shiki-highlighted HTML server-side (FR-13, [P2] §2.3). `NOT_FOUND` → 404 page.
- **Cross-references:** FR-9, FR-13, FR-44, FR-46; [P2] §2.3; NFR-24.

### 4.2 Collection actions — `actions/collections.ts`

#### 4.2.1 `createCollection`

- **File:** `actions/collections.ts`
- **Auth requirement:** Authenticated session (`requireUser`). The creating user becomes the collection `ownerId`.
- **Zod input:** `collectionCreateSchema` (§2.5) — `name` (≤120), `description?` (≤2000), `visibility` (`PRIVATE` | `PUBLIC` | `TEAM`, default `PRIVATE`).
- **RBAC check:** `requireUser()` only (any authenticated user may create a collection they own).
- **Prisma mutation:** `prisma.collection.create({ data: { name, description, visibility, ownerId: user.id } })`.
- **Output `data`:** `{ collectionId: string }`.
- **Revalidate triggers:** `revalidatePath("/collections")`, `revalidatePath("/dashboard")`.
- **Error cases:** `UNAUTHENTICATED`, `VALIDATION`, `INTERNAL`. (No `CONFLICT` — `Collection.name` is **not** unique per `DM-1…DM-8`; only `Tag.name`, `User.email`, and the membership pair are unique.)
- **Cross-references:** FR-20, FR-21, FR-31, FR-32, FR-37; [P3] §3.2; NFR-24.

#### 4.2.2 `updateCollection`

> Consolidates the `updateCollectionVisibility` action referenced in [SRS] §3.1.2 and [P3] §3.7. This contract uses the single name `updateCollection` with optional `name` / `description` / `visibility` fields.

- **File:** `actions/collections.ts`
- **Auth requirement:** Authenticated session (`requireUser`).
- **Zod input:** `collectionUpdateSchema` (§2.5) — `id` (cuid, required), plus any of `name?`, `description?`, `visibility?`.
- **RBAC check:**
  - `requireUser()` (step 1).
  - Allowed if `collection.ownerId === user.id` **OR** `user.role === "ADMIN"` (global admin) **OR** `canEditCollection(id, user.id)` is `true` (collection `EDITOR`/`ADMIN` membership). This matches the permission matrix row "Edit TEAM collection / its snippets" (owner ✅, global ADMIN ✅, member EDITOR ✅, member ADMIN ✅, member VIEWER ❌).
- **Prisma mutation:** `prisma.collection.update({ where: { id }, data: { ...providedFields } })`.
- **Output `data`:** `{ collectionId: string }`.
- **Revalidate triggers:** `revalidatePath("/collections")`, `revalidatePath("/collections/" + id)`, `revalidatePath("/dashboard")`.
- **Error cases:** `UNAUTHENTICATED`, `VALIDATION`, `NOT_FOUND` (collection missing), `FORBIDDEN` (not owner / not global admin / not collection editor-or-admin), `INTERNAL`.
- **Cross-references:** FR-21, FR-22, FR-31, FR-37; [P3] §3.7; NFR-24.

#### 4.2.3 `deleteCollection`

- **File:** `actions/collections.ts`
- **Auth requirement:** Authenticated session (`requireUser`).
- **Zod input:** `{ id: string.cuid() }` (id only).
- **RBAC check:** `requireUser()` + **owner only** (global `ADMIN` is *not* granted implicit collection deletion unless they are the owner; consistent with the matrix "Manage collection membership → Owner only"). `FORBIDDEN` otherwise.
- **Prisma mutation:** `prisma.collection.delete({ where: { id } })`. Cascades `Membership` rows and sets `Snippet.collectionId` to `null` (`onDelete: SetNull`); snippets are **not** deleted (FR-24, `DM-6`).
- **Output `data`:** `{ collectionId: string }`.
- **Revalidate triggers:** `revalidatePath("/collections")`, `revalidatePath("/dashboard")`.
- **Error cases:** `UNAUTHENTICATED`, `VALIDATION`, `NOT_FOUND`, `FORBIDDEN` (not owner), `INTERNAL`.
- **Cross-references:** FR-24, FR-31, FR-37; [P3] §3.2; NFR-24.

### 4.3 Membership actions — `actions/collections.ts` *(updated — actual location)*

> **ponytail (updated — actual implementation):** There is **no** `actions/memberships.ts` in the final build. The `addMember` and `removeMember` actions live in `actions/collections.ts`. The `updateMemberRole` action described below is **NOT implemented** (deferred/post-MVP). All implemented membership actions require the caller to be a **collection ADMIN** (owner OR `MembershipRole.ADMIN`).

#### 4.3.1 `addMember`

- **File:** `actions/collections.ts` *(updated — actual location)*
- **Auth requirement:** Authenticated session (`requireUser`).
- **Zod input:** `membershipAddSchema` (§2.5) — `collectionId` (cuid), `userEmail` (email), `role` (`VIEWER` | `EDITOR` | `ADMIN`).
- **RBAC check:**
  - `requireUser()` (step 1).
  - Caller must be the collection **owner OR hold `MembershipRole.ADMIN`** on the collection. (Owner is treated as admin for this purpose; a non-owner `ADMIN` member also qualifies.) `FORBIDDEN` otherwise.
- **Prisma mutation:** Resolve `userEmail` → `user.id`; then `prisma.membership.create({ data: { userId, collectionId, role } })`. The `(userId, collectionId)` pair is unique (`DM-3`), so a duplicate yields `CONFLICT`.
- **Output `data`:** `{ membershipId: string }`.
- **Revalidate triggers:** `revalidatePath("/collections/" + collectionId)`, `revalidatePath("/collections")`.
- **Error cases:** `UNAUTHENTICATED`, `VALIDATION`, `NOT_FOUND` (collection missing **or** `userEmail` not found), `FORBIDDEN` (caller not collection admin/owner), `CONFLICT` (user already a member of that collection), `INTERNAL`.
- **Cross-references:** FR-26, FR-29, FR-31; [P1] §1.6; NFR-24.

#### 4.3.2 `updateMemberRole` — ⚠️ NOT IMPLEMENTED (deferred/post-MVP) *(updated — actual implementation)*

- **File:** `actions/memberships.ts` — **NOT IMPLEMENTED** in the final build. *(updated — the actual project has no `updateMemberRole` action and no `actions/memberships.ts`; changing a member's role is not yet supported.)*
- **Auth requirement:** Authenticated session (`requireUser`).
- **Zod input:** `membershipUpdateRoleSchema` (§2.5) — `collectionId` (cuid), `userId` (cuid), `role` (`VIEWER` | `EDITOR` | `ADMIN`).
- **RBAC check:** Same as `addMember` — caller must be collection **owner OR `MembershipRole.ADMIN`**. `FORBIDDEN` otherwise. (A member cannot change their own role; self-promotion is denied.)
- **Prisma mutation:** `prisma.membership.update({ where: { userId_collectionId: { userId, collectionId } }, data: { role } })`.
- **Output `data`:** `{ membershipId: string }`.
- **Revalidate triggers:** `revalidatePath("/collections/" + collectionId)`.
- **Error cases:** `UNAUTHENTICATED`, `VALIDATION`, `NOT_FOUND` (collection or membership missing), `FORBIDDEN` (caller not collection admin/owner), `INTERNAL`.
- **Cross-references:** FR-26, FR-29, FR-31; [P1] §1.6; NFR-24.

#### 4.3.3 `removeMember`

- **File:** `actions/collections.ts` *(updated — actual location)*
- **Auth requirement:** Authenticated session (`requireUser`).
- **Zod input:** `membershipRemoveSchema` (§2.5) — `collectionId` (cuid), `userId` (cuid).
- **RBAC check:**
  - Allowed if caller is the collection **owner OR `MembershipRole.ADMIN`**, **OR** if `userId === user.id` (self-removal — a member may leave a collection).
  - Otherwise `FORBIDDEN`.
- **Prisma mutation:** `prisma.membership.delete({ where: { userId_collectionId: { userId, collectionId } } })`.
- **Output `data`:** `{ membershipId: string }` (echo) or `{ ok: true }`.
- **Revalidate triggers:** `revalidatePath("/collections/" + collectionId)`; if self-removal, also `revalidatePath("/collections")`.
- **Error cases:** `UNAUTHENTICATED`, `VALIDATION`, `NOT_FOUND` (membership missing), `FORBIDDEN` (neither admin/owner nor self), `INTERNAL`.
- **Cross-references:** FR-26, FR-29, FR-31; [P1] §1.6; NFR-24.

### 4.4 Tag actions — `actions/tags.ts`

#### 4.4.1 `createTag`

- **File:** `actions/tags.ts`
- **Auth requirement:** Authenticated session (`requireUser`). **Any** authenticated user may create a tag (tags are global, unique by `name`).
- **Zod input:** `tagCreateSchema` (§2.5) — `name` (string, 1–40 chars).
- **RBAC check:** `requireUser()` only.
- **Prisma mutation:** `prisma.tag.create({ data: { name } })`. `Tag.name` is unique (`DM-2`); a duplicate yields `CONFLICT`.
- **Output `data`:** `{ tagId: string, name: string }`.
- **Revalidate triggers:** `revalidatePath("/snippets")`, `revalidatePath("/dashboard")` (tag lists/badges refresh).
- **Error cases:** `UNAUTHENTICATED`, `VALIDATION`, `CONFLICT` (tag name already exists), `INTERNAL`.
- **Cross-references:** FR-14, FR-15, FR-31, FR-32; [P2] §2.5; NFR-24.

#### 4.4.2 Tag upsert behavior (managed via snippets)

Tags are **not** edited or deleted through dedicated Server Actions in the MVP. They are managed implicitly through the `tagNames` array on `createSnippet` / `updateSnippet`:

- On snippet create/update, each name in `tagNames` is resolved via `connectOrCreate` keyed on `Tag.name` ([P3] §3.2). This guarantees no duplicate `Tag` rows (`DM-2`, FR-14).
- Removing a tag from a snippet's `tagNames` disconnects the `SnippetTag` join (cascade-deletes the join row per `DM-5`); the `Tag` row itself is **not** deleted (tags are shared/reused). A future `deleteTag` action is out of MVP scope.
- `createTag` exists as an explicit action for cases where a tag must be provisioned independently of a snippet (e.g., autocomplete priming); it is optional in the MVP flow.

### 4.5 Search — `lib/search.ts` (RSC, **not** a Server Action)

- **Nature:** `searchSnippets` is a **function in the data-access layer** (`lib/search.ts`), called from an RSC, **not** a Server Action ([P2] §2.4). Documented here because it is part of the read/access-control surface.
- **Input:** `query` (string), optional filters: `language?`, `tag?` (tag name), `collectionId?` (scope to one collection).
- **Auth scoping:**
  - **Anonymous (no session):** results are scoped to `visibility: "PUBLIC"` only — i.e., snippets whose collection is `PUBLIC` (or, for snippets not in a collection, never returned to anonymous users since unowned/public snippets without a PUBLIC collection are not exposed). `PRIVATE`/`TEAM` data is never returned to anonymous callers (FR-44, NFR-24, [P2] §2.4 note).
  - **Authenticated:** results include `PUBLIC` collections **plus** the caller's own snippets (`ownerId === user.id`) **plus** snippets in collections where the user holds a `Membership` (any role).
- **Implementation:** Postgres `ILIKE` via Prisma `contains` + `mode: "insensitive"` on `Snippet.title`, `Snippet.code`, and related `Tag.name`, backed by `pg_trgm` GIN indexes (FR-17, FR-18, `DM-7`). `take: 50`, `orderBy: { updatedAt: "desc" }` (FR-19). The search input updates `?q=` and the RSC re-renders — no client-side data fetch.
- **Output:** `Snippet[]` (with selected fields / tags).
- **Error cases:** `INTERNAL` only (unexpected DB error); validation of `query` is a client/UI concern, not a server error envelope.
- **Cross-references:** FR-17, FR-18, FR-19, FR-44, NFR-24; [P2] §2.4; `DM-7`.

---

## 5. Middleware Contract (`middleware.ts`)

### 5.1 What it checks

`middleware.ts` runs at the **edge** and performs a **cookie-presence check only** ([P1] §1.5, FR-27, AR-3). It does **not** query the database.

- It reads the session cookie, checking **both** transport variants:
  - `authjs.session-token` (http)
  - `__Secure-authjs.session-token` (https)
- It computes:
  - `isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))`
  - `isAdmin = ADMIN_PREFIXES.some(p => pathname.startsWith(p))`
- If `(isProtected || isAdmin) && !sessionCookie` → `NextResponse.redirect("/sign-in?callbackUrl=<pathname>")`.

### 5.2 What it does NOT check

- It does **not** query the database, evaluate `user.role`, or resolve `MembershipRole` (edge cannot do this; [P1] §1.5, R-5).
- It does **not** decide visibility of a specific collection (it cannot know `visibility` without a DB lookup).
- Authoritative authz happens **later**, in RSC/Server Actions, via `auth()` + `lib/rbac.ts` (FR-28, NFR-5).

### 5.3 Routes it protects (redirects anonymous → `/sign-in`)

Per `PROTECTED_PREFIXES` and `ADMIN_PREFIXES` ([P1] §1.5, AR-4):

- `PROTECTED_PREFIXES = ["/dashboard", "/snippets/new", "/collections"]`
- `ADMIN_PREFIXES = ["/admin"]`
- `matcher = ["/dashboard/:path*", "/snippets/new", "/collections/:path*", "/admin/:path*"]`

Any request to these prefixes **without** a session cookie is redirected to `/sign-in` (preserving `callbackUrl`). The `/admin` prefix additionally requires `user.role === "ADMIN"`, enforced again in RSC/Server Actions via `requireAdmin()` (FR-28, matrix row "Access `/admin`").

### 5.4 Routes it allows through (no redirect)

- **PUBLIC collection read routes** — e.g., `/collections/[id]` for a `PUBLIC` collection, and any dedicated public browse route. The middleware SHALL NOT redirect anonymous users away from these; the RSC then performs the authoritative `canViewCollection` check and redirects anonymous users only for `PRIVATE`/`TEAM` collections (FR-44, FR-46, [P1] §1.5).
- `/sign-in` and the OAuth callback (`/api/auth/...`) — required for login to function.
- Home / explore and other non-prefixed public pages.

### 5.5 Requirement mapping

| Concern | Requirement IDs |
|---------|-----------------|
| Cookie-presence-only edge check | FR-27, AR-3, AR-4, NFR-5 |
| Anonymous redirected from protected routes | FR-6, FR-44, FR-45, FR-46 |
| PUBLIC collection reads allowed through | FR-44, NFR-24 |
| PRIVATE/TEAM denied to anonymous | FR-46, NFR-24 |
| Admin prefix gated again in RSC/actions | FR-28 |

---

## 6. Data Access Layer Contract

### 6.1 The Prisma client singleton

- The single Prisma client instance is exported from **`lib/prisma.ts`** ([P0] §Technical Implementation Notes). It is a global singleton to avoid connection exhaustion in serverless (R-7, NFR-11):

```ts
// lib/prisma.ts (illustrative — from [P0])
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

> **ponytail (updated — actual implementation):** Prisma 7 uses `@prisma/adapter-pg` + `pg` — the actual `lib/prisma.ts` constructs `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`. `lib/db.ts` was only a planning alias; the real file is `lib/prisma.ts`.

> **Naming note.** This contract refers to the singleton as `lib/prisma.ts` to stay consistent with all source docs ([P0], [P1], [P2], [P3]). If the project later aliases it as `lib/db.ts`, the contract is unchanged — it is the one and only Prisma client instance used by every Server Action and RSC.

- Runtime uses the **pooled** `DATABASE_URL`; `DATABASE_URL_DIRECT` is reserved for `prisma migrate` / `prisma db seed` (NFR-16, [P0] §0.4).
- Production migrations use `prisma migrate deploy` only (NFR-16, [P4] §4.6).

### 6.2 Query scoping rules (IDOR prevention)

Every query that returns user-scoped data MUST be scoped by `ownerId` or a membership join. **Never trust a client-provided `ownerId`.** The owner is always derived from the session user (`requireUser().id`), never from request input (NFR-8, [P3] §3.2, R-6 mitigation in [P0]).

| Data | Scoping rule |
|------|--------------|
| Snippets owned by user | `where: { ownerId: sessionUser.id }` |
| Snippets in a collection the user may view | join via `collection` + `canViewCollection` / `Membership` where `userId` = session user |
| PUBLIC reads (anonymous or any) | `where: { collection: { visibility: "PUBLIC" } }` (or `listPublicCollections()` / public-scoped `searchSnippets`) |
| Collections visible to user | `listVisibleCollections(userId)` → `OR [ ownerId, visibility PUBLIC, TEAM + membership ]` ([P2] §2.6) |
| Membership writes | caller verified as collection owner/`ADMIN` before `prisma.membership.create/update/delete` |

### 6.3 Visibility filter for PUBLIC reads

For any anonymous or public listing, filter by `visibility: "PUBLIC"` and **never** include `PRIVATE`/`TEAM` rows (FR-44, NFR-24, [P2] §2.6 `listPublicCollections`). The `canViewCollection(collectionId, userId?)` helper in `lib/rbac.ts` centralizes this: it returns `true` for `PUBLIC` even with no `userId`, and `false` for `PRIVATE`/`TEAM` when `userId` is absent ([P1] §1.6).

### 6.4 Transactional integrity

Where a mutation touches multiple rows (e.g., snippet create with tag `connectOrCreate`, or collection delete cascading memberships), rely on Prisma's cascading foreign-key rules (`onDelete: Cascade` / `SetNull` per `DM-4…DM-6`) and wrap multi-step writes in a transaction where appropriate so a partial failure cannot corrupt data (NFR-12).

---

## 7. Cross-References

### 7.1 Action → SRS requirement IDs

| Action | Functional / Arch / NFR refs |
|--------|------------------------------|
| `createSnippet` | FR-7, FR-8, FR-14, FR-31, FR-32, FR-37, NFR-7, NFR-24 |
| `updateSnippet` | FR-10, FR-14, FR-29, FR-31, FR-32, FR-37, NFR-7, NFR-24 |
| `deleteSnippet` | FR-11, FR-12, FR-29, FR-31, FR-37, NFR-24 |
| `loadMore` *(not implemented as a Server Action; pagination via `hooks/use-infinite-scroll.ts`)* | FR-36, NFR-19 |
| `getSnippet` (RSC) | FR-9, FR-13, FR-44, FR-46, NFR-24 |
| `createCollection` | FR-20, FR-21, FR-31, FR-32, FR-37, NFR-24 |
| `updateCollection` | FR-21, FR-22, FR-29, FR-31, FR-37, NFR-24 |
| `deleteCollection` | FR-24, FR-31, FR-37, NFR-24 |
| `addMember` | FR-26, FR-29, FR-31, NFR-24 |
| `updateMemberRole` *(not implemented)* | FR-26, FR-29, FR-31, NFR-24 |
| `removeMember` | FR-26, FR-29, FR-31, NFR-24 |
| `createTag` | FR-14, FR-15, FR-31, FR-32, NFR-24 |
| `searchSnippets` (RSC) | FR-17, FR-18, FR-19, FR-44, NFR-24 |
| Middleware | FR-6, FR-27, FR-44, FR-45, FR-46, AR-3, AR-4, NFR-5, NFR-24 |
| DAL scoping | NFR-8, NFR-11, NFR-12, DM-1…DM-8 |

### 7.2 Action → phase-doc implementation section

| Action | Phase doc section |
|--------|-------------------|
| `createSnippet` / `updateSnippet` / `deleteSnippet` | [P3] §3.2 (Server Actions for full CRUD), §3.7 |
| `loadMore` | [P3] §3.6 (Pagination), [SRS] §3.1.2 |
| `getSnippet` (RSC) | [P2] §2.3 (Shiki highlight), §2.7 |
| `createCollection` / `updateCollection` / `deleteCollection` | [P3] §3.7 (Action signature conventions); [P2] §2.6 (visibility) |
| `addMember` / `removeMember` (in `actions/collections.ts`; `updateMemberRole` not implemented) | [P1] §1.6 (`lib/rbac.ts`); [P3] §3.7 |
| `createTag` + tag upsert | [P2] §2.5 (Tagging engine); [P3] §3.2 (`connectOrCreate`) |
| `searchSnippets` (RSC) | [P2] §2.4 (Live search) |
| Middleware | [P1] §1.5 |
| DAL / `lib/prisma.ts` | [P0] §Technical Implementation Notes; [P0] §0.4 |
| Zod schemas | [P3] §3.1 (`lib/validations.ts`) |

### 7.3 Permission matrix (authoritative)

The table below is the contract's summary of the SRS §3.5.2 matrix, focused on the Server Action surface. "Owner" = resource `ownerId` equals caller; "Coll. ADMIN" = `MembershipRole.ADMIN` on the collection; "Coll. EDITOR" = `MembershipRole.EDITOR`; "Global ADMIN" = `user.role === "ADMIN"`.

| Action | Unauth | USER (owner) | USER (non-owner) | Coll. VIEWER | Coll. EDITOR | Coll. ADMIN | Global ADMIN |
|--------|:-----:|:------------:|:----------------:|:-----------:|:-----------:|:-----------:|:-----------:|
| `createSnippet` | ❌ | ✅ | ✅* | ❌ | ✅* | ✅* | ✅ |
| `updateSnippet` | ❌ | ✅ | ❌ | ❌ | ✅** | ✅** | ✅ |
| `deleteSnippet` | ❌ | ✅ | ❌ | ❌ | ❌ | ✅** | ✅ |
| `createCollection` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `updateCollection` | ❌ | ✅ | ❌ | ❌ | ✅** | ✅** | ✅ |
| `deleteCollection` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌*** | ❌*** |
| `addMember` | ❌ | ✅*** | ❌ | ❌ | ❌ | ✅*** | ❌ |
| `updateMemberRole` *(not implemented)* | ❌ | ✅*** | ❌ | ❌ | ❌ | ✅*** | ❌ |
| `removeMember` | ❌ | ✅*** | ❌ (self ✅) | ❌ (self ✅) | ❌ (self ✅) | ✅*** (self ✅) | ❌ (self ✅) |
| `createTag` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `searchSnippets` (RSC) | PUBLIC only | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

\* `createSnippet` into a collection requires the caller to be owner or collection `EDITOR`/`ADMIN` for that collection (see §4.1.1).
\*\* Collection `EDITOR`/`ADMIN` may edit snippets/collection settings; only owner / collection `ADMIN` may delete a snippet or manage membership.
\*\*\* Collection **owner** is treated as admin for membership management; a standalone `MembershipRole.ADMIN` member also qualifies. Global `ADMIN` is **not** auto-granted collection ownership/membership (matrix note, [SRS] §3.5.2).

---

## 8. Summary of Consistency Guarantees

- **Field names** match the schema exactly: `ownerId`, `collectionId`, `visibility`, `role`, `userEmail`, `userId`, `tagNames`, `image` (User, not `avatar`).
- **Enums** match exactly: `Role { USER, ADMIN }`, `Visibility { PRIVATE, PUBLIC, TEAM }`, `MembershipRole { VIEWER, EDITOR, ADMIN }`.
- **Auth** is Auth.js v5 (NextAuth.js) with GitHub + Google OAuth and the Prisma adapter, `database` session strategy ([P1] §1.3, AR-1/AR-2).
- **Middleware** is cookie-presence-only; authoritative checks are in RSC/Server Actions via `auth()` + `lib/rbac.ts` ([P1] §1.5/§1.6, FR-27/28, NFR-5).
- **Anonymous access** is read-only on `PUBLIC` collections via RSC; all mutations are auth-gated (FR-44/45/46, NFR-24).
- **Search** uses Postgres `ILIKE` + `pg_trgm` GIN indexes ([P2] §2.4, `DM-7`).
- **Tech** is Next.js 15 App Router, React 19, RSC, Server Actions, Zod, Prisma, TypeScript, pnpm ([PLAN] §3).

---

*This contract is derived solely from `IMPLEMENTATION_PLAN.md` and `docs/PHASE_0..4_*.md` / `SRS.md`. It introduces no requirements that contradict those documents and is intended as the API/Server-Action baseline for the DCodeBook MVP.*

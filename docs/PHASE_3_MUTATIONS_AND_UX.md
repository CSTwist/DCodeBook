# Phase 3 — Mutations & UX

> Part of the [DCodeBook](../IMPLEMENTATION_PLAN.md) implementation docs.
> Builds on [Phase 2 — MVP Build](./PHASE_2_MVP_BUILD.md).
> Precedes [Phase 4 — Polish & Ship](./PHASE_4_POLISH_AND_SHIP.md).

## Overview / Objective

Phase 3 turns the read-only MVP into a **fully interactive product**. It
implements all create/update/delete mutations as **Server Actions**, adds
**optimistic UI** so the interface feels instant, enforces **Zod validation**
at the server boundary, and builds a robust **error/loading/toast** feedback
system. It also introduces **pagination / infinite scroll** and proper
**cache revalidation** (`revalidatePath` / `revalidateTag`) so Server Actions
and RSC stay consistent.

This is where the bulk of the "production mastery" signal lives: secure
mutations, validated inputs, and a polished, resilient UX.

## Prerequisites

- Phase 1: `auth()`, `lib/rbac.ts` (`requireUser`, `canEditCollection`).
- Phase 2: editor pages (`/snippets/new`, `/snippets/[id]/edit`), collection
  pages, Shadcn `form`, `sonner` (toast), `button`, `input`, `textarea`,
  `select`, `badge`.
- `zod` installed (Phase 0).

## Detailed Tasks

### 3.1 — Zod validation schemas (shared)

Define schemas once and reuse in actions and (optionally) client forms.

```ts
// lib/validations.ts
import { z } from "zod";

export const snippetSchema = z.object({
  title: z.string().min(1, "Title required").max(200),
  description: z.string().max(2000).optional(),
  code: z.string().min(1, "Code required").max(50_000),
  language: z.string().min(1).max(50),
  tagNames: z.array(z.string().min(1).max(40)).max(20).optional(),
  collectionId: z.string().cuid().optional().nullable(),
});

export const collectionSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC", "TEAM"]),
});

export type SnippetInput = z.infer<typeof snippetSchema>;
```

### 3.2 — Server Actions for full CRUD

All actions are `"use server"`, authenticate via `requireUser()`, validate
with Zod, and revalidate after mutation. Anonymous (unauthenticated) requests
to any Server Action SHALL be rejected — `requireUser()` throws `UNAUTHORIZED`
(resulting in a 401/redirect). Anonymous users can ONLY read PUBLIC collections,
and that read path is an RSC page, not a Server Action, so the entire mutation
surface is fully authenticated (FR-45/NFR-24).

```ts
// actions/snippets.ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { snippetSchema } from "@/lib/validations";
import { requireUser } from "@/lib/rbac";

export async function createSnippet(formData: FormData) {
  const user = await requireUser();
  const parsed = snippetSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    code: formData.get("code"),
    language: formData.get("language") || "typescript",
    tagNames: formData.getAll("tagNames").map(String).filter(Boolean),
    collectionId: formData.get("collectionId") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }
  const { tagNames, ...data } = parsed.data;
  const snippet = await prisma.snippet.create({
    data: {
      ...data,
      ownerId: user.id,
      tags: tagNames?.length
        ? { create: tagNames.map((name) => ({
            tag: { connectOrCreate: { where: { name }, create: { name } } },
          })) }
        : undefined,
    },
  });
  revalidatePath("/snippets");
  revalidatePath("/dashboard");
  return { snippetId: snippet.id };
}

export async function updateSnippet(id: string, formData: FormData) { /* similar + ownership check */ }
export async function deleteSnippet(id: string) {
  const user = await requireUser();
  const existing = await prisma.snippet.findUnique({ where: { id } });
  if (existing?.ownerId !== user.id) throw new Error("FORBIDDEN");
  await prisma.snippet.delete({ where: { id } });
  revalidatePath("/snippets");
  revalidatePath("/dashboard");
}
```

> `connectOrCreate` on `Tag` implements the tagging engine from Phase 2 without
> duplicate tag rows.

### 3.3 — Optimistic UI with `useOptimistic` + `useTransition`

For snippet creation/listing, wrap the list in a client component that
optimistically inserts the new item before the server confirms.

```tsx
// components/snippet-list.tsx  ("use client")
"use client";
import { useOptimistic, useTransition } from "react";
import { createSnippet } from "@/actions/snippets";

export function SnippetList({ initial }: { initial: Snippet[] }) {
  const [optimistic, addOptimistic] = useOptimistic(
    initial,
    (state, newItem: Snippet) => [newItem, ...state]
  );
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      addOptimistic({ id: "temp", title: String(formData.get("title")) } as Snippet);
      await createSnippet(formData);
    });
  }
  // render optimistic list + <form action={onSubmit}>
}
```

`useTransition` gives `isPending` for disabling the submit button; `sonner`
toast reports success/failure.

### 3.4 — Error handling & toasts

- Server Actions return a typed result (`{ error }` or `{ snippetId }`); they
  do **not** throw for validation errors (throws are reserved for auth/role
  failures that should 500).
- Client forms read the returned `error` and surface field errors via Shadcn
  `form`/`label` and a `sonner` toast for global failures.

```tsx
// components/snippet-form.tsx  ("use client")
"use client";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { createSnippet } from "@/actions/snippets";

const [state, formAction] = useFormState(async (_: unknown, fd: FormData) => {
  const res = await createSnippet(fd);
  if (res.error) toast.error("Validation failed");
  else toast.success("Snippet saved");
  return res;
}, {});
```

### 3.5 — Loading & skeleton states

- Use `useFormStatus()` `pending` to disable inputs during submit.
- Keep `loading.tsx` skeletons (Phase 2) for navigation; use inline spinners
  for in-page mutations.
- `isPending` from `useTransition` drives optimistic list UI.

### 3.6 — Pagination / infinite scroll

For snippet lists beyond ~50 items, implement cursor pagination.

```ts
// lib/snippets.ts
export async function listSnippetsCursor(userId: string, cursor?: string, take = 20) {
  return prisma.snippet.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    take: take + 1, // peek one to know if more exist
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}
```

Client uses an IntersectionObserver (`useInfiniteScroll` hook) to call a
Server Action `loadMore(cursor)` and append. Alternatively, simpler
`?page=` based pagination via RSC is acceptable for MVP.

### 3.7 — Revalidation strategy

- `revalidatePath("/snippets")` and `revalidatePath("/dashboard")` after
  mutations that change listing data.
- For tag/collection pages, also `revalidatePath("/collections")` and the
  specific snippet detail path `revalidatePath("/snippets/" + id)`.
- Prefer `revalidateTag` if data is fetched via `fetch` with tags; since we
  use Prisma directly, `revalidatePath` is the primary tool.

## Technical Implementation Notes

### Action signature conventions (planning)

| Action | Auth | Validation | Revalidate |
|--------|------|------------|------------|
| `createSnippet` | `requireUser` | `snippetSchema` | `/snippets`, `/dashboard` |
| `updateSnippet` | `requireUser` + owner | `snippetSchema` | detail + lists |
| `deleteSnippet` | `requireUser` + owner | id cuid | lists |
| `createCollection` | `requireUser` | `collectionSchema` | `/collections` |
| `updateCollectionVisibility` | `canEditCollection` | enum | collection detail |
| `addMember` | `canEditCollection` | userId+role | collection detail |

### Error result type

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Record<string, string[]> | string };
```

### Env / config

No new env vars. Reuses existing.

## File / Folder Breakdown

| Path | Action | Purpose |
|------|--------|---------|
| `lib/validations.ts` | create | Zod schemas (snippet, collection). |
| `actions/snippets.ts` | create/overwrite | CRUD Server Actions. |
| `actions/collections.ts` | create | Collection + membership actions. |
| `components/snippet-form.tsx` | create | Client form + `useFormState`. |
| `components/snippet-list.tsx` | create | Optimistic list (`useOptimistic`). |
| `components/collection-form.tsx` | create | Collection editor. |
| `components/infinite-snippets.tsx` | create | Cursor pagination UI. |
| `hooks/use-infinite-scroll.ts` | create | IntersectionObserver hook. |
| Phase 2 editor pages | modify | Wire forms to actions. |

## Acceptance Criteria

- [ ] Create snippet persists to DB with tags (no duplicate `Tag` rows).
- [ ] Edit snippet updates fields; owner-only enforced.
- [ ] Delete snippet removes it and revalidates lists.
- [ ] Invalid input returns field errors; no 500 on validation failure.
- [ ] Optimistic insert appears instantly; reverts on error + toast shown.
- [ ] Submit button disabled (`useFormStatus`) during pending.
- [ ] Pagination/infinite scroll loads next page without full reload.
- [ ] `revalidatePath` reflects mutations on subsequent navigations.
- [ ] `pnpm lint` and `pnpm tsc --noEmit` pass.

## Verification / Testing

```bash
pnpm dev
# 1. Create snippet with 2 tags → DB has 1 Snippet + 2 SnippetTag + (≤2) Tag rows.
# 2. Submit empty title → field error, no row created.
# 3. Create → list shows item instantly (optimistic), then persists after reload.
# 4. Edit another user's snippet (direct URL) → FORBIDDEN / redirect.
# 5. Delete → item removed from list after revalidation.
# 6. Scroll list → next page appends (infinite scroll) or ?page works.
```

Add a lightweight test (Phase 4 CI) using `prisma` + a test DB to assert
CRUD + RBAC at the action level.

## Risks & Mitigations

- **Server Action throws vs returns.** Mitigation: return validation errors as
  data; only throw on auth/role violations.
- **Optimistic state corruption.** Mitigation: key optimistic items by a temp
  id; reconcile with real id from action result; revert on failure.
- **Stale RSC after mutation.** Mitigation: always `revalidatePath` the
  affected routes; use `revalidateTag` if cached fetches exist.
- **Tag duplication.** Mitigation: `connectOrCreate` keyed on unique `name`.
- **Large payloads.** Mitigation: Zod `code` max 50k; consider streaming for
  very large snippets.

## Dependencies & Packages

| Package | Why |
|---------|-----|
| `zod` | Server-boundary validation. |
| `sonner` | Toast notifications. |
| Shadcn `form`, `label`, `button`, `input`, `textarea`, `select` | Form UI. |
| (built-in) `react` `useOptimistic`, `useTransition`, `useFormState`, `useFormStatus` | Optimistic UX. |

## Cross-references

- Main plan: [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)
- Prior: [Phase 2 — MVP Build](./PHASE_2_MVP_BUILD.md)
- Auth/RBAC used: [Phase 1](./PHASE_1_AUTH_AND_RBAC.md)
- Schema foundation: [Phase 0](./PHASE_0_SETUP_AND_DATA_MODELING.md)
- Polish/deploy next: [Phase 4 — Polish & Ship](./PHASE_4_POLISH_AND_SHIP.md)

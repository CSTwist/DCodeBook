# Phase 2 — MVP Build

> Part of the [DCodeBook](../IMPLEMENTATION_PLAN.md) implementation docs.
> Builds on [Phase 1 — Auth & RBAC](./PHASE_1_AUTH_AND_RBAC.md).
> Precedes [Phase 3 — Mutations & UX](./PHASE_3_MUTATIONS_AND_UX.md).

> **✅ Post-Implementation Notes (July 2026):** Phase 2 is complete. Key reality vs. plan: Shadcn UI components are built on **`@base-ui/react`**, so composition uses the `render` prop (e.g., `<Button render={<Link href="..." />}>`) instead of Radix's `asChild` — there is **no `asChild` anywhere in the codebase**. `lib/highlight.ts` accepts a `dark` param (`highlight(code, lang, dark = false)`) toggling `github-dark`/`github-light`. `components/sidebar.tsx` is rendered inside `app/(app)/layout.tsx` (documented here). The actual component inventory is larger than this breakdown predicted (see Phase 3/4 breakdowns for `collection-members`, `create-collection-dialog`, `delete-snippet-button`, `ui/form`, `hooks/use-infinite-scroll`, etc.).

## Overview / Objective

Phase 2 delivers the **minimum viable product**: a usable, read-heavy
experience where an authenticated user can browse, search, tag, and group
their code snippets. The emphasis is on **React Server Components** doing the
data fetching (minimal client JS), a clean dashboard layout, a syntax-
highlighted snippet editor, live search backed by Postgres `ILIKE` + trigram
indexes (created in Phase 0), a tagging engine, and Collections with
visibility controls.

Mutations (create/edit/delete via Server Actions with optimistic UI) are
intentionally deferred to [Phase 3](./PHASE_3_MUTATIONS_AND_UX.md). In Phase 2
we build the **pages, data-fetching, and display**; the forms will call
Server Actions that we stub here and fully implement in Phase 3.

## Prerequisites

- Phase 0: schema, DB, trigram indexes, `lib/prisma.ts`.
- Phase 1: `auth()`, `lib/rbac.ts`, protected `(app)` layout, sign-in flow.
- Shadcn components installed (`card`, `input`, `textarea`, `badge`, `table`,
  `tabs`, `select`, `dialog`, `skeleton`).

## Detailed Tasks

### 2.1 — App Router structure under `app/`

```
app/
  (app)/                     # authenticated route group (Phase 1 layout)
    layout.tsx               # auth shell + sidebar
    dashboard/page.tsx       # overview: recent snippets, collections
    snippets/
      page.tsx               # list + search
      [id]/page.tsx          # snippet detail (highlighted)
      new/page.tsx           # editor (form → Phase 3 action)
      [id]/edit/page.tsx     # editor (form → Phase 3 action)
    collections/
      page.tsx               # list collections
      [id]/page.tsx          # collection detail + its snippets
  sign-in/page.tsx           # (Phase 1)
  api/auth/[...nextauth]/route.ts
```

### 2.2 — Dashboard layout (RSC)

`app/(app)/layout.tsx` is a Server Component that calls `auth()`, redirects if
absent (defense in depth with middleware), and renders a sidebar + topbar.
The sidebar links to Dashboard, Snippets, Collections. The topbar shows the
`UserMenu` (Phase 1).

```tsx
// app/(app)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1">
        <header className="flex justify-end p-4"><UserMenu user={session.user} /></header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

### 2.3 — Snippet editor with syntax highlighting — **Shiki (chosen over Prism)**

**Decision: Shiki.** Rationale: Shiki uses TextMate grammars and produces
highly accurate, themeable HTML with **zero client-side JavaScript** — it runs
server-side inside the RSC that renders a snippet, which aligns perfectly with
our RSC-first architecture. Prism requires shipping a highlighter to the
client (or a heavier rehype pipeline) and is less accurate on edge-case
languages. For a "code snippet canvas," accuracy and zero client JS win.

```ts
// lib/highlight.ts  (server-only) — updated: actual implementation
import { codeToHtml } from "shiki";

export async function highlight(code: string, lang: string, dark = false) {
  return codeToHtml(code, {
    lang: lang || "text",
    theme: dark ? "github-dark" : "github-light",
  });
}
```

```tsx
// app/(app)/snippets/[id]/page.tsx  (RSC)
import { highlight } from "@/lib/highlight";
import { prisma } from "@/lib/prisma";

export default async function SnippetPage({ params }: { params: { id: string } }) {
  const snippet = await prisma.snippet.findUniqueOrThrow({ where: { id: params.id } });
  const html = await highlight(snippet.code, snippet.language, false); // (updated) `dark` param toggles github-dark/github-light
  return (
    <article>
      <h1>{snippet.title}</h1>
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
```

> `dangerouslySetInnerHTML` is safe here because Shiki output is generated
> from our own stored code, not user-injected HTML. Still, never interpolate
> raw user HTML elsewhere.

### 2.4 — Live search via Postgres `ILIKE` + trigram indexes

Search queries `title`, `code`, and related `Tag.name`. The trigram GIN
indexes from Phase 0 make `ILIKE '%term%'` fast.

```ts
// lib/search.ts  (server)
import { prisma } from "@/lib/prisma";

export async function searchSnippets(userId: string, term: string) {
  const q = `%${term}%`;
  return prisma.snippet.findMany({
    where: {
      ownerId: userId,
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { code: { contains: term, mode: "insensitive" } },
        { tags: { some: { tag: { name: { contains: term, mode: "insensitive" } } } } },
      ],
    },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });
}
```

> Prisma's `contains` with `mode: "insensitive"` compiles to `ILIKE` on
> Postgres and uses the trigram index when the pattern is not left-anchored
> (Neon/Supabase both support `pg_trgm`). For very large datasets, Phase 4 may
> migrate to `tsvector` full-text; out of scope for MVP per the plan.

The search input is a small client component that updates a URL query param
(`?q=`), and the RSC re-renders with results (no client fetch needed). This
keeps JS minimal while feeling "live."

> **Public browse/search.** A public search/browse surface over `PUBLIC`
> collections MAY be exposed to anonymous (unauthenticated) users with no
> session required; such queries are scoped to `visibility: "PUBLIC"` and MUST
> NOT return `PRIVATE`/`TEAM` data (see FR-44/NFR-24).

```tsx
// components/search-box.tsx  ("use client")
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function SearchBox() {
  const router = useRouter();
  return (
    <Input
      placeholder="Search snippets, code, tags…"
      defaultValue={useSearchParams().get("q") ?? ""}
      onChange={(e) => router.replace(`/snippets?q=${encodeURIComponent(e.target.value)}`)}
    />
  );
}
```

### 2.5 — Tagging engine

Tags are unique `Tag` rows joined via `SnippetTag`. The editor (Phase 3) will
let users add tags; in Phase 2 we display them and support filtering by tag.

```ts
// lib/tags.ts
export async function getPopularTags(userId: string, limit = 20) {
  return prisma.tag.findMany({
    where: { snippets: { some: { snippet: { ownerId: userId } } } },
    orderBy: { snippets: { _count: "desc" } },
    take: limit,
  });
}
```

Display tags as Shadcn `Badge` components; clicking a tag navigates to
`/snippets?tag=<name>` and the list page filters accordingly.

### 2.6 — Collections with visibility

`Collection.visibility` is `PRIVATE` | `PUBLIC` | `TEAM`. The collections
page lists the user's own collections plus PUBLIC ones from others, and TEAM
ones where they hold a `Membership`.

```ts
// lib/collections.ts
export async function listVisibleCollections(userId: string) {
  return prisma.collection.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { visibility: "PUBLIC" },
        { visibility: "TEAM", memberships: { some: { userId } } },
      ],
    },
    include: { _count: { select: { snippets: true } } },
    orderBy: { updatedAt: "desc" },
  });
}
```

// Public, no-session listing of PUBLIC collections (anonymous-readable).
export async function listPublicCollections() {
  return prisma.collection.findMany({
    where: { visibility: "PUBLIC" },
    include: { _count: { select: { snippets: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

> **Anonymous (no-session) reads of PUBLIC collections are supported.** `auth()`
> may return `null` in the RSC; the page SHALL still render PUBLIC collections and
> their snippets. `listPublicCollections()` (and a public snippet search scoped to
> `visibility: "PUBLIC"`) are rendered without a session. `PRIVATE`/`TEAM`
> collections require a valid session + membership and SHALL redirect anonymous
> users to `/sign-in`. All mutation routes remain auth-gated (see Phase 3).

A `VisibilityBadge` component renders the state. Creating/editing collections
is wired to a Server Action stub in Phase 2 and fully implemented in Phase 3.

### 2.7 — Data-fetching patterns & loading states

- All list/detail pages are RSC and `await` Prisma directly (no API route).
- Use `loading.tsx` files with Shadcn `Skeleton` for Suspense fallbacks.
- Wrap slow sections in `<Suspense>` if needed (e.g., search results).

```tsx
// app/(app)/snippets/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return <div className="space-y-2">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-12 w-full" />)}</div>;
}
```

## Technical Implementation Notes

### Route → data-access mapping (planning example)

| Route | Server fetch | Notes |
|-------|--------------|-------|
| `/dashboard` | recent 10 snippets + collection count | `prisma.snippet.findMany({where:{ownerId}})` |
| `/snippets` | search/filter results | uses `searchSnippets` / tag filter |
| `/snippets/[id]` | single snippet + highlighted HTML | `highlight()` server-side |
| `/collections` | `listVisibleCollections` | visibility logic above |
| `/collections/[id]` | collection + its snippets | respects visibility + membership |

### Shadcn components used in Phase 2

`card`, `input`, `textarea`, `badge`, `table`, `tabs`, `select`, `dialog`,
`skeleton`, `dropdown-menu`, `avatar`.

### Env / config

No new env vars in Phase 2. Reuses `DATABASE_URL` and Auth config.

## File / Folder Breakdown

| Path | Action | Purpose |
|------|--------|---------|
| `app/(app)/layout.tsx` | create | Authenticated shell. |
| `app/(app)/dashboard/page.tsx` | create | Overview page. |
| `app/(app)/snippets/page.tsx` | create | List + search. |
| `app/(app)/snippets/[id]/page.tsx` | create | Detail + highlight. |
| `app/(app)/snippets/new/page.tsx` | create | Editor (stub action). |
| `app/(app)/snippets/[id]/edit/page.tsx` | create | Editor (stub action). |
| `app/(app)/collections/page.tsx` | create | Collections list. |
| `app/(app)/collections/[id]/page.tsx` | create | Collection detail. |
| `app/(app)/snippets/loading.tsx` | create | Skeleton fallback. |
| `lib/highlight.ts` | create | Shiki server highlight. |
| `lib/search.ts` | create | `ILIKE` search. |
| `lib/tags.ts` | create | Tag queries. |
| `lib/collections.ts` | create | Visibility-aware queries. |
| `components/sidebar.tsx` | create | Nav sidebar. |
| `components/search-box.tsx` | create | Client search input. |
| `components/visibility-badge.tsx` | create | Visibility indicator. |

## Acceptance Criteria

- [x] ✅ Complete (July 2026) Authenticated user reaches `/dashboard` and sees recent snippets.
- [x] ✅ Complete (July 2026) `/snippets` lists snippets; search box filters by title/code/tag live.
- [x] ✅ Complete (July 2026) Snippet detail renders syntax-highlighted code (Shiki, no client JS).
- [x] ✅ Complete (July 2026) Tags display as badges and filter the list when clicked.
- [x] ✅ Complete (July 2026) Collections page shows own + PUBLIC + TEAM (membership) collections.
- [x] ✅ Complete (July 2026) `loading.tsx` skeletons appear on navigation.
- [x] ✅ Complete (July 2026) No page requires a client-side data fetch (all RSC).
- [x] ✅ Complete (July 2026) `pnpm lint` and `pnpm typecheck` pass.

## Verification / Testing

```bash
pnpm dev
# 1. Sign in → /dashboard renders with seeded snippets.
# 2. /snippets → type in search → URL ?q= updates, list filters.
# 3. Open a snippet → code is colored (Shiki HTML present in source).
# 4. Click a tag badge → list filters to that tag.
# 5. /collections → confirm PUBLIC collection from another seed user shows.
# 6. View page source → confirm highlighted HTML is server-rendered (no JS bundle for highlighting).
```

## Risks & Mitigations

- **Search slow without index.** Mitigation: trigram GIN indexes from Phase 0;
  verify with `EXPLAIN` that `ILIKE` uses the index.
- **Shiki bundle size in server.** Mitigation: Shiki is server-only
  (`lib/highlight.ts` imported by RSC only); never import into a client
  component. Consider `shiki/bundle` lazy load if cold-start is an issue.
- **Over-fetching in RSC.** Mitigation: select only needed fields; use
  `include`/`select` deliberately; paginate (Phase 3) for large lists.
- **Visibility leak.** Mitigation: every collection query goes through
  `listVisibleCollections` / membership checks; never fetch by raw id without
  an ownership/visibility guard.

## Dependencies & Packages

| Package | Why |
|---------|-----|
| `shiki` | Server-side, accurate syntax highlighting (zero client JS). |
| Shadcn components | UI primitives for layout, lists, badges, skeletons. |
| (already) `prisma`, `next`, `react` | Data + framework. |

## Cross-references

- Main plan: [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)
- Prior: [Phase 1 — Auth & RBAC](./PHASE_1_AUTH_AND_RBAC.md)
- Next: [Phase 3 — Mutations & UX](./PHASE_3_MUTATIONS_AND_UX.md)
- Search/index foundation: [Phase 0](./PHASE_0_SETUP_AND_DATA_MODELING.md)
- Ship/a11y: [Phase 4 — Polish & Ship](./PHASE_4_POLISH_AND_SHIP.md)

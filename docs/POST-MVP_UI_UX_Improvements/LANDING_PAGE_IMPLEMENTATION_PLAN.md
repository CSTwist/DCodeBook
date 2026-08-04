# DCodeBook — SaaS-Style Landing Page Implementation Plan

> **Status:** Draft — awaiting approval. No implementation has been performed.
> **Date:** 2026-08-04
> **Owner:** Chakinzo N. Sombito
> **Related:** [UI/UX improvements plan](./UI_UX_IMPROVEMENTS.md) item P2-14 · [MVP implementation plan](../MVP/MVP_IMPLEMENTATION_PLAN.md)

---

## 1. Goal

Turn the anonymous root page (`/`) from a functional directory into a SaaS-style marketing landing page that presents DCodeBook's value proposition, demonstrates the existing stack (Next.js RSC, Tailwind v4, Shadcn/Base UI, Shiki, SEO), and funnels visitors into either browsing public content or signing in.

## 2. Non-goals (YAGNI)

- No pricing section — no paid tiers exist.
- No testimonials or social proof — invented endorsements on a portfolio project are dishonest.
- No new dependencies; no database or schema changes; no auth changes.
- No blog, docs site, changelog, or multi-page marketing site.

## 3. Current state (grounded)

- `app/page.tsx` (90 lines) renders: brand header with a "Sign in to start sharing" button, an "Explore DCodeBook" headline, and a grid of PUBLIC collections via `listPublicCollections()` (name, `_count.snippets`, owner avatar/name, `VisibilityBadge`). It is a utility page, not a pitch.
- No `app/explore/page.tsx` index exists. Public detail routes are `app/explore/[id]/page.tsx` and `app/explore/snippets/[id]/page.tsx`.
- `app/sitemap.ts` and `app/robots.ts` already restrict crawlable URLs to the public surface (home + `/explore/*`); `app/layout.tsx` already sets `metadataBase`.
- Locked anonymous rule: only PUBLIC collections and their snippets are readable without a session; anonymous users can never read PRIVATE/TEAM data or mutate.

## 4. Design

### 4.1 Routing changes

| Route | Before | After |
|---|---|---|
| `/` | Public collection grid | Marketing landing (sections below) |
| `/explore` | 404 | Public collection grid (moved from `/`; bounded by the current `take: 20` cap) |
| `/explore/[id]`, `/explore/snippets/[id]` | Unchanged | Unchanged |

### 4.2 Landing page sections (`/`)

1. **Header** — brand mark (FolderOpen + DCodeBook), "Explore snippets" link to `/explore`, "Sign in" button (Base UI `Button render={<Link ... />}`).
2. **Hero** — H1 value proposition ("Your code snippets, organized and shareable"), one-line honest subcopy, two CTAs: primary "Browse public snippets" → `/explore`, secondary "Sign in" → `/sign-in`. No fabricated metrics.
3. **Feature strip** — 4 compact items with lucide icons: OAuth sign-in (GitHub + Google); server-side Shiki syntax highlighting; tags with live search; collections with PRIVATE/PUBLIC/TEAM visibility. Pure RSC markup.
4. **Live proof** — "Featured public collections": `listPublicCollections(3)` rendered with the shared grid component below. Real data, no placeholders.
5. **Footer** — minimal: brand + one line ("Built with Next.js, Prisma, and PostgreSQL").

### 4.3 Shared grid component

Extract the card grid from the current `app/page.tsx` into `components/public-collections-grid.tsx`, receiving `collections` as a prop. Both `/` (featured, take 3) and `/explore` (default cap, take 20) reuse it. The card markup, `VisibilityBadge`, avatar initials helper, and links to `/explore/[id]` move unchanged.

### 4.4 Data

`lib/collections.ts`: `listPublicCollections()` currently hardcodes `take: 20` (line 25) and takes no parameters. Extend it with an optional `take?: number` parameter that replaces the hardcoded cap (default: 20 — current behavior). No query semantics change beyond the limit.

### 4.5 Metadata and SEO

- `app/page.tsx` exports `metadata` with title/description matching Phase 4 OG conventions.
- `app/sitemap.ts`: add the `/explore` index URL alongside `/` and the existing `/explore/*` entries.
- `robots.ts` unchanged — it already allows `/` and `/explore/`.

### 4.6 Wireframe (ASCII)

```
┌────────────────────────────────────────────────────────────┐
│ Header: [◫ DCodeBook]              Explore snippets  Sign in│
├────────────────────────────────────────────────────────────┤
│ Hero (centered)                                            │
│   H1: Your code snippets, organized and shareable.         │
│   Sub: Save, tag, and share code across collections —      │
│        private, team, or public.                           │
│   [ Browse public snippets ]   [ Sign in ]                 │
├────────────────────────────────────────────────────────────┤
│ Feature strip (4 columns)                                  │
│  [Key] OAuth sign-in  [Braces] Shiki highlighting          │
│  [Tag] Tags + live search  [Folder] Collections with roles │
├────────────────────────────────────────────────────────────┤
│ Featured public collections (3 cards)                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ Card       │ │ Card       │ │ Card       │              │
│  └────────────┘ └────────────┘ └────────────┘              │
├────────────────────────────────────────────────────────────┤
│ Footer: DCodeBook — Built with Next.js, Prisma, PostgreSQL │
└────────────────────────────────────────────────────────────┘
```

### 4.7 Design tokens

- **Layout:** `max-w-6xl mx-auto px-4 py-8` container (same as current `app/page.tsx`); section spacing `mt-12` / `mt-10`.
- **Type:** hero `text-4xl font-bold tracking-tight`; subcopy `text-lg text-muted-foreground`; feature titles `font-semibold`; feature body `text-sm text-muted-foreground`.
- **Color:** the app theme currently defines only `--background` and `--foreground` (light + `.dark` variants) in `app/globals.css`. The standard Shadcn semantic tokens (`--primary`, `--muted`, `--card`, `--popover`, `--ring`, `--input`, `--accent`, `--destructive`) are **not currently present** in the CSS, so utilities such as `bg-primary`, `bg-muted/50`, `text-muted-foreground`, and `border-input` do not resolve today. Implementation prerequisite: restore the standard Shadcn token set (or explicitly adopt Tailwind v4 palette values) so the landing sections render with their intended colors. No new custom palette.
- **Components:** `Button` (default + outline, Base UI `render={<Link />}`), `Card`, `Avatar`, `VisibilityBadge`, lucide icons (`FolderOpen`, `Key`, `Braces`, `Tag`).
- **Responsive:** feature strip `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`; featured grid `sm:grid-cols-2 lg:grid-cols-3` (as today).
- **A11y:** skip-to-content link as the first element of the page header; every link/button keyboard-focusable with visible focus; contrast from existing tokens.

### 4.8 Final copy (copy deck)

- Header link: "Explore snippets" · Header button: "Sign in"
- Hero H1: "Your code snippets, organized and shareable."
- Hero subcopy: "Save, tag, and share code across collections — private, team, or public. Highlighted with Shiki, searchable instantly."
- Primary CTA: "Browse public snippets" → `/explore`
- Secondary CTA: "Sign in" → `/sign-in`
- Feature items:
  - "OAuth sign-in" — "GitHub and Google, one click."
  - "Beautiful highlighting" — "Server-side Shiki, zero client JavaScript."
  - "Tags + live search" — "Find any snippet in seconds."
  - "Collections with roles" — "Private, team, or public, with granular access."
- Live proof heading: "Featured public collections"
- Footer: "DCodeBook — Built with Next.js, Prisma, and PostgreSQL."

## 5. Files

| Action | File |
|---|---|
| Rewrite | `app/page.tsx` (landing; keep `listPublicCollections` usage) |
| Create | `app/explore/page.tsx` (full grid index) |
| Create | `components/public-collections-grid.tsx` (shared presentational grid) |
| Modify | `lib/collections.ts` (optional `take`) |
| Modify | `app/sitemap.ts` (add `/explore`) |
| Modify | `app/globals.css` (restore Shadcn semantic tokens — prerequisite per §4.7) |
| Create | `docs/MVP/adr/ADR-007-add-marketing-landing-page.md` (decision record) |

## 6. Test cases

| ID | Test | Expected |
|---|---|---|
| TC-LP-01 | `/` logged out | Hero, feature strip, CTAs, and featured grid render without a session |
| TC-LP-02 | CTA navigation | "Browse public snippets" → `/explore`; "Sign in" → `/sign-in` |
| TC-LP-03 | `/explore` index | Public grid (bounded by the current `take: 20` cap) renders; cards link to `/explore/[id]` |
| TC-LP-04 | Data boundary | Featured grid contains only `visibility: "PUBLIC"` collections; no PRIVATE/TEAM data in HTML |
| TC-LP-05 | Empty state | No public collections → friendly empty message (current behavior preserved) |
| TC-LP-06 | Responsive | 320/375/768/desktop viewports; no horizontal overflow; grids collapse correctly |
| TC-LP-07 | Keyboard/a11y | Skip link present and functional; all links/buttons keyboard-focusable with visible focus |
| TC-LP-08 | SEO/metadata | `/` `<head>` has title, description, and OG tags; sitemap includes `/` and `/explore` |
| TC-LP-09 | Static checks | `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass |
| TC-LP-10 | Regression | `/explore/[id]` and `/explore/snippets/[id]` still resolve anonymously |

## 7. Acceptance criteria

1. `/` renders without a session: header, hero with working CTAs, feature strip, and a featured-public-collections section (real data).
2. `/explore` renders the public collection grid with the same cards, links, and bounded count (current `take: 20` cap) that `/` shows today.
3. Anonymous access rules unchanged: no PRIVATE/TEAM data anywhere; all collection queries filter `visibility: "PUBLIC"`.
4. `/` has title/description metadata; the sitemap includes `/` and `/explore`.
5. `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.

## 8. Verification

- Logged-out browser: `/` layout, CTAs, featured section; `/explore` grid; `/explore/[id]` and `/explore/snippets/[id]` still resolve.
- Inspect the rendered `<head>` on `/` (title, description, OG tags).
- Run `pnpm typecheck && pnpm lint && pnpm build`.

## 9. Out of scope

- Any implementation before approval.
- Any git commit unless separately requested.
- Content beyond the five sections in 4.2; interactive/animated effects that require new dependencies.

## 10. Approval checklist

1. Approve the section list and copy tone (honest, no fabricated stats).
2. Approve moving the public grid from `/` to `/explore`.
3. Approve adding `/explore` to the sitemap.
4. Approve the final copy in §4.8 and the wireframe/design tokens in §4.6–4.7.

---

**References:** [UI/UX improvements plan](./UI_UX_IMPROVEMENTS.md) · [MVP implementation plan](../MVP/MVP_IMPLEMENTATION_PLAN.md) · [SRS](../MVP/SRS.md) · [ADR-007](../MVP/adr/ADR-007-add-marketing-landing-page.md)

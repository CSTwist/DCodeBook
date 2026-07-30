# DCodeBook — Post-MVP UI/UX Improvements

> **Status:** Planning — not yet implemented.
> **Scope:** UI/UX improvements to apply after the MVP (Phases 0–4) ships.
> **Grounding:** Every item below cites the **current** implementation file/line so the
> gap is verifiable. Improvements are prioritized by user impact and effort.
> **Constraints:** Next.js 15 App Router / RSC / Server Actions; Shadcn UI built on
> `@base-ui/react` (uses `render` prop, **not** Radix `asChild`); Shiki for syntax
> highlighting (server-side, zero client JS); Tailwind v4; `next-themes` for dark mode;
> Prisma 7 + Neon Postgres. See `../MVP/MVP_IMPLEMENTATION_PLAN.md` for the locked stack.

---

## 1. Current UI State (baseline)

What exists today (verified by reading the source):

| Area | File | What's there |
|------|------|--------------|
| App shell | `app/(app)/layout.tsx` | Sidebar + sticky header (logo, ThemeToggle, UserMenu), skip-to-content link, Toaster |
| Navigation | `components/sidebar.tsx` | 3 links (Dashboard, Snippets, Collections), active-state highlight — **`hidden md:block`** |
| Dashboard | `app/(app)/dashboard/page.tsx` | 2 stat cards (snippet/collection counts) + recent-snippets list (5) |
| Snippets list | `app/(app)/snippets/page.tsx` | Search + tag badges, 3-col card grid, prev/next pagination, per-card delete |
| Snippet detail | `app/(app)/snippets/[id]/page.tsx` | Back btn, title, tags, collection link, Shiki code block |
| Collections list | `app/(app)/collections/page.tsx` | 3-col card grid with visibility badge + snippet count |
| Search | `components/search-box.tsx` | Single `<Input>`, `router.replace` on every keystroke |
| Snippet form | `components/snippet-form.tsx` | react-hook-form + Zod; title, description, language select, collection select, tags (comma text), code (plain textarea) |
| Sign-in | `app/sign-in/page.tsx` | Centered card with 2 OAuth buttons |
| Root | `app/page.tsx` | `redirect("/sign-in")` — no public landing |

---

## 2. Priority Tiers

- **P0 — Core UX gaps** (broken or missing fundamental flows; do first)
- **P1 — High-impact polish** (clear wins, moderate effort)
- **P2 — Power-user & delight** (differentiators, higher effort)

---

## 3. P0 — Core UX Gaps

### P0-1 · Mobile navigation is missing
- **Current:** `components/sidebar.tsx:17` — `className="hidden w-56 ... md:block"`. On viewports below `md` the sidebar disappears and there is **no navigation at all** — a mobile user cannot reach Dashboard/Snippets/Collections.
- **Improvement:** Add a mobile nav. Cheapest path: a Shadcn `Sheet` triggered by a hamburger button in the header (visible `< md`), reusing the same `links` array. Alternative: a bottom tab bar.
- **Files:** `components/sidebar.tsx` (extract `links` + export), `app/(app)/layout.tsx` (add mobile trigger in header), new `components/mobile-nav.tsx`.
- **Effort:** S · **Priority:** P0

### P0-2 · Anonymous users cannot browse PUBLIC collections
- **Current:** `app/page.tsx` redirects to `/sign-in`. The locked decision (ADR-005, SRS FR-44) says PUBLIC collections are viewable by unauthenticated users — but there is **no public route** to reach them. The feature is implemented at the data/RBAC layer but unreachable in the UI.
- **Improvement:** Add a public landing/explore page at `/` (or `/explore`) that lists PUBLIC collections + their public snippets, no session required. Keep `/dashboard` as the post-login home. Update `middleware.ts` to allow the public route through.
- **Files:** `app/page.tsx` (replace redirect), new `app/(public)/` route group or `app/explore/`, `lib/collections.ts` (`listPublicCollections` already noted in SDD), `middleware.ts`.
- **Effort:** M · **Priority:** P0
- **Note:** This is both a UX and a functional gap; it closes the loop on the m0036 decision.

### P0-3 · Code highlighting is theme-broken
- **Current:** `app/(app)/snippets/[id]/page.tsx:40` calls `highlight(snippet.code, snippet.language, false)` — the `false` is the `dark` flag, hardcoded to **light** theme. But line 71 renders it on `bg-[#0d1117]` (a dark GitHub-style background). Result: light-themed syntax tokens on a dark background → wrong/low-contrast colors.
- **Improvement:** Read the `next-themes` cookie server-side (`cookies()` in the RSC) and pass the resolved theme to `highlight()`. Drop the hardcoded `bg-[#0d1117]` in favor of theme-aware container classes (e.g. `bg-muted` / a dedicated code-block style that flips with theme).
- **Files:** `app/(app)/snippets/[id]/page.tsx`, `lib/highlight.ts` (already accepts `dark`), possibly a shared `<CodeBlock>` component.
- **Effort:** S · **Priority:** P0

### P0-4 · Search fires a server round-trip on every keystroke
- **Current:** `components/search-box.tsx:13-15` — `onChange` calls `router.replace(`/snippets?q=...`)` immediately per character. Each keystroke triggers an RSC re-render + Prisma `ILIKE` query. No debounce, no loading indicator, no clear button, no search icon.
- **Improvement:** Debounce 250–300 ms before navigating; show a search icon + a clear (×) button; show a spinner while pending. Keep it a controlled input with local state.
- **Files:** `components/search-box.tsx`.
- **Effort:** S · **Priority:** P0

---

## 4. P1 — High-Impact Polish

### P1-1 · Copy-to-clipboard on code blocks
- **Current:** Snippet detail (`snippets/[id]/page.tsx:71`) renders highlighted code with no copy button. A code-snippet app without copy is missing its core verb.
- **Improvement:** Add a "Copy" button (icon button, top-right of the code block) that writes `snippet.code` to the clipboard and shows a check toast. Pure client component wrapping the server-rendered HTML.
- **Files:** new `components/code-block.tsx` (client), `app/(app)/snippets/[id]/page.tsx`.
- **Effort:** S · **Priority:** P1

### P1-2 · Code editor is a plain textarea
- **Current:** `components/snippet-form.tsx:244` — code field is `<Textarea className="font-mono min-h-[240px]">`. No syntax highlighting, no line numbers, no Tab-key handling (Tab moves focus instead of indenting).
- **Improvement:** Two options:
  - **Lite (recommended):** Keep a textarea but add Tab-to-indent (2 spaces), Shift-Tab to outdent, and auto-pair brackets/quotes. ~40 lines, no dependency.
  - **Full:** Integrate a lightweight code editor (CodeMirror 6 via `@uiw/react-codemirror` + a language extension). Heavier; only if the lite path feels insufficient.
- **Files:** `components/snippet-form.tsx`, new `components/code-editor.tsx`.
- **Effort:** S (lite) / M (full) · **Priority:** P1
- **ponytail:** Start with the lite textarea enhancements; upgrade to CodeMirror only if users complain.

### P1-3 · Tag input is a bare comma-separated text field
- **Current:** `components/snippet-form.tsx:226-234` — tags entered as `react, typescript, ui` in a plain `<Input>`. No autocomplete from existing tags, no chips, no validation feedback per tag.
- **Improvement:** A chip-style tag input: type → see suggestions from `getPopularTags` / a `findTags` query → Enter/comma to add a chip → backspace to remove. Reuse the installed Shadcn `command` component for the suggestion popover.
- **Files:** `components/snippet-form.tsx`, new `components/tag-input.tsx`, `lib/tags.ts` (add a search helper if needed).
- **Effort:** M · **Priority:** P1

### P1-4 · No sort or filter controls on the snippets list
- **Current:** `app/(app)/snippets/page.tsx` supports only `?q=` and `?tag=`. No sort (date/title/language), no language filter, no collection filter.
- **Improvement:** Add a compact filter/sort bar: sort dropdown (Updated ↓/↑, Title A–Z, Language), language multi-select, optional collection filter. Wire to searchParams (URL-driven, shareable).
- **Files:** `app/(app)/snippets/page.tsx`, `lib/search.ts` (extend `where` + `orderBy`).
- **Effort:** M · **Priority:** P1

### P1-5 · Loading skeletons missing on most routes
- **Current:** Only `app/(app)/snippets/loading.tsx` exists. Dashboard, collections, and snippet detail have no `loading.tsx` → blank flash on navigation.
- **Improvement:** Add `loading.tsx` for dashboard, collections, and `snippets/[id]` mirroring each page's layout with Shadcn `Skeleton` components.
- **Files:** new `app/(app)/dashboard/loading.tsx`, `app/(app)/collections/loading.tsx`, `app/(app)/snippets/[id]/loading.tsx`.
- **Effort:** S · **Priority:** P1

### P1-6 · Code preview on snippet cards
- **Current:** Snippet cards (`snippets/page.tsx:127-141`) show title, language, description, tags — but no code. Users must click in to identify a snippet.
- **Improvement:** Show the first 3–4 lines of code (truncated, monospaced, muted) on each card. Cheap visual identifier.
- **Files:** `app/(app)/snippets/page.tsx` (add `code` to the `select`/`include` if not already, render a `line-clamp-3` `<pre>`).
- **Effort:** S · **Priority:** P1

---

## 5. P2 — Power-User & Delight

### P2-1 · Command palette (Cmd/Ctrl+K)
- **Current:** No global quick-action palette. The Shadcn `command` component is **already installed** (`components/ui/command.tsx`).
- **Improvement:** A Cmd+K palette: search snippets, jump to Dashboard/Snippets/Collections, create new snippet, toggle theme. Driven by a client dialog + a small action registry.
- **Files:** new `components/command-palette.tsx`, `app/(app)/layout.tsx` (mount + global keydown listener).
- **Effort:** M · **Priority:** P2

### P2-2 · Keyboard shortcuts
- **Current:** None.
- **Improvement:** `/` focuses search, `n` opens new snippet, `g d` / `g s` / `g c` jump to dashboard/snippets/collections, `t` toggles theme. Show a `?` help overlay listing shortcuts.
- **Files:** new `hooks/use-keyboard-shortcuts.ts`, `app/(app)/layout.tsx`.
- **Effort:** S · **Priority:** P2

### P2-3 · Breadcrumbs
- **Current:** Snippet detail has only a back arrow (`snippets/[id]/page.tsx:45`). No path context.
- **Improvement:** Breadcrumb trail: `Snippets / <Collection?> / <Title>` on detail/edit pages; `Collections / <Name>` on collection detail.
- **Files:** new `components/breadcrumbs.tsx`, detail/edit pages.
- **Effort:** S · **Priority:** P2

### P2-4 · Dashboard enrichment
- **Current:** Dashboard (`dashboard/page.tsx`) shows 2 stat cards + 5 recent snippets.
- **Improvement:** Add: snippets-over-time sparkline/bar (last 30 days by `createdAt`), language breakdown (donut or bar), top tags (tag cloud), recently edited collections, a "Quick actions" row (New Snippet, New Collection).
- **Files:** `app/(app)/dashboard/page.tsx`, `lib/` (aggregate query helpers). A chart needs a tiny lib or pure-SVG bars (ponytail: start with CSS bars, no chart dep).
- **Effort:** M · **Priority:** P2

### P2-5 · Empty states with CTAs
- **Current:** Empty states are one line of muted text (e.g. `snippets/page.tsx:109` "No snippets yet. Create your first one!").
- **Improvement:** Add an icon/illustration + a primary CTA button (e.g. "Create your first snippet" → `/snippets/new`). Consistent across dashboard, snippets, collections.
- **Files:** new `components/empty-state.tsx`, the three list/dashboard pages.
- **Effort:** S · **Priority:** P2

### P2-6 · Sign-in page branding
- **Current:** `app/sign-in/page.tsx` is a bare card with title + 2 buttons.
- **Improvement:** Split layout: left = product pitch (headline, 3 feature bullets, a mock snippet preview); right = sign-in card. Reinforces what DCodeBook is to first-time visitors.
- **Files:** `app/sign-in/page.tsx`.
- **Effort:** S · **Priority:** P2

### P2-7 · Undo toast for destructive actions
- **Current:** `components/delete-snippet-button.tsx` deletes immediately (with a confirm).
- **Improvement:** On delete, show a toast with an "Undo" action that restores (soft-delete + delayed hard-delete, or restore from a short-lived record). Reduces accidental-loss anxiety.
- **Files:** `components/delete-snippet-button.tsx`, `actions/snippets.ts` (soft-delete + restore action).
- **Effort:** M · **Priority:** P2
- **ponytail:** Skip if soft-delete complicates the schema; a confirm dialog may suffice.

### P2-8 · Infinite scroll (alternative to pagination)
- **Current:** `app/(app)/snippets/page.tsx` uses prev/next pagination. A `hooks/use-infinite-scroll.ts` IntersectionObserver hook **already exists** but is unused on the main list.
- **Improvement:** Offer infinite scroll (or a "Load more" button) using the existing hook, with a fallback to pagination if JS is disabled. Keep URL params in sync.
- **Files:** `app/(app)/snippets/page.tsx`, `hooks/use-infinite-scroll.ts`.
- **Effort:** M · **Priority:** P2

### P2-9 · Collection detail: snippet list + add-to-collection
- **Current:** Collection detail (`collections/[id]/page.tsx`) has member management but (per the build) a thin snippet listing.
- **Improvement:** Show all snippets in the collection; add an "Add snippet to collection" flow (multi-select from the user's standalone snippets, or set `collectionId` from the snippet form).
- **Files:** `app/(app)/collections/[id]/page.tsx`, `actions/collections.ts`.
- **Effort:** M · **Priority:** P2

### P2-10 · Accessibility pass on icon-only buttons
- **Current:** Icon-only buttons (back arrow `snippets/[id]/page.tsx:45`, delete, theme toggle) rely on visual cues. Some may lack `aria-label`.
- **Improvement:** Audit every icon-only button for `aria-label` / `title`; ensure focus rings are visible; verify the skip-link target and heading order per page.
- **Files:** `components/theme-toggle.tsx`, `components/delete-snippet-button.tsx`, detail pages.
- **Effort:** S · **Priority:** P2

---

## 6. Summary Matrix

| ID | Improvement | Priority | Effort | Key files |
|----|-------------|----------|--------|-----------|
| P0-1 | Mobile navigation | P0 | S | `sidebar.tsx`, `layout.tsx` |
| P0-2 | Public explore page (anon PUBLIC browse) | P0 | M | `app/page.tsx`, new public route |
| P0-3 | Theme-aware code highlighting (fix light-on-dark bug) | P0 | S | `snippets/[id]/page.tsx`, `highlight.ts` |
| P0-4 | Debounced search + clear/loading UX | P0 | S | `search-box.tsx` |
| P1-1 | Copy-to-clipboard on code blocks | P1 | S | new `code-block.tsx` |
| P1-2 | Code editor upgrade (Tab indent / CodeMirror) | P1 | S–M | `snippet-form.tsx` |
| P1-3 | Tag input with autocomplete + chips | P1 | M | `snippet-form.tsx`, new `tag-input.tsx` |
| P1-4 | Sort & filter controls | P1 | M | `snippets/page.tsx`, `lib/search.ts` |
| P1-5 | Loading skeletons for all routes | P1 | S | new `loading.tsx` files |
| P1-6 | Code preview on snippet cards | P1 | S | `snippets/page.tsx` |
| P2-1 | Command palette (Cmd+K) | P2 | M | new `command-palette.tsx` |
| P2-2 | Keyboard shortcuts | P2 | S | new `use-keyboard-shortcuts.ts` |
| P2-3 | Breadcrumbs | P2 | S | new `breadcrumbs.tsx` |
| P2-4 | Dashboard enrichment (charts, breakdowns) | P2 | M | `dashboard/page.tsx` |
| P2-5 | Empty states with CTAs | P2 | S | new `empty-state.tsx` |
| P2-6 | Sign-in page branding | P2 | S | `sign-in/page.tsx` |
| P2-7 | Undo toast for deletes | P2 | M | `delete-snippet-button.tsx`, `actions/snippets.ts` |
| P2-8 | Infinite scroll (use existing hook) | P2 | M | `snippets/page.tsx`, `use-infinite-scroll.ts` |
| P2-9 | Collection detail: snippet list + add flow | P2 | M | `collections/[id]/page.tsx` |
| P2-10 | A11y pass on icon-only buttons | P2 | S | multiple |

---

## 7. Suggested Implementation Order

1. **P0 batch** (fix fundamentals first): P0-3 (theme bug) → P0-4 (search debounce) → P0-1 (mobile nav) → P0-2 (public explore).
2. **P1 batch** (polish the core loop): P1-1 (copy) → P1-5 (skeletons) → P1-6 (code preview) → P1-2 (editor) → P1-3 (tag input) → P1-4 (sort/filter).
3. **P2 batch** (differentiators): pick by interest; P2-1 (command palette) and P2-2 (shortcuts) pair well; P2-4 (dashboard) is a strong portfolio showcase piece.

---

## 8. Constraints & Notes for Implementation

- **Base UI, not Radix:** Composition uses the `render` prop (e.g. `<Button render={<Link href="…" />}>`), **not** `asChild`. The `components/ui/button.tsx` wrapper auto-sets `nativeButton={false}` when `render` is provided.
- **Shiki is server-side:** Highlighting happens in RSC (`lib/highlight.ts`). A client-side editor (CodeMirror) is a separate concern and is the one place client JS for highlighting is acceptable.
- **Theme in RSC:** `next-themes` stores the theme in a cookie; read it with `cookies()` from `next/headers` in server components to pass `dark` to `highlight()`.
- **Already-installed Shadcn components** (no `shadcn add` needed): `command`, `dialog`, `sheet`? *(verify `sheet` — if absent, `pnpm dlx shadcn@latest add sheet`)*, `popover`, `select`, `tabs`, `table`, `badge`, `card`, `skeleton`, `avatar`, `dropdown-menu`, `sonner`.
- **URL-driven state:** Filters/sort/search should live in searchParams (shareable, back-button friendly), consistent with the existing `?q=&tag=&page=` pattern.
- **No new deps unless noted:** Prefer Tailwind/CSS + existing components. CodeMirror (P1-2 full) and a chart lib (P2-4) are the only candidates for new dependencies — and both have ponytail lite alternatives.

---

*This document is a planning artifact. Update statuses as improvements are implemented. Cross-reference `../MVP/SRS.md` for requirement IDs and `../MVP/SDD.md` for the architecture when wiring these improvements.*
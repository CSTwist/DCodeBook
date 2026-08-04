# DCodeBook — Second Post-MVP UI/UX Improvement Plan

> **Status:** Planning only — implementation waits for explicit approval.
> **Audit date:** 2026-07-31
> **Audit baseline:** current `main` worktree at `e639bed` (`fix: add prisma generate to vercel-build script`)
> **Scope:** a fresh UI/UX, accessibility, performance, privacy, and interaction audit after the first 20 post-MVP improvements.

This document **replaces the previous plan completely**. It is intentionally grounded in the current source rather than in the historical implementation plan. No application code is proposed as already changed by this audit, and no commit is required for approval.

---

## 1. Audit result at a glance

The first post-MVP pass is present. The new audit found **25 distinct follow-up items**. One feature item was added after the audit at the owner's request — **P2-14**, a SaaS-style marketing landing page (see [Landing page implementation plan](./LANDING_PAGE_IMPLEMENTATION_PLAN.md)) — bringing the total to **26**:

| Tier | Count | Meaning |
|---|---:|---|
| P0 | 6 | Security, broken access, or core-flow defects to fix first |
| P1 | 6 | High-impact usability, mobile, reliability, or performance work |
| P2 | 14 | Accessibility, consistency, and power-user refinements |

The current local quality baseline is green:

```text
pnpm typecheck  → passes
pnpm lint       → passes
```

These checks do not prove the runtime journeys below. After implementation, the full production build and browser flows must also be exercised.

### 1.1 What was inspected

The audit read the current route tree and UI/data boundaries, including:

- `app/` layouts, public pages, authenticated pages, metadata, sitemap, and robots routes.
- `components/`, `components/ui/`, and `hooks/` for interaction, focus, responsive behavior, and Base UI composition.
- `actions/`, `lib/`, `middleware.ts`, `lib/auth.ts`, `lib/rbac.ts`, and Prisma schema/config for authorization and data-flow consequences of UI decisions.
- The prior document in this directory, specifically to exclude work that is already implemented.

### 1.2 Locked constraints

- Next.js 15 App Router with RSC for reads and Server Actions for mutations.
- Auth.js v5 database sessions, Prisma 7 adapter pattern, Neon PostgreSQL, pnpm, TypeScript strict, Tailwind v4.
- Shadcn components use `@base-ui/react`; composition uses `render`, not Radix `asChild`.
- Shiki remains server-side. Do not add a browser editor/highlighter unless the lightweight editor ceiling is demonstrably insufficient.
- `PUBLIC` collections and the snippets inside them are readable without a session.
- Anonymous users can never read `PRIVATE`/`TEAM` data or invoke mutations.
- UI visibility is never an authorization boundary. Every collection assignment, membership change, and mutation must be checked again in the Server Action.
- Prefer existing primitives, CSS, RSC, and native browser behavior. Do not add a dependency merely to solve a small interaction.

---

## 2. First-pass improvements already implemented

These are **not new recommendations**. They are listed only to prevent regression or duplicate work.

| Previous item | Current evidence | Follow-up in this plan |
|---|---|---|
| Mobile navigation | `components/mobile-nav.tsx`, mounted by `app/(app)/layout.tsx:36` | Improve semantics only if required by P2 items |
| Anonymous public landing/explore | `app/page.tsx`, `app/explore/[id]/page.tsx` | P0-05 completes canonical public snippet access |
| Theme-aware highlighting | `components/theme-toggle.tsx:14-20`, snippet RSC theme read | P2-09 fixes `system`/CSS edge cases |
| Debounced search | `components/search-box.tsx:26-46` | P2-02 adds a stable focus contract and URL synchronization |
| Copy button | `components/code-block.tsx:24-35` | P1-02 makes it discoverable on touch; P2-12 handles failures |
| Lightweight code editor | `components/code-editor.tsx:15-42` | P1-06 makes multi-line selection editing safe |
| Tag chips and suggestions | `components/tag-input.tsx:23-123` | P2-04 adds combobox semantics |
| Sort/language filters | `components/snippet-filters.tsx:14-107` | P2-07/P2-08 stabilize URL state |
| Loading skeletons | dashboard, snippets, collections, and snippet-detail `loading.tsx` files | P1-04 adds error/404 recovery |
| Snippet card previews | `app/(app)/snippets/page.tsx:203-207` | P1-05 removes unnecessary full-code transfer |
| Command palette | `components/command-palette.tsx` | Keep navigation actions coherent with routes |
| Keyboard shortcuts | `hooks/use-keyboard-shortcuts.ts`, `components/keyboard-provider.tsx` | P0-01 fixes the form-input regression |
| Breadcrumbs | `components/breadcrumbs.tsx` and detail/edit pages | No duplicate breadcrumb feature |
| Dashboard metrics | `app/(app)/dashboard/page.tsx:88-202` | P2-03 reduces the tag-query waterfall |
| Empty states | `components/empty-state.tsx` | Preserve CTA behavior while adding error states |
| Branded sign-in page | `app/sign-in/page.tsx:23-95` | P0-03/P2-13 preserve deep links |
| Delete confirmation | `components/delete-snippet-button.tsx:38-72` | Collection deletion uses the same destructive pattern |
| Pagination/load-more controls | `app/(app)/snippets/page.tsx:220-276` | P2-07 fixes the conflicting state model |
| Team add/remove UI | `components/collection-members.tsx:47-81` | P2-10 adds role editing and safer member controls |
| Basic icon labels | theme, delete, and back controls have labels | P2-04/P2-05 cover remaining semantic gaps |

---

## 3. P0 — Fix before adding more polish

### P0-01 · Do not intercept `?` while a user is typing

- **Evidence:** `hooks/use-keyboard-shortcuts.ts:39-47` handles `e.key === "?"` before `isTypingTarget(e.target)`.
- **Defect:** Typing `?` in the title, description, search input, or code editor opens the help dialog and prevents the character from being inserted.
- **Plan:** Run the typing-target guard before global shortcuts. Keep `?` available only when focus is outside editable controls.
- **Acceptance criteria:** `?` inserts normally in every form control; `?` still opens shortcut help when focus is on the document body; Escape still closes the dialog.
- **Validation:** Keyboard test in title, description, code, search, and a non-editable page region.
- **Effort:** S.

### P0-02 · Allow authorized users to open shared snippets

- **Evidence:** `app/(app)/snippets/[id]/page.tsx:35-41` ends with `if (snippet.ownerId !== session?.user?.id) notFound()`.
- **Defect:** A member opening a snippet from a `TEAM` collection receives a false 404. A signed-in user also cannot open a snippet owned by someone else in a `PUBLIC` collection. The collection page already links to `/snippets/[id]` at `app/(app)/collections/[id]/page.tsx:133-159`.
- **Plan:** Retain owner access for standalone snippets. When a snippet belongs to a collection, authorize with `canViewCollection(collectionId, userId)` rather than raw ownership. Keep the anonymous full-read route separate from the authenticated app route.
- **Acceptance criteria:** Owner, `VIEWER`, `EDITOR`, and collection `ADMIN` can read according to collection visibility/membership; unrelated users receive the normal 404/forbidden experience; a standalone snippet remains owner-only.
- **Validation:** Test owner, team viewer, team editor, unrelated user, anonymous public, and anonymous private/team cases. Verify no private title/code appears in metadata or HTML.
- **Effort:** M.

### P0-03 · Preserve the requested destination through OAuth

- **Evidence:** `components/sign-in-buttons.tsx:13,21` hardcodes `callbackUrl: "/dashboard"`. `middleware.ts:24-27` creates a `callbackUrl`, but the client buttons discard it.
- **Defect:** Deep-linking to a protected page, signing in, and completing OAuth always sends the user to the dashboard.
- **Plan:** Pass the current callback URL from `app/sign-in/page.tsx` to `SignInButtons`, or read it with `useSearchParams`. Accept only safe internal paths and fall back to `/dashboard`; reject external URLs to prevent an open redirect.
- **Acceptance criteria:** A valid internal callback returns the user to the requested page after GitHub or Google sign-in. Missing, malformed, or external callbacks fall back safely to `/dashboard`.
- **Validation:** Exercise `/collections/<id>`, `/snippets/<id>`, `/snippets/new`, and a URL containing encoded query parameters.
- **Effort:** S.

### P0-04 · Add collection lifecycle controls with privacy warnings

- **Evidence:** `actions/collections.ts:35-66` implements update/delete, and `app/(app)/collections/[id]/page.tsx:69-71` computes `canEdit`, but `app/(app)/collections/[id]/page.tsx:73-101` exposes neither Edit nor Delete.
- **Defect:** Users cannot rename, change visibility, or delete collections through the UI. A future visibility editor without a warning could accidentally publish private code.
- **Plan:** Add an Edit Collection dialog for users allowed to edit and a destructive Delete Collection confirmation for the owner. When changing to `PUBLIC`, explain that the collection and its snippets become anonymously readable and potentially indexable. When changing away from `PUBLIC`, explain that public links may stop working.
- **Acceptance criteria:** Owner/editor/admin edit permissions match `canEditCollection`; only the owner sees deletion; visibility changes show the correct warning; delete requires confirmation and refreshes collection/list routes.
- **Validation:** Owner, team editor, team viewer, unrelated user, and visibility transitions (`PRIVATE → PUBLIC → TEAM`) with direct-action authorization tests.
- **Effort:** M.

### P0-05 · Establish canonical anonymous public routes and full snippet reading

- **Evidence:** `app/sitemap.ts:20-27` advertises `/collections/<id>` and `/snippets/<id>` even though the `(app)` layout at `app/(app)/layout.tsx:18-20` requires a session. Anonymous UI currently exists at `app/explore/[id]/page.tsx`, but it truncates code at `app/explore/[id]/page.tsx:63-67` and offers no full snippet route.
- **Defect:** Search engines and anonymous users are pointed at protected or owner-only URLs. PUBLIC snippets are only shown as 500-character previews, so the locked anonymous-read requirement is incomplete.
- **Plan:** Keep `/explore/[id]` as the canonical public collection URL and add a dedicated public snippet route such as `/explore/snippets/[id]` (or an equivalent public route group). Gate every public query with `collection.visibility = PUBLIC`; do not expose standalone snippets. Reuse a shared presentational snippet viewer so public and authenticated views do not drift. Update `sitemap.ts` to emit only canonical public URLs and review `robots.ts` so protected routes are not advertised.
- **Acceptance criteria:** Anonymous users can open a public collection, open each public snippet, read full code, copy it, and never see private/team/standalone data. Authenticated routes still enforce their own RBAC. Sitemap URLs resolve without a session and contain no protected paths.
- **Validation:** Crawl the sitemap in a logged-out browser, test guessed private/team IDs, inspect response HTML/metadata, and verify public-to-private visibility changes invalidate or remove public URLs.
- **Effort:** L.
- **Dependency:** Agree on the canonical public snippet URL before implementation.

### P0-06 · Enforce collection authorization inside snippet mutations

- **Evidence:** `actions/snippets.ts:27-53` and `actions/snippets.ts:56-83` accept a `collectionId` and write it without checking collection ownership or membership. The form only filters options in `app/(app)/snippets/new/page.tsx:15-19` and the edit page.
- **Defect:** A crafted Server Action request can attach a user's snippet to another user's collection, bypassing the UI filter and potentially injecting data into a private/team collection.
- **Plan:** For a non-null `collectionId`, require collection owner or `EDITOR`/`ADMIN` permission via `canEditCollection`. Return `FORBIDDEN`/`NOT_FOUND` consistently. The UI query and the action must share the same authorization rule.
- **Acceptance criteria:** Authorized collection assignment works; unauthorized or nonexistent collection IDs are rejected; clearing the collection remains allowed; no UI-only check is relied upon.
- **Validation:** Submit crafted `FormData` for another user's private/team/public collection as owner, viewer, editor, and unrelated user. Add a regression test to the Server Action suite.
- **Effort:** S.
- **Security note:** This is a server authorization fix even though the visible symptom is a collection-selector UX problem.

---

## 4. P1 — High-impact usability and reliability

### P1-01 · Show authorized TEAM collections in snippet forms

- **Evidence:** `app/(app)/snippets/new/page.tsx:15-19` and `app/(app)/snippets/[id]/edit/page.tsx:23-27` query only `{ ownerId: session.user.id }`. The collection page links editors to `/snippets/new?collectionId=<id>` at `app/(app)/collections/[id]/page.tsx:114-121`.
- **Defect:** A TEAM editor/admin can click “Add Snippet” but cannot see or preselect the target collection.
- **Plan:** Query collections the user owns plus TEAM collections where the user can edit. Keep viewers out of the selector. If the requested `collectionId` is not in the authorized result, do not silently preselect it.
- **Acceptance criteria:** An editor/admin sees and can preselect the TEAM collection; a viewer cannot; the Server Action remains authoritative through P0-06.
- **Validation:** Test owner, team editor, team admin, viewer, and unrelated user.
- **Effort:** S.

### P1-02 · Make the copy action discoverable on touch screens

- **Evidence:** `components/code-block.tsx:26-33` uses `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`.
- **Defect:** A touch user has no persistent hover state and may never discover the copy control.
- **Plan:** Keep hover reveal on pointer devices, but show the control by default on touch/small viewports or provide a clearly visible code-toolbar action.
- **Acceptance criteria:** Copy is visible and tappable at mobile widths without hover; desktop hover/focus behavior remains unobtrusive; the button has a 44px-class touch target or equivalent accessible target.
- **Validation:** Test 320px/375px viewports with touch emulation and keyboard focus.
- **Effort:** S.

### P1-03 · Remove the snippets-page query waterfall

- **Evidence:** `app/(app)/snippets/page.tsx:68-75` awaits `languageGroups` before the `Promise.all` beginning at line 77.
- **Defect:** Every list/search/filter navigation pays an extra sequential Neon round trip.
- **Plan:** Move the independent language query into the same `Promise.all` as count, snippets, and tags. Preserve the current URL-driven behavior.
- **Acceptance criteria:** No behavior change in language options; independent queries start together; loading time does not regress.
- **Validation:** Instrument local query timings or inspect server traces before/after.
- **Effort:** S.

### P1-04 · Add branded authenticated error and 404 boundaries

- **Evidence:** No `app/(app)/error.tsx` or `app/(app)/not-found.tsx` exists.
- **Defect:** database failures and missing records fall through to generic Next.js experiences without an app-specific recovery path.
- **Plan:** Add a client `error.tsx` with a safe message, `reset`, and dashboard CTA; add a `not-found.tsx` with a dashboard/back CTA. Keep error details out of production UI.
- **Acceptance criteria:** An RSC error provides Try Again and navigation; missing/unauthorized records provide a coherent 404; public and authenticated boundaries do not leak private identifiers.
- **Validation:** Deliberately throw in a local-only test branch and request nonexistent/unauthorized IDs.
- **Effort:** S.

### P1-05 · Avoid transferring full code for card previews

- **Evidence:** `app/(app)/snippets/page.tsx:79-93` selects the entire `code` column, while only `snippet.code.slice(0, 200)` is rendered at lines 203-207.
- **Defect:** A page of large snippets overfetches code that is never displayed in the list.
- **Plan:** Measure the list response and choose the smallest safe solution: a persisted preview field, a parameterized database substring query, or removal of the preview if it is not worth the complexity. Do not add a raw query without parameterization and tests.
- **Acceptance criteria:** The list does not transfer full code bodies solely for a short preview; detail pages still load the full code; preview content remains escaped and visually stable.
- **Validation:** Compare query payload/timing with 50KB snippets and verify the detail page is unchanged.
- **Effort:** S–M depending on the measured solution.

### P1-06 · Make Tab indentation selection-safe

- **Evidence:** `components/code-editor.tsx:20-40` inserts two spaces at the selection start and removes the entire selected range when a selection exists.
- **Defect:** Pressing Tab with multiple lines selected can replace the selected code with two spaces; Shift+Tab only handles the current line. This is destructive editor behavior.
- **Plan:** For a multi-line selection, indent or outdent each selected line and restore a correct selection range. Keep the lightweight textarea ceiling; do not add CodeMirror yet.
- **Acceptance criteria:** Single-cursor Tab inserts two spaces; multi-line Tab indents all selected lines; Shift+Tab removes one indentation level without deleting code; undo remains coherent.
- **Validation:** Test selections spanning one, two, and many lines, including a selection ending at column zero.
- **Effort:** M.

---

## 5. P2 — Accessibility, consistency, and power-user refinements

### P2-01 · Bound public Explore rendering

- **Evidence:** `app/explore/[id]/page.tsx:49-67` loads every snippet and runs Shiki for all of them in one `Promise.all`.
- **Defect:** A large public collection can cause high server CPU, long TTFB, and an oversized HTML response.
- **Plan:** Paginate or cursor-limit public snippets, render a bounded first page, and let the full public snippet route handle one snippet at a time. Avoid client virtualization until measured necessary.
- **Acceptance criteria:** Collection page has a bounded query and a clear next action; one large collection cannot trigger unbounded highlighting; public visibility filters remain mandatory.
- **Validation:** Seed a large collection, measure TTFB/HTML size, and test anonymous pagination.
- **Effort:** M.

### P2-02 · Give search a stable focus and URL-state contract

- **Evidence:** `hooks/use-keyboard-shortcuts.ts:17-26` first searches for `#search-input`, but `components/search-box.tsx:53-57` never sets that ID. `SearchBox` initializes local state only once at lines 16-17.
- **Defect:** `/` uses a fragile placeholder fallback, and browser-back/filter navigation can leave the visible input out of sync with the URL.
- **Plan:** Add `id="search-input"`, keep the accessible label, and synchronize local value when the `q` search parameter changes. Preserve unrelated query parameters when debouncing.
- **Acceptance criteria:** `/` focuses the intended input deterministically; browser back/forward and filter changes display the URL's actual query; typing still debounces and resets pagination.
- **Validation:** Test keyboard focus, browser history, clear, filter changes, and a URL containing encoded query text.
- **Effort:** S.

### P2-03 · Remove or justify the dashboard tag lookup waterfall

- **Evidence:** `app/(app)/dashboard/page.tsx:15-47` loads metrics in parallel, then `:49-55` performs a dependent `tag.findMany` lookup.
- **Defect:** Dashboard tag rendering requires a second database phase after the first aggregate query.
- **Plan:** Prefer one relation-count query that returns tag names and owner-scoped counts. If Prisma cannot express it cleanly, keep the dependency explicit and measure it rather than pretending it can be parallelized.
- **Acceptance criteria:** Popular tag names/counts remain owner-scoped and ordered; the chosen query shape is documented and faster or no worse in measurement.
- **Validation:** Compare query count and dashboard timing with representative tag data.
- **Effort:** S–M.

### P2-04 · Give TagInput real combobox semantics

- **Evidence:** `components/tag-input.tsx:91-100` renders `PopoverTrigger` as a `<div>` around an input. The input has no `role="combobox"`, `aria-expanded`, `aria-controls`, or `aria-autocomplete`.
- **Defect:** Keyboard and screen-reader users cannot reliably understand the suggestions relationship.
- **Plan:** Use a proper input-anchored popover/combobox pattern supported by Base UI. Add stable IDs, expanded state, active option state, Escape handling, and ArrowUp/ArrowDown/Enter behavior without replacing the existing chip workflow.
- **Acceptance criteria:** Input announces itself as an autocomplete, active suggestions are announced, keyboard selection works, and removing chips remains accessible.
- **Validation:** Keyboard-only test plus NVDA/VoiceOver or equivalent accessibility inspection.
- **Effort:** M.

### P2-05 · Repair form label, invalid, and error relationships

- **Evidence:** `components/ui/form.tsx:64-83` renders labels without `htmlFor`, puts `aria-invalid` on a wrapper `<div>`, and renders messages without stable IDs. Form controls in `components/snippet-form.tsx` and `components/collection-form.tsx` therefore lack reliable programmatic relationships.
- **Plan:** Generate stable field IDs from the Controller field name, connect labels with `htmlFor`, put invalid state on the actual control, and connect error text through `aria-describedby`. Preserve Base UI-compatible composition for Select, TagInput, and CodeEditor.
- **Acceptance criteria:** Every visible form label identifies its control; invalid controls expose `aria-invalid`; error text is announced and referenced; custom controls remain keyboard usable.
- **Validation:** Inspect the DOM with an accessibility checker and complete forms with a screen reader and keyboard only.
- **Effort:** S–M.

### P2-06 · Show server validation errors at the field that failed

- **Evidence:** `components/snippet-form.tsx:122-145` and `components/collection-form.tsx:64-87` turn returned field-error objects into a generic toast.
- **Defect:** A user may know that saving failed but not which field needs correction.
- **Plan:** Normalize Server Action result types and map field errors into `form.setError`; retain a summary toast for non-field errors. Do not expose raw database/exception text.
- **Acceptance criteria:** Server-side title/code/tag/collection errors appear beside the relevant control and in a summary/live region; success and authorization errors remain clear.
- **Validation:** Submit invalid crafted `FormData` and verify field focus/error announcement for both snippet and collection forms.
- **Effort:** M.

### P2-07 · Choose one non-conflicting snippets pagination model

- **Evidence:** `app/(app)/snippets/page.tsx:32-36` combines page-based `skip` with `loadMoreCount`-based `take`; both page navigation and Load More render at lines 220-276.
- **Defect:** After loading more, navigating to the next page can overlap previously rendered records and the “Showing” range is wrong.
- **Plan:** Ponytail ceiling: use page-only pagination first and remove the competing Load More control. If true append behavior is later required, make it a separate cursor/client design using the existing hook only after the URL/state contract is specified.
- **Acceptance criteria:** Every URL maps to one deterministic range; no duplicate records appear; count text matches the displayed range; browser back/forward remains correct.
- **Validation:** Test page 1/2, filters, empty results, last page, and a previously loaded-more URL.
- **Effort:** M.

### P2-08 · Preserve and encode tag-filter URL state

- **Evidence:** `app/(app)/snippets/page.tsx:143-145` builds `href={`/snippets?tag=${t.name}`}`.
- **Defect:** Special characters can corrupt the URL, and clicking a tag discards active search, sort, language, and page state.
- **Plan:** Build tag links with `URLSearchParams`, preserve only meaningful active filters, and reset pagination when the tag changes.
- **Acceptance criteria:** Tags containing spaces, `&`, `+`, `#`, or Unicode round-trip correctly; active filters remain visible; the resulting URL is shareable.
- **Validation:** Test encoded tags with combinations of `q`, `sort`, and `language`.
- **Effort:** S.

### P2-09 · Make theme state consistent across CSS, cookies, and Shiki

- **Evidence:** `app/(app)/snippets/[id]/page.tsx:43-47` uses `(!themeCookie && true)`, forcing dark when no cookie exists. `components/theme-toggle.tsx:14-20` writes the selected theme, while `app/globals.css:15-19` uses `prefers-color-scheme` instead of the `.dark` class supplied by `next-themes`.
- **Defect:** First-visit/system-theme behavior, global colors, and server-side Shiki theme can disagree.
- **Plan:** Treat `next-themes` as the source of truth, align CSS variables with the provider's class strategy, and define an explicit behavior for `system` when an RSC must choose a Shiki theme. Do not infer “dark” from cookie absence.
- **Acceptance criteria:** Light, dark, and system modes produce matching page colors and code tokens; switching theme updates the next RSC navigation; hydration remains warning-free.
- **Validation:** Test each mode with OS light/dark preferences, reload, navigate between public/authenticated code pages, and inspect hydration console output.
- **Effort:** S–M.

### P2-10 · Complete team-member role management

- **Evidence:** `components/collection-members.tsx:133-154` displays a static role badge and provides only remove. `actions/collections.ts:69-105` has add/remove but no explicit role-update action.
- **Defect:** Owners/admins cannot clearly change an existing member's role; removal also has no confirmation or per-row pending state.
- **Plan:** Add an authorized role-update action before exposing a role Select. Add confirmation for removal, prevent invalid owner/self cases according to the RBAC decision, and label the email/role controls.
- **Acceptance criteria:** Only permitted collection managers can change roles/remove members; the UI reflects pending state per member; role changes affect access immediately after refresh.
- **Validation:** Owner/admin/editor/viewer matrix, role transitions, removal cancellation, and direct-action authorization tests.
- **Effort:** M.

### P2-11 · Make “Standalone” a real collection option

- **Evidence:** `components/snippet-form.tsx:204-228` renders collection options but no selectable “None (Standalone)” item, despite the placeholder at lines 213-215.
- **Defect:** Once assigned, a snippet cannot be moved back to no collection through the form.
- **Plan:** Add a clear standalone option. If Base UI Select disallows an empty item value, use a documented non-empty sentinel and translate it to `null` before submission.
- **Acceptance criteria:** New and edit forms can assign, change, and clear a collection; the server receives `null` for standalone; unauthorized collection IDs remain rejected by P0-06.
- **Validation:** Create with none, assign, move between collections, clear, reload, and verify database state.
- **Effort:** S.

### P2-12 · Handle clipboard permission and insecure-context failures

- **Evidence:** `components/code-block.tsx:17-22` awaits `navigator.clipboard.writeText(code)` without `try/catch`.
- **Defect:** Denied permissions or unsupported/insecure contexts create an unhandled rejection and no useful user feedback.
- **Plan:** Catch failures, show an actionable error toast, and keep the control usable. A fallback API is optional and should be added only if the supported browser matrix requires it.
- **Acceptance criteria:** Success shows copied state; failure shows a non-technical message; no unhandled rejection reaches the console.
- **Validation:** Mock rejected clipboard permissions and test production HTTPS plus an unsupported context.
- **Effort:** S.

### P2-13 · Preserve callback URLs in the authenticated layout fallback

- **Evidence:** `app/(app)/layout.tsx:18-20` redirects to `/sign-in` without a callback URL. Middleware only matches `/dashboard`, `/snippets/new`, `/collections/:path*`, and `/admin/:path*` at `middleware.ts:33-39`, so `/snippets` and `/snippets/[id]` can reach the layout fallback.
- **Defect:** Even after P0-03 fixes the buttons, routes that bypass middleware can still lose their requested destination.
- **Plan:** Make the layout redirect include the current pathname/query as a safe internal callback, or expand middleware coverage consistently. Implement this with P0-03 as one end-to-end auth-return change, but keep the two surfaces separately tested.
- **Acceptance criteria:** Every authenticated route preserves the intended destination or safely falls back; no external callback is accepted.
- **Validation:** Request `/snippets`, `/snippets/<id>`, `/snippets/new`, and `/collections/<id>` while logged out and complete both OAuth providers.
- **Effort:** S.

### P2-14 · Add a SaaS-style marketing landing page at `/` *(added post-audit, awaiting approval)*

- **Evidence:** `app/page.tsx` (90 lines) is currently a functional directory: brand header with a sign-in button, an "Explore DCodeBook" headline, and a grid of public collections. No `/explore` index exists; the grid lives only at `/`.
- **Defect (product gap):** The root page shows content but does not present the product. For anonymous visitors and recruiters evaluating the portfolio, a value-prop landing page converts better and demonstrates the same stack (RSC, Tailwind, Shadcn/Base UI, SEO). This item was added at the owner's request after the audit.
- **Plan:** Replace `/` with a marketing landing (header, hero with honest value-prop copy and CTAs, a feature strip, a "featured public collections" live proof section, footer) and move the current public-collections grid to a new `app/explore/page.tsx` index using a shared grid component. Optional `take` parameter on `listPublicCollections` for the featured preview. No pricing, no testimonials, no new dependencies, no schema/auth changes.
- **Acceptance criteria:** `/` renders without a session with hero, features, working CTAs to `/explore` and `/sign-in`, and a featured-public-collections section; `/explore` renders the full grid exactly as `/` does today; metadata/OG tags present on `/`; sitemap includes `/` and `/explore`; anonymous access rules unchanged.
- **Validation:** Logged-out browser on `/` and `/explore`; inspect rendered `<head>`; run `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- **Effort:** S–M.
- **Dependency:** Full implementation detail in [Landing page implementation plan](./LANDING_PAGE_IMPLEMENTATION_PLAN.md). Approval required before implementation.

---

## 6. Cross-cutting implementation rules

### 6.1 Public routing contract

The minimal route contract proposed for approval is:

| Route | Session | Data allowed |
|---|---|---|
| `/` | No | Marketing landing (hero, features, CTAs); collection index moved to `/explore` |
| `/explore/[id]` | No | One `PUBLIC` collection and bounded public previews |
| `/explore/snippets/[id]` | No | One snippet whose collection is `PUBLIC` |
| `/dashboard`, `/snippets`, `/collections` | Yes | Authenticated user/member scope |
| `/snippets/[id]`, `/collections/[id]` | Yes | Owner/member/public according to `lib/rbac.ts` |

If a different public URL is preferred, approve it before P0-05. Do not leave both public and protected URLs in the sitemap without a clear canonical policy.

### 6.2 Shared presentation, separate data boundaries

- Keep authorization/data fetching in RSC or Server Actions.
- Extract a shared presentational snippet viewer only if it prevents the public and authenticated pages from diverging.
- Do not pass private/team query results into a client component merely to reuse markup.
- Keep public queries explicitly filtered by `visibility: "PUBLIC"` at the database query boundary.

### 6.3 URL-driven list state

Search, tag, language, sort, and the selected pagination model should be shareable, back-button friendly, encoded with `URLSearchParams`, and reset pagination when a filter changes. Client state may provide immediate input feedback but must reconcile with the URL.

### 6.4 Accessibility baseline

- Every control has an accessible name and a visible focus state.
- Labels, invalid state, and error text are programmatically connected.
- Dialogs/sheets retain title, description, focus trapping, Escape, and return-focus behavior.
- Touch controls do not depend on hover.
- Test both keyboard-only operation and a screen reader; do not treat `aria-label` as a substitute for correct semantics.

### 6.5 Performance ceiling

- Parallelize independent queries; do not add client fetching for data already available in RSC.
- Bound list size and Shiki work before adding virtualization or a new data library.
- Measure large-code/list behavior before introducing a schema field or raw SQL preview query.
- Keep `next.config.ts` type-check bypass from becoming a reason to skip the authoritative `pnpm typecheck` gate.

---

## 7. Recommended implementation order after approval

### Wave 0 — decisions and safety

1. Approve the canonical public snippet route and whether public snippets expose full code.
2. Fix P0-06 collection assignment authorization before exposing more collection controls.
3. Fix P0-01, then implement P0-03 + P2-13 together as the complete OAuth return-flow fix.

### Wave 1 — core access and lifecycle

1. P0-02 shared snippet authorization.
2. P0-04 collection edit/delete and visibility warnings.
3. P0-05 public route, full public snippet view, sitemap, and robots policy.

### Wave 2 — high-impact UX/reliability

1. P1-01 authorized TEAM collection selection.
2. P1-02 touch copy control.
3. P1-03 query parallelization.
4. P1-04 error/404 boundaries.
5. P1-05 list payload reduction.
6. P1-06 safe multi-line editor indentation.

### Wave 3 — refinement

Batch P2 work by surface: snippets list (P2-02, P2-07, P2-08), forms (P2-04, P2-05, P2-06, P2-11), theme/clipboard (P2-09, P2-12), dashboard (P2-03), Explore (P2-01), and team management (P2-10).

### Wave 4 — landing page (P2-14)

Implement per [LANDING_PAGE_IMPLEMENTATION_PLAN.md](./LANDING_PAGE_IMPLEMENTATION_PLAN.md): marketing landing at `/`, public grid moved to `/explore`, shared grid component, metadata/sitemap updates. Includes the theme-token prerequisite (§4.7) — restore the Shadcn semantic tokens in `app/globals.css` first.

---

## 8. Verification plan

### Functional and authorization journeys

- Anonymous: browse `/`, open a public collection, open a public snippet, copy code, and verify private/team/standalone IDs do not render.
- Owner: create/edit/delete snippet; create/edit/delete collection; change visibility with warning; manage members.
- Team editor/admin: view and edit permitted collection snippets; select the collection in the snippet form; change permitted member roles only.
- Team viewer: read but cannot see mutation controls or submit mutations.
- Unrelated authenticated user: receives the intended 404/forbidden behavior without private metadata leakage.
- OAuth: GitHub and Google return to a valid internal callback URL.

### Accessibility and responsive checks

- Keyboard through every dialog, sheet, form, popover, combobox, code action, and pagination control.
- `?` and `/` behave correctly in editable and non-editable contexts.
- Screen-reader inspection for labels, errors, combobox state, dialog titles, current navigation, and live feedback.
- Viewports at 320px, 375px, 768px, and desktop; touch emulation for copy and navigation.
- Light, dark, and system theme with reload and route transitions.

### Performance and reliability checks

- Compare query timing/number for snippets and dashboard before/after P1-03/P2-03.
- Seed large public collections and large snippets; measure TTFB, HTML size, and Shiki work.
- Run an optimized production build after changes:

```text
pnpm typecheck
pnpm lint
pnpm build
```

- Run the existing test plan's authorization and anonymous-access cases; add regression cases for P0-02, P0-05, and P0-06 before declaring the work complete.

---

## 9. Explicitly out of scope for this approval

- No implementation of the 25 items has been performed by this rewrite.
- No new dependency is approved by default. CodeMirror, charting, virtualization, soft-delete, and a general client data-fetching library remain deferred until measured need.
- No redesign of the database model is assumed. A persisted code-preview field is only considered after profiling P1-05.
- No real-time collaboration, comments, notifications, native mobile app, or AI feature is added.
- No git commit is requested or made for the plan rewrite.

### Approval checklist

Before implementation begins, approve or revise:

1. The 25-item scope and priority tiers.
2. Canonical public snippet route (`/explore/snippets/[id]` or an alternative).
3. Full anonymous reading of snippets in `PUBLIC` collections.
4. Page-only pagination first versus a later cursor-based Load More design.
5. Visibility warning language and collection manager permissions.
6. Landing page scope and routing per [LANDING_PAGE_IMPLEMENTATION_PLAN.md](./LANDING_PAGE_IMPLEMENTATION_PLAN.md) (P2-14).

After approval, implementation can proceed wave-by-wave with a review and validation checkpoint after each wave.

---

**References:** [MVP implementation plan](../MVP/MVP_IMPLEMENTATION_PLAN.md) · [SRS](../MVP/SRS.md) · [SDD](../MVP/SDD.md) · [API contract](../MVP/API_CONTRACT.md) · [test plan](../MVP/TEST_PLAN.md) · [threat model](../MVP/THREAT_MODEL.md)

# Phase 4 — Polish & Ship

> Part of the [DCodeBook](./MVP_IMPLEMENTATION_PLAN.md) implementation docs.
> Builds on [Phase 3 — Mutations & UX](./PHASE_3_MUTATIONS_AND_UX.md).
> Final phase before public launch.

> **✅ Post-Implementation Notes (July 2026):** Phase 4 is complete. Key reality vs. plan: `app/page.tsx` is a simple redirect to `/sign-in` (not the Next.js boilerplate). `package.json` defines `typecheck` (`tsc --noEmit`) and `vercel-build` (`prisma migrate deploy && next build`) scripts and uses pnpm. CI (`.github/workflows/ci.yml`) runs `pnpm prisma generate` → `pnpm lint` → `pnpm typecheck` (not `pnpm tsc --noEmit` directly). Shadcn UI is built on `@base-ui/react` (not Radix UI). `./RETRO.md` was written.

## Overview / Objective

Phase 4 is the **hardening and launch** phase. The product is functionally
complete after Phase 3; Phase 4 makes it **accessible, fast, discoverable,
and deployed**. Concretely:

- Run an **accessibility (a11y) audit** — ARIA roles, keyboard navigation,
  focus management, color contrast.
- Hit **Core Web Vitals / Lighthouse** targets (perf, a11y, SEO, best
  practices).
- Add **OpenGraph + dynamic metadata** for rich link previews and SEO.
- Implement **dark mode** (the Shiki theme and Tailwind `dark:` classes).
- Configure **production environment** and **deploy to Vercel + managed
  Postgres** (Neon).
- Optionally add **CI/CD** (lint + typecheck + tests on PR).
- Write the **retrospective** (what went well, what to improve).

## Prerequisites

- Phases 0–3 complete: working auth, MVP, mutations, optimistic UX.
- All Server Actions, RSC pages, and Shadcn components in place.
- A production domain and a Neon (or Supabase) production database.

## Detailed Tasks

### 4.1 — Accessibility audit

- Use `@axe-core/react` (dev only) or the Lighthouse a11y audit to catch
  violations during development.
- Ensure every interactive element is keyboard reachable; visible focus
  rings via Tailwind `focus-visible:ring`.
- Add `aria-label` to icon-only buttons (e.g., delete, copy).
- Manage focus on route changes and dialog open/close (Shadcn `Dialog`
  handles this; verify).
- Confirm color contrast ≥ 4.5:1 for text; check both light and dark themes.
- Add a skip-to-content link in the `(app)` layout.

```tsx
// app/(app)/layout.tsx addition
<a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>
<main id="main">{children}</main>
```

### 4.2 — Core Web Vitals & Lighthouse

Targets (mobile):
- **LCP** < 2.5s — keep RSC payloads lean; avoid large client bundles.
- **INP** < 200ms — keep Server Actions fast; avoid blocking the main thread.
- **CLS** < 0.1 — reserve space for images/code blocks (Shiki output has
  stable height; set `min-h` on skeletons to avoid shift).
- **Lighthouse a11y / SEO / Best Practices** ≥ 90.

Optimizations:
- Use `next/font` (already default) to avoid layout shift and self-host.
- Ensure Shiki highlighting is server-side (no client JS) — already done.
- Add `loading.tsx` skeletons with fixed dimensions to prevent CLS.
- Enable Next.js caching for static bits; use `revalidatePath` for dynamic.

### 4.3 — OpenGraph & dynamic metadata

Add per-page `generateMetadata` for SEO and social previews.

```tsx
// app/(app)/snippets/[id]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const snippet = await prisma.snippet.findUnique({ where: { id: params.id } });
  if (!snippet) return { title: "Snippet not found · DCodeBook" };
  return {
    title: `${snippet.title} · DCodeBook`,
    description: snippet.description ?? "A code snippet on DCodeBook",
    openGraph: {
      title: snippet.title,
      description: snippet.description ?? undefined,
      type: "article",
    },
    twitter: { card: "summary_large_image" },
  };
}
```

> **Public collection pages need OG metadata too.** Because `PUBLIC` collections
> are viewable by anonymous (unauthenticated) users (decided access behavior),
> their detail pages (`/collections/[id]` for `PUBLIC` collections) are
> public-facing and SHOULD include `generateMetadata` with OpenGraph/Twitter
> cards so shared links render rich previews. Apply the same metadata pattern
> used above for snippet detail to PUBLIC collection pages.

Add a root `metadata` in `app/layout.tsx` (site name, default OG image) and a
`app/opengraph-image.tsx` (dynamic OG image via `next/og` `ImageResponse`)
for branded link previews.

### 4.4 — Dark mode

- Shadcn already ships CSS variables for light/dark; add `next-themes` for
  toggle + no-flash.
- Sync the Shiki theme with the active theme: detect theme in the RSC and
  pass `github-dark` vs `github-light` to `highlight()`.

```ts
// lib/highlight.ts (extend)
export async function highlight(code: string, lang: string, dark: boolean) {
  return codeToHtml(code, { lang: lang || "text", theme: dark ? "github-dark" : "github-light" });
}
```

```tsx
// theme provider (client)
"use client";
import { ThemeProvider } from "next-themes";
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="system" enableSystem>{children}</ThemeProvider>;
}
```

Add a theme toggle button in the topbar (`components/theme-toggle.tsx`).

### 4.5 — SEO extras

- `app/robots.ts` and `app/sitemap.ts` for crawlability.
- Semantic HTML (`<main>`, `<nav>`, `<article>`, headings order).
- `lang="en"` on `<html>`; set via root layout.

### 4.6 — Production environment & deploy (Vercel + Neon)

1. Create a **production** Neon project (or branch) separate from dev.
2. In Vercel: import the repo, set Framework = Next.js (auto-detected).
3. Add env vars in Vercel (mirror `.env.example`):
   - `DATABASE_URL` (pooled, production), `DATABASE_URL_DIRECT`.
   - `AUTH_SECRET` (generate fresh), `AUTH_GITHUB_ID/SECRET`,
     `AUTH_GOOGLE_ID/SECRET` (register production callback URLs).
   - `NEXT_PUBLIC_APP_URL` = production domain.
4. Run `prisma migrate deploy` as a **build step** (not `migrate dev`):
   - Vercel: set `Build Command` to `prisma migrate deploy && next build`
     (or use a `postinstall`/`vercel-build` script).
5. Deploy; verify OAuth callbacks use the production domain.

```json
// package.json
{
  "scripts": {
    "vercel-build": "prisma migrate deploy && next build"
  }
}
```

> Use `migrate deploy` (applies existing migrations, no generation prompt) in
> CI/prod; `migrate dev` is dev-only.

> **ponytail:** `package.json` also defines a `typecheck` script (`tsc --noEmit`) used by CI (the CI step is `pnpm typecheck`, not `pnpm tsc --noEmit` directly).

### 4.7 — Optional CI/CD

GitHub Actions to run on PR:
- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm prisma generate && pnpm test` (if tests added in Phase 3)

```yaml
# .github/workflows/ci.yml — updated: actual implementation
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma generate
      - run: pnpm lint
      - run: pnpm typecheck
```

### 4.8 — Retrospective write-up

Create `./RETRO.md` (or `RETROSPECTIVE.md`) covering:
- What went well (RSC simplicity, Shiki zero-JS, Prisma DX).
- What was hard (Auth.js v5 beta churn, edge middleware limits, search
  indexing).
- Decisions made (NextAuth over Clerk, Shiki over Prism, Neon over Supabase).
- What to do next (real-time collab, full-text search, mobile app).

## Technical Implementation Notes

### Production env var table

| Var | Dev | Prod (Vercel) |
|-----|-----|---------------|
| `DATABASE_URL` | pooled dev | pooled prod (Neon) |
| `DATABASE_URL_DIRECT` | direct dev | direct prod |
| `AUTH_SECRET` | local | fresh random |
| `AUTH_GITHUB_ID/SECRET` | dev OAuth app | prod OAuth app |
| `AUTH_GOOGLE_ID/SECRET` | dev OAuth app | prod OAuth app |
| `NEXT_PUBLIC_APP_URL` | localhost | prod domain |

### Lighthouse command

```bash
npx lighthouse https://your-dcodebook.vercel.app --view --preset=desktop
```

### Dark-mode Shiki sync (illustrative)

The RSC reads the theme from a cookie/header (or defaults to system) and
passes `dark` to `highlight()`. Because `next-themes` sets the class on the
client, the server-rendered HTML must match initially to avoid flash; use the
`class` attribute strategy and a small inline script (next-themes handles
this) so the first paint matches.

## File / Folder Breakdown

| Path | Action | Purpose |
|------|--------|---------|
| `app/layout.tsx` | modify | Root metadata, `lang`, theme provider. |
| `app/page.tsx` | create (updated — actual implementation) | Simple redirect to `/sign-in` (replaces Next.js boilerplate). |
| `app/(app)/layout.tsx` | modify | Skip link, `#main`, renders `Sidebar`. |
| `app/(app)/snippets/[id]/page.tsx` | modify | `generateMetadata`. |
| `app/opengraph-image.tsx` | create | Dynamic OG image. |
| `app/robots.ts`, `app/sitemap.ts` | create | SEO. |
| `lib/highlight.ts` | modify | Theme-aware Shiki. |
| `components/theme-toggle.tsx` | create | Dark mode toggle. |
| `components/providers.tsx` | create | `next-themes` provider. |
| `package.json` | modify | `vercel-build` script. |
| `.github/workflows/ci.yml` | create | CI lint/typecheck. |
| `./RETRO.md` | create | Retrospective. |

## Acceptance Criteria

- [x] ✅ Complete (July 2026) Lighthouse a11y ≥ 90; no critical axe violations.
- [x] ✅ Complete (July 2026) Keyboard-only navigation reaches all features; visible focus.
- [x] ✅ Complete (July 2026) Core Web Vitals in green (LCP/INP/CLS targets met).
- [x] ✅ Complete (July 2026) Every public page has correct title/OG metadata; OG image renders.
- [x] ✅ Complete (July 2026) Dark mode toggles and Shiki theme follows; no flash.
- [x] ✅ Complete (July 2026) Production deploy succeeds; `migrate deploy` runs in build.
- [x] ✅ Complete (July 2026) OAuth login works on production domain.
- [x] ✅ Complete (July 2026) (CI added) PR checks pass lint + typecheck.
- [x] ✅ Complete (July 2026) Retrospective written (`./RETRO.md`).

## Verification / Testing

```bash
# Local a11y/perf
npx lighthouse http://localhost:3000 --view
# Manual: keyboard tab through app; toggle dark mode; view source for OG tags.

# Production
vercel deploy --prod
# 1. Visit prod URL → sign in with GitHub → dashboard loads.
# 2. prisma studio (prod direct URL) → confirm tables migrated.
# 3. Lighthouse on prod URL → a11y/perf green.
```

## Risks & Mitigations

- **`migrate dev` in prod fails.** Mitigation: use `migrate deploy` in
  `vercel-build`; never run `dev` migrate against prod.
- **OAuth callback mismatch.** Mitigation: register production redirect URIs
  in both providers before deploy.
- **Dark-mode flash / Shiki mismatch.** Mitigation: next-themes
  `suppressHydrationWarning` + class strategy; server renders matching theme.
- **Connection limits in serverless.** Mitigation: pooled `DATABASE_URL`;
  Prisma singleton from Phase 0.
- **CLS from late code render.** Mitigation: skeletons with fixed height;
  Shiki output is stable.

## Dependencies & Packages

| Package | Why |
|---------|-----|
| `next-themes` | Dark mode toggle + no-flash. |
| `@axe-core/react` (dev) | In-dev a11y checks. |
| `next/og` (built-in) | Dynamic OG images. |
| (Vercel) | Hosting; Neon for DB. |

## Cross-references

- Main plan: [MVP_IMPLEMENTATION_PLAN.md](./MVP_IMPLEMENTATION_PLAN.md)
- Prior: [Phase 3 — Mutations & UX](./PHASE_3_MUTATIONS_AND_UX.md)
- Foundation: [Phase 0](./PHASE_0_SETUP_AND_DATA_MODELING.md)
- Auth: [Phase 1](./PHASE_1_AUTH_AND_RBAC.md)
- MVP: [Phase 2](./PHASE_2_MVP_BUILD.md)

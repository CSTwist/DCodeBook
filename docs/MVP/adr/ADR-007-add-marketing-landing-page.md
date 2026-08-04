# ADR-007: Add a SaaS-style marketing landing page at `/`

- **Status:** Accepted (pending implementation)
- **Date:** 2026-08-04
- **Decision Maker:** Chakinzo Sombito (project owner)
- **References:**
  - `../../POST-MVP_UI_UX_Improvements/LANDING_PAGE_IMPLEMENTATION_PLAN.md` (full implementation plan: wireframe, copy deck, test cases)
  - `../../POST-MVP_UI_UX_Improvements/UI_UX_IMPROVEMENTS.md` §5 (P2-14 — landing page item), §6.1 (public routing contract)
  - `../SRS.md` §2.3 (User Classes — unauthenticated visitor), FR-44/45/46, NFR-24 (anonymous reads PUBLIC only)
  - `../MVP_IMPLEMENTATION_PLAN.md` §1 (Vision)

## Context

The anonymous root page (`app/page.tsx`) currently renders a functional
directory: a brand header, an "Explore DCodeBook" headline, and a grid of
PUBLIC collections. It shows content but does not present the product.

DCodeBook is a portfolio showcase project; recruiters and anonymous visitors
arrive at `/` first. A SaaS-style marketing landing page (hero, value
proposition, feature highlights, live proof, CTAs) presents the product and
demonstrates the same stack (Next.js RSC, Tailwind, Shadcn/Base UI, SEO)
without changing any application logic. The anonymous public surface
(`/explore/*`, PUBLIC-only reads) is already locked by ADR-005.

## Decision

**Replace the root page with a SaaS-style marketing landing page and move the
public-collections grid to a new `/explore` index.**

- `/` becomes: header (brand, "Explore snippets", "Sign in"), hero with honest
  value-prop copy and two CTAs (`/explore`, `/sign-in`), a 4-item feature
  strip, a "Featured public collections" live-proof section
  (`listPublicCollections(3)`), and a minimal footer.
- `/explore` becomes the full public-collections index (grid moved unchanged
  from the current `/`), rendered by a shared presentational component
  (`components/public-collections-grid.tsx`).
- `lib/collections.ts` gains an optional `take` parameter on
  `listPublicCollections` for the featured preview; no query-semantics change.
- No pricing section, no testimonials/social proof, no new dependencies, no
  schema or auth changes. The anonymous rule (PUBLIC read-only) is unchanged.
- `app/page.tsx` exports title/description metadata; `app/sitemap.ts` adds the
  `/explore` index; `robots.ts` is unchanged.

## Consequences

**Positive:**
- Presents the product to anonymous visitors and recruiters instead of a bare
  directory, supporting the portfolio/showcase goal.
- Demonstrates RSC, Tailwind, Shadcn/Base UI, and SEO on the most-visited
  page with zero new dependencies.
- The public content grid stays fully anonymous-accessible at `/explore`,
  preserving the ADR-005 sharing story.

**Negative:**
- The grid's canonical URL changes from `/` to `/explore`; the sitemap and any
  previously shared `/` deep links to specific collections must be checked
  (collection cards already link to `/explore/[id]`, which is unchanged).
- One small refactor: the grid markup is extracted into a shared component;
  the landing page adds a page to maintain.

**Neutral:**
- Authenticated routes, RBAC, and the mutation surface are untouched.

## Alternatives Considered

- **Keep the functional directory at `/` (rejected):** Shows content but does
  not present the product; a poor first impression for the portfolio goal.
- **Full marketing site with blog/docs pages (rejected):** Scope creep beyond
  a portfolio need; YAGNI.
- **Separate marketing subdomain (rejected):** Unnecessary infrastructure for
  a single-page landing; adds deployment and OAuth-callback complexity.

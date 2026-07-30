# ADR-002: Use Shiki over Prism for syntax highlighting

- **Status:** Accepted
- **Date:** 2026-07-30
- **Decision Maker:** Chakinzo Sombito (project owner)
- **References:**
  - `../PHASE_2_MVP_BUILD.md` §2.3 (Snippet editor with syntax highlighting — Shiki chosen over Prism), §2.7 (Risks — Shiki server-only), §Dependencies & Packages
  - `../SRS.md` §1.2 (In scope — server-side syntax highlighting, Shiki, zero client JS), §2.2 (Product Functions — Syntax highlighting), FR-13, NFR-1, NFR-10
  - `../PHASE_4_POLISH_AND_SHIP.md` §4.2 (Core Web Vitals — Shiki server-side, no client JS), §4.4 (Dark mode — Shiki theme sync)

## Context

DCodeBook is a "code snippet canvas" — accurate, attractive syntax highlighting
of code snippets is a core product feature. The architecture is **RSC-first**:
data fetching happens in React Server Components and client-side JavaScript is
minimized to small interactive islands (NFR-1). The highlighting approach had
to fit this constraint.

Two highlighting libraries were considered:

- **Shiki** — uses TextMate grammars to produce highly accurate, themeable HTML
  on the server.
- **Prism** — a popular highlighter that, in typical Next.js usage, requires
  shipping a highlighter to the client (or a heavier rehype pipeline) to render
  highlighted code in the browser.

The decision needed to preserve the RSC-first architecture (no highlighting
JavaScript shipped to the client) while maximizing language accuracy.

## Decision

**Use Shiki, running server-side inside the RSC that renders a snippet.**

- Highlighting is performed in a server-only module (e.g., `lib/highlight.ts`
  using `codeToHtml` from `shiki`), invoked from the Server Component that
  displays the snippet.
- The output is highlighted HTML with **zero client-side JavaScript** for
  highlighting.
- The Shiki theme follows the active UI theme: `github-dark` in dark mode,
  `github-light` in light mode (synced via `next-themes` in Phase 4).

Prism was not chosen.

## Consequences

**Positive:**
- TextMate-accurate highlighting — superior fidelity on edge-case languages,
  important for a developer-focused snippet tool.
- Zero client-side JavaScript for highlighting — aligns with the RSC-first
  architecture (NFR-1) and helps Core Web Vitals (LCP/INP/CLS) by keeping the
  client bundle lean (NFR-2/3/4, Phase 4 §4.2).
- Themeable and server-rendered; the highlighted HTML is generated from our own
  stored code (not user-injected HTML), which is safe to inject (NFR-10).
- Dark-mode aware: the server can pick `github-dark` vs `github-light` to match
  the active theme with no flash (Phase 4 §4.4).

**Negative:**
- Shiki runs on the server; it must never be imported into a client component
  (enforced by keeping it in a server-only module). Cold-start cost is a minor
  concern, mitigated by lazy-loading `shiki` if needed (Phase 2 §2.7).

**Neutral:**
- The editor pages and data model are unaffected; only the rendering path
  changes.

## Alternatives Considered

- **Prism (rejected):** Requires shipping a highlighter to the client (or a
  heavier rehype pipeline) to render highlighted code in the browser. That
  breaks the RSC-first, minimal-client-JS architecture and would add to the
  client bundle, hurting the performance goals. Prism is also less accurate
  than TextMate grammars on edge-case languages. For a code-snippet product
  where accuracy and zero client JS win, Shiki was the clear choice.

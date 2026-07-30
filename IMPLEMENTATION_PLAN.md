# DCodeBook — High-Level Implementation Plan

> **Collaborative Developer Knowledge Base & Code Snippet Canvas**
> Status: 🟡 Planning — this document is the plan only. No code yet.

---

## 1. Vision

DCodeBook is a real-time full-stack knowledge base and code snippet canvas for
developers. Users capture, organize, search, and share code snippets and notes,
with role-based access for personal and team workspaces.

## 2. Goals & Non-Goals

### Goals
- Demonstrate production mastery of **Next.js 15** (App Router, RSC, Server
  Actions) + **TypeScript** + **Prisma** + **PostgreSQL**.
- Ship an end-to-end full-stack SaaS: auth, CRUD, search, RBAC, deploy.
- Prove the full path: database schema design → server-side performance → polished UX.

### Non-Goals (MVP)
- Real-time multi-user collaborative editing (live cursors) — deferred.
- Mobile native apps — responsive web only.
- AI-assisted features — out of scope for MVP.

## 3. Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, Shadcn UI |
| ORM | Prisma |
| Database | PostgreSQL (Supabase or Neon) |
| Auth | Auth.js v5 (NextAuth.js) — GitHub + Google OAuth (Clerk alternative) |
| Hosting | Vercel (app) + Supabase/Neon (DB) |
| Package manager | pnpm |

## 4. Architecture (High-Level)

- **React Server Components (RSC)** for data-fetching pages; minimal client JS.
- **Server Actions** for mutations (create/update/delete snippets) with optimistic UI.
- **Prisma ORM** as the data access layer over PostgreSQL.
- **RBAC** via Next.js middleware (cookie-presence check only — it does **NOT** block `PUBLIC` collection read routes) + authoritative checks in RSC/Server Actions via `auth()` + `lib/rbac.ts` (which still gate all mutations and `PRIVATE`/`TEAM` access).
- **Relational schema** with normalized tables and indexed lookups for search.

## 5. Data Model (entities)

- **User** — id, email, name, image, role (`USER` | `ADMIN`), oauth accounts
- **Snippet** — id, title, code, language, description, ownerId, collectionId, createdAt, updatedAt
- **Tag** — id, name (unique)
- **SnippetTag** — join (snippetId, tagId)
- **Collection** — id, name, ownerId, visibility (`PRIVATE` | `PUBLIC` | `TEAM`); `PUBLIC` = viewable by unauthenticated users, `PRIVATE`/`TEAM` = require auth + membership.
- **Membership** — (userId, collectionId, role: `MembershipRole` — VIEWER | EDITOR | ADMIN) for shared collections

## 6. MVP Feature Scope

1. OAuth sign-in (GitHub + Google)
2. Create / edit / delete snippets with syntax highlighting
3. Tagging engine + live search (title, code, tags)
4. Collections (group snippets) with visibility controls — `PUBLIC` collections are readable by **anyone, including unauthenticated (anonymous) visitors**; `PRIVATE`/`TEAM` collections remain auth-gated (require a session + membership).
5. RBAC: owner / admin / member permissions
6. Dark mode, responsive, a11y, OpenGraph metadata

## 7. Phases & Milestones

### Phase 0 — Setup & Data Modeling
- [ ] Initialize Next.js 15 + TS + Tailwind + Shadcn
- [ ] Prisma schema design (Users, Snippets, Tags, Collections, Memberships)
- [ ] Provision Postgres (Supabase/Neon), run first migration

### Phase 1 — Authentication & RBAC
- [ ] Auth.js v5 (NextAuth) / Clerk integration (GitHub + Google OAuth)
- [ ] Role model + middleware (RBAC) for protected routes
- [ ] Session handling in RSC

### Phase 2 — MVP Build
- [ ] RSC layout + dashboard
- [ ] Snippet editor (create/edit) with syntax highlighting
- [ ] Live search + tagging engine
- [ ] Collections with visibility

### Phase 3 — Mutations & UX
- [ ] Server Actions for CRUD + optimistic updates
- [ ] Form validation + error handling

### Phase 4 — Polish & Ship
- [ ] a11y audit, Core Web Vitals, OpenGraph metadata, dark mode
- [ ] Deploy to Vercel + managed Postgres (prod migrations via `prisma migrate deploy`)
- [ ] Write retro

## 8. Folder Structure (proposed)

```
DCodeBook/
  app/              # App Router: layouts, pages, RSC
  components/       # Shadcn UI + custom components
  lib/              # prisma client, auth, utils
  prisma/           # schema.prisma, migrations
  actions/          # Server Actions
  middleware.ts     # RBAC route protection
```

## 9. Risks & Open Decisions

- **RSC vs client boundaries** — keep interactivity islands small; default to server.
- **Auth provider** — Auth.js v5 (NextAuth.js) (flexible, self-hosted) vs Clerk (faster, hosted). Decide in Phase 1.
- **Search at scale** — start with Postgres `ILIKE` + indexes; defer full-text / Algolia.

## 10. Definition of Done (MVP)

- OAuth login works; RBAC enforced.
- Full snippet CRUD via Server Actions with optimistic UI.
- Search + tags + collections functional.
- Deployed live; Lighthouse a11y/perf passing; retro written.

---
*Plan only — no development started. Update this file as decisions are made.*
# DCodeBook

A real-time, full-stack knowledge base and code snippet canvas for developers — built with Next.js 15 App Router, React 19, TypeScript, Prisma ORM, and PostgreSQL.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, RSC, Server Actions) |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind CSS v4, Shadcn UI |
| ORM | Prisma 7 (driver-adapter via `@prisma/adapter-pg`) |
| Database | PostgreSQL (Neon recommended; Supabase supported) |
| Auth | Auth.js v5 (GitHub + Google OAuth) |
| Validation | Zod |
| Package Manager | pnpm |
| Hosting | Vercel + managed Postgres |

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd DCodeBook
pnpm install

# 2. Set up environment
cp .env.example .env
# Fill in DATABASE_URL, DATABASE_URL_DIRECT, and OAuth credentials

# 3. Generate Prisma client
pnpm exec prisma generate

# 4. Run migrations (requires a Postgres instance)
pnpm exec prisma migrate dev --name init

# 5. Seed demo data
pnpm exec prisma db seed

# 6. Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm tsc --noEmit` | TypeScript type-check |
| `pnpm exec prisma generate` | Regenerate Prisma client |
| `pnpm exec prisma migrate dev` | Create + apply migration |
| `pnpm exec prisma db seed` | Seed demo data |
| `pnpm exec prisma studio` | Open Prisma Studio GUI |

## Project Structure

```
DCodeBook/
├── app/                  # Next.js App Router pages & layouts
├── actions/              # Server Actions (Phase 3)
├── components/           # Shared UI components + Shadcn primitives
├── lib/                  # Shared libraries
│   ├── prisma.ts         # Prisma client singleton (pg adapter)
│   └── utils.ts          # cn() class merge helper
├── prisma/
│   ├── schema.prisma     # Data model (User, Snippet, Tag, Collection, Membership)
│   ├── seed.ts           # Demo data
│   └── migrations/       # Migration history
├── docs/                 # Planning & design documents
│   ├── SRS.md            # Software Requirements Specification
│   ├── SDD.md            # Software Design Document
│   ├── API_CONTRACT.md   # Server Action contract
│   ├── TEST_PLAN.md      # Test & QA plan
│   ├── THREAT_MODEL.md   # STRIDE threat model
│   ├── adr/              # Architecture Decision Records
│   └── PHASE_*.md        # Phase execution guides
├── prisma.config.ts      # Prisma migration config
├── middleware.ts          # Auth middleware (Phase 1)
└── .env.example          # Environment variable template
```

## Phases

| Phase | Focus | Status |
|---|---|---|
| 0 | Setup & Data Modeling | 🚧 In Progress |
| 1 | Auth & RBAC | Planned |
| 2 | MVP Build | Planned |
| 3 | Mutations & UX | Planned |
| 4 | Polish & Ship | Planned |

See [`docs/`](docs/) for full planning documentation including the SRS, design spec, test plan, threat model, and ADRs.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Pooled Postgres URL for the app runtime |
| `DATABASE_URL_DIRECT` | Yes | Direct Postgres URL for migrations |
| `AUTH_SECRET` | Phase 1 | Auth.js session secret (`npx auth secret`) |
| `AUTH_GITHUB_ID` | Phase 1 | GitHub OAuth app client ID |
| `AUTH_GITHUB_SECRET` | Phase 1 | GitHub OAuth app client secret |
| `AUTH_GOOGLE_ID` | Phase 1 | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Phase 1 | Google OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | No | App URL (defaults to `http://localhost:3000`) |

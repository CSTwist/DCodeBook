# Architecture Decision Records (ADRs)

This directory records significant architectural decisions for DCodeBook.

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./ADR-001-use-authjs-v5-over-clerk.md) | Use Auth.js v5 over Clerk | Accepted | 2026-07-30 |
| [ADR-002](./ADR-002-use-shiki-over-prism.md) | Use Shiki over Prism for syntax highlighting | Accepted | 2026-07-30 |
| [ADR-003](./ADR-003-use-neon-over-supabase.md) | Use Neon over Supabase for managed Postgres | Accepted | 2026-07-30 |
| [ADR-004](./ADR-004-promote-membership-role-to-enum.md) | Promote Membership.role to MembershipRole enum | Accepted | 2026-07-30 |
| [ADR-005](./ADR-005-allow-anonymous-public-collection-read.md) | Allow anonymous read of PUBLIC collections | Accepted | 2026-07-30 |
| [ADR-006](./ADR-006-middleware-cookie-presence-check-only.md) | Middleware cookie-presence check only | Accepted | 2026-07-30 |
| [ADR-007](./ADR-007-add-marketing-landing-page.md) | Add a SaaS-style marketing landing page at `/` | Accepted | 2026-08-04 |

## Principles

- One decision per ADR.
- ADRs are immutable once Accepted (supersede with a new ADR if reversed).
- Context → Decision → Consequences → Alternatives.
- All ADRs are derived from the locked planning documents (`../MVP_IMPLEMENTATION_PLAN.md` and `../PHASE_0..4_*.md`); they introduce no new requirements that contradict those documents.

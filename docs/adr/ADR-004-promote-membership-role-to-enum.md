# ADR-004: Promote Membership.role to MembershipRole enum

- **Status:** Accepted
- **Date:** 2026-07-30
- **Decision Maker:** Chakinzo Sombito (project owner)
- **References:**
  - `./PHASE_0_SETUP_AND_DATA_MODELING.md` §Technical Implementation Notes (schema — `MembershipRole` distinct from global `Role`), §0.5 (Prisma schema)
  - `../../IMPLEMENTATION_PLAN.md` §5 (Data Model — Membership entity with `role: MembershipRole`)
  - `../SRS.md` §1.3 (RBAC definition), §2.3 (User Classes — global ADMIN vs collection members), §3.4 (Enums: `Role`, `MembershipRole`), FR-25, FR-26, AR-5, AR-6, Appendix B (Glossary — Membership)

## Context

DCodeBook needs two independent axes of authorization:

1. A **global** role on the user (`Role`: `USER` | `ADMIN`) — used for
   app-wide admin access such as `/admin`.
2. A **per-collection** role on a membership (`Membership.role`) — used for
   shared/team collections.

The plan's original data model described `Membership` as
`(userId, collectionId, role)`. The question was what type `role` should be.
A free-form string would be error-prone and untyped; a typed enum is safer and
self-documenting. Crucially, the per-collection role must be **distinct** from
the global `Role` so the two authorization axes do not collide (a global
`ADMIN` is not automatically a member of every collection, and a collection
`ADMIN` is not a global `ADMIN` — SRS §2.3 note).

## Decision

**Promote `Membership.role` to a dedicated `MembershipRole` enum with values
`VIEWER` | `EDITOR` | `ADMIN` (default `VIEWER`).**

- This is an **additive clarification** of the data model: the `Membership`
  entity gains a typed, constrained `role` field rather than a free string.
- `MembershipRole` is intentionally separate from the global `Role`
  (`USER` | `ADMIN`) enum. The two enums coexist and represent independent
  authorization axes.
- The Prisma schema defines both enums; `Membership.role` uses
  `MembershipRole @default(VIEWER)`, and `User.role` uses `Role @default(USER)`.

## Consequences

**Positive:**
- Type-safe RBAC: `VIEWER`/`EDITOR`/`ADMIN` are compile-time-checked values,
  eliminating typos and invalid states that a free string would allow.
- Clear separation of concerns: collection-level roles (`MembershipRole`) are
  explicitly distinct from global roles (`Role`), preventing accidental
  conflation of "collection admin" with "global admin" (SRS §2.3).
- Enables precise helper logic such as `canEditCollection` (owner OR
  `EDITOR`/`ADMIN` membership) and `requireAdmin` (global `Role === ADMIN`)
  without string comparisons (AR-5, AR-6).

**Negative:**
- None of significance. The change is additive and localized to the schema; it
  does not alter existing behavior, only the representation of the role value.

**Neutral:**
- The default `VIEWER` for new memberships and `USER` for new users is
  unchanged from the plan's intent.

## Alternatives Considered

- **Keep `Membership.role` as a free-form string (rejected):** Would avoid
  defining a new enum but loses type safety, invites invalid values, and makes
  the distinction from the global `Role` less explicit in the schema. The
  typed enum is strictly better for a RBAC-critical model.
- **Reuse the global `Role` enum for memberships (rejected):** Would collapse
  the two authorization axes into one enum, making it impossible to express
  "global ADMIN but only VIEWER in a collection" or vice versa, and would
  conflate collection-scoped permissions with app-wide admin permissions. The
  explicit separation was required.

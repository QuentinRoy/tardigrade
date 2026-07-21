# Unify grade targets as student sets; drop the individual/group kind

- **Status:** Accepted
- **Created:** 2026-07-21
- **Related:** [ADR 0012](0012-converged-domain-vocabulary-and-two-glossaries.md), [CONTEXT.md](../../CONTEXT.md) (Grade Target, Group), [assessment target model investigation](../investigations/2026-05-20-assessment-target-model.md), #292, #61, #136

## Context

A **Grade Target** — the entity occupying one row of a Grid — is persisted as one of two branches discriminated by a `grade_target_kind` enum (`individual` | `group`): an individual points at a single **Student**, a group points at a `group` whose members live in `student_to_group`, and a CHECK constraint enforces the XOR. The two branches represent the same concept: a target is a set of Students, and an individual is a set of one. The split buys nothing at the domain level — the `group` table has no life independent of being a target — while it forces individual-vs-group conditionals through grading, import, export, and results, and obstructs the dynamic-regrouping direction of #61.

## Decision

Persist every Grade Target with a single model: a target **is** a set of Students.

- **One entity, membership by join.** Drop the `group` table; a target's members live in a `grade_target_student` join table. The group *name* becomes an optional attribute of the target.
- **No stored discriminator.** Remove the `grade_target_kind` enum, the XOR CHECK, and the individual/group branch. The database no longer distinguishes the two.
- **Individual vs group is a derived presentation shape**, computed at read time: a target renders as a **Group** when it has a name OR more than one member, and as an **Individual** only when it has exactly one member and no name. The name is the author's explicit "this is a group" signal; member count is the implicit one; they never contradict. An Individual never carries a name.
- **Partition Rule.** A Student belongs to at most one Grade Target per Grid. Moving a Student between targets is a reassignment, never a fork, so grid-wide Totals and Grade Completion never double-count.
- **At least one member.** Every target references ≥1 Student. Because membership is a join table this cannot be a column CHECK, so it is a write-boundary guarantee (matching how group non-emptiness is *already* only app-enforced today); readers fail loudly on a memberless target. Zero-member draft targets are out of scope, deferred to #61.
- **Name unique per Grid** (NULLs distinct, so unnamed individuals are unconstrained); the name is import's find-or-create key for a group.
- **Migration is data-safe by aborting, never destroying.** Two pre-existing states cannot satisfy the new invariants — a Student backing both an individual target and a group member (violates the partition), and a group target with zero members (violates ≥1; its grades attach to the *target*, so silent removal would lose grades). The migration asserts neither exists and aborts otherwise; reconciliation is manual. Both are expected empty (import assigns one target per Student and populates members; `group.name` is currently `NOT NULL`).

## Alternatives considered

- **Everything-is-a-Group (singleton groups)** — keep the `group` table, make it mandatory, auto-create a singleton group per individual. Rejected: retains a named entity the product never uses on its own and keeps the `student_to_group` indirection — all cost, no domain gain, since group↔target is already effectively 1:1.
- **Keep `kind` as a stored presentation hint** — rejected: the split is fully derivable from name + member count, so storing it only invites drift.
- **Allow a Student in multiple targets** (solo *and* in a group) — rejected for this change: it makes grid-wide aggregates ambiguous. Grading a Student both ways is a separate feature (peer review, resubmission).
- **A DB-level ≥1-member trigger** — rejected: enforcing "the join table has ≥1 row per parent" by trigger is heavy and unusual here; the write-boundary guarantee matches the repo's posture (invalid states unrepresentable at writes, loud reads).

## Consequences

- The individual/group conditionals across grading, import, export, and search collapse to a single derivation, and #61's regrouping becomes a plain membership edit.
- The migration is a new appended migration (no committed migration is rewritten). Its `down` is reversible for up-migrated rows — every pre-existing group is named — with only later app-created *unnamed multi-member* targets needing a synthesized name on the way down, a bounded irreversibility matching the assessment-container drop.
- `CONTEXT.md` shifts Group and Individual from persisted kinds to presentation shapes over one Grade Target model, and adds Membership, Partition Rule, and Group Name.
- Execution — the migration, the read/write/derivation rewrites, and the test seams — is specified in #292, not here.

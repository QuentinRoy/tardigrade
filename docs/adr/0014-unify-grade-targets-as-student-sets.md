# A grade target is a set of students; individual vs group is presentation-only

- **Status:** Accepted
- **Created:** 2026-07-21
- **Related:** [ADR 0012](0012-converged-domain-vocabulary-and-two-glossaries.md), [CONTEXT.md](../../CONTEXT.md) (Grade Target, Group), [assessment target model investigation](../investigations/2026-05-20-assessment-target-model.md), #292, #61, #136

## Context

A **Grade Target** — the entity occupying one row of a Grid — is modelled as one of two persisted kinds discriminated by a `grade_target_kind` enum: an *individual* points at a single **Student**, a *group* points at a separate group entity whose members are held elsewhere, and a constraint enforces that exactly one applies. The two kinds represent the same concept: a target is a set of Students, and an individual is a set of one. The distinction earns nothing at the domain level — a group has no life independent of being a target — while it spreads individual-vs-group conditionals through grading, import, export, and results, and obstructs the dynamic-regrouping direction of #61.

## Decision

A Grade Target is a single kind of thing: **a set of one or more Students.** There is no separate persisted group entity and no individual/group discriminator.

- **Membership is a direct target–Student relation**, and a target carries an optional **name** (the group name). An individual has no name and derives its label from its one member.
- **Individual vs group is presentation, derived at read time** by the name-OR-multimember rule: a target is a **Group** when it has a name or more than one member, and an **Individual** only when it has exactly one member and no name. The name is the author's explicit "this is a group" signal, member count the implicit one; they never contradict, and an Individual never carries a name.
- **Partition Rule**: a Student belongs to at most one Grade Target per Grid, so grid-wide Totals and Grade Completion never double-count and reassignment is a move, not a fork.
- **A target always has at least one member.** Because membership is a relation rather than a column, this invariant belongs to the write boundary, not a database check; a memberless target is a loud read-time error, never a silently-labelled row. Zero-member draft targets are out of scope (deferred to #61).
- **A name is unique within its Grid** and is the key by which an import reconciles an existing group.
- **Adopting this model discards no existing data.** Rows that cannot satisfy the new invariants — a Student in two targets, or a group with no members (whose grades hang off the target) — are reconciled by hand rather than dropped, because those grades would otherwise be lost.

## Alternatives considered

- **Everything-is-a-Group (singleton groups)** — keep a group entity, make it mandatory, and give every individual a singleton group. Rejected: retains a named entity the product never uses on its own and keeps an extra layer of indirection — all cost, no domain gain, since group↔target is already effectively 1:1.
- **Keep `kind` as a stored presentation hint** — rejected: the distinction is fully derivable from name + member count, so storing it only invites drift.
- **Allow a Student in multiple targets** (solo *and* in a group) — rejected: it makes grid-wide aggregates ambiguous. Grading a Student both ways is a separate feature (peer review, resubmission).
- **Enforce ≥1 member in the database** — rejected: "the relation has ≥1 row per target" is awkward to express as a constraint and unusual here; the write-boundary guarantee matches the repo's posture (invalid states unrepresentable at writes, loud reads).

## Consequences

- The individual/group conditionals across grading, import, export, and search collapse to a single derivation, and #61's regrouping becomes a plain membership edit.
- `CONTEXT.md` reframes Group and Individual as presentation shapes over one Grade Target model, and adds Membership, Partition Rule, and Group Name.
- Execution — the schema change, the read/write/derivation updates, and the test seams — is specified in #292.

# Unify grade targets as student sets; drop the individual/group kind

- **Status:** Accepted
- **Created:** 2026-07-21
- **Related:** [ADR 0012](0012-converged-domain-vocabulary-and-two-glossaries.md), [CONTEXT.md](../../CONTEXT.md) (Grade Target, Group), [assessment target model investigation](../investigations/2026-05-20-assessment-target-model.md), #292, #61, #136

## Context

A **Grade Target** — the entity occupying one row of a Grid — is persisted today as one of two branches discriminated by a `grade_target_kind` enum (`individual` | `group`): an `individual` row points at a single `student`, a `group` row points at a `group` whose members live in `student_to_group`. A CHECK constraint enforces the XOR (exactly one of `student_row_id` / `group_row_id` set), and two unique indexes cap a student at one individual target and a group at one target.

The two branches represent the same underlying concept: a target is a set of students, and an individual is a set of one. The split buys nothing at the domain level — the `group` table has no life independent of being a target (no standalone group management; groups appear only in import, export grouping, target load, and quick-jump search) — while it forces `isIndividual`/`isGroup` conditionals through grading, import, export, and results code, and complicates the dynamic-regrouping direction of #61.

## Decision

Persist every Grade Target with a single model: a target *is* a set of students.

- **Merge `group` into `grade_target`.** Drop the `group` table. Membership moves to a join table **`grade_target_student`** (`grade_target_row_id`, `student_row_id`), replacing `student_to_group`. The group *name* moves onto `grade_target` as an optional `name` column; an individual target leaves it null and derives its label from its one member.
- **Drop the `kind` discriminator.** Remove the `grade_target_kind` enum and the `kind` column; remove the XOR CHECK and the `student_row_id` / `group_row_id` columns. The database no longer distinguishes individual from group.
- **Partition students.** A student belongs to **at most one** grade target per grid, enforced by a unique constraint on `grade_target_student.student_row_id`. Moving a student between targets is a reassignment, never a fork; grid-wide totals, completion, and export never double-count a student.
- **At least one member, app-enforced.** Every target references ≥1 student. This is not expressible as a column CHECK once membership is a join table, so it is a write-boundary guarantee (matching how group non-emptiness is *already* only app-enforced today); readers fail loudly on a memberless target rather than substituting a label. Zero-member / draft targets are explicitly out of scope and deferred to #61.
- **Presentation is derived, name-OR-multimember.** With `kind` gone, the individual/group split is computed at read time: a target renders as a **group** when it has a name OR more than one member, and as an **individual** only when it has exactly one member and no name. The author's name is the explicit "this is a group" signal; member count is the implicit one; the two never contradict. A named single-member target is a group (e.g. a binôme whose partner dropped). An individual never carries a name.
- **Name unique per grid.** `UNIQUE (name, grid_row_id)` moves onto `grade_target` (Postgres treats NULLs as distinct, so unnamed individuals are unconstrained). Import keeps find-or-create-by-name for groups; individuals are matched by their single member (unique by the partition).

## Alternatives considered

- **Everything-is-a-Group (singleton groups)** — keep the `group` table, make `grade_target.group_row_id` mandatory, and auto-create a singleton group for every individual. Rejected: it retains a named entity the product never uses on its own, forces an awkward singleton group behind every individual, and keeps the `student_to_group` indirection — all cost, no domain gain, since group↔target is already effectively 1:1.
- **Keep `kind` as a stored presentation hint** — rejected: the split is fully derivable from name + member count, so storing it only invites drift with the derivation.
- **Allow a student in multiple targets** (solo *and* in a group) — rejected for #292: it makes grid-wide aggregates ambiguous. Grading a student both solo and grouped (peer review, resubmission) is a separate feature, not this simplification.
- **DB-level ≥1-member trigger** — rejected: a trigger enforcing "the join table has ≥1 row per parent" is heavy and unusual in this schema; the write-boundary guarantee matches the repo's established posture (invalid states unrepresentable at writes, loud reads).

## Consequences

- **Migration is a new appended migration**, not a rewrite of a committed one. It backfills `grade_target_student` (one row per individual target's student; one row per group member), copies `group.name` onto `grade_target`, then drops `kind`, the FK columns, the XOR CHECK, `group`, and `student_to_group`.
- **Abort-on-violation, never silent destruction.** Two pre-existing states cannot satisfy the new invariants and could lose grades if handled silently: a student backing both an individual target and a group member (violates the partition), and a group target with zero members (violates ≥1; its grades attach to the *target*, so dropping it loses real grades). The migration ships a pre-flight assertion that aborts if either exists; reconciliation is manual. Both are expected to be empty (import assigns one target per student and always populates members; `group.name` is currently `NOT NULL`, so every existing group is named).
- **`down` is reversible for migrated rows.** It reconstructs `group` / `student_to_group` / `kind` from named and multi-member targets. Every pre-existing group was named, so up-migrated data round-trips; only app-created *unnamed multi-member* targets appearing later would need a synthesized name on the way down — the same bounded irreversibility the assessment-container drop accepted.
- **`kind` conditionals collapse to derivation** across `grade-targets`, `imports/students`, `imports/grades`, `export`, and `quickJumpSearch`. The unnamed multi-member label improves from `t-<n>` to joined member names.
- **Kanel types regenerate**: `GradeTargetKind`, `Group`, `StudentToGroup` disappear; `GradeTargetStudent` appears; `GradeTarget` loses `kind` / `groupRowId` / `studentRowId` and gains `name`.
- **`CONTEXT.md` shifts Group and Individual from persisted kinds to presentation shapes** over one Grade Target model, and adds Membership. See the Grade Target / Group entries.

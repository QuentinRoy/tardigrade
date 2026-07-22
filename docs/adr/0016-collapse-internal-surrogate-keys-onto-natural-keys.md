# Collapse internal-only surrogate keys onto natural keys

- **Status:** Accepted
- **Created:** 2026-07-22
- **Related:** [migration](../../src/db/migrations/20260722000002_normalize_internal_row_ids.ts), ADR 0015, #322, #324

## Context

Several internal-only persistence tables still carried a Prisma-era `id`
surrogate that nothing ever addressed directly:

- `check_criterion`, `number_criterion`, `options_criterion` — each row is
  identified 1:1 by its owning `criterion_id`; no other row ever referenced
  the surrogate `id`, only `criterion_id`.
- `criterion_grade` (the grade cell) — already uniquely identified by
  `(grade_target_row_id, criterion_id)`; its `id` existed only so the three
  criterion-grade subtype tables (`check_criterion_grade`,
  `number_criterion_grade`, `options_criterion_grade`) had something to point
  at.
- Those three subtype tables — each row is identified 1:1 by the
  `criterion_grade_id` it belongs to.
- `options_criterion_mark` — kept its surrogate (renamed `id` → `row_id`)
  because label rows are a genuine 1:many child of a criterion, not a 1:1
  config row.

Separately, every internal foreign key still named its column `_id` rather
than `_row_id` (`criterion.rubric_id`, `criterion_grade.criterion_id`,
`options_criterion_mark.options_criterion_id`, …), inconsistent with the
`row_id`/`_row_id` convention already established for `grid`, `rubric`,
`criterion`, `grade_target`, and `student` (see CONTEXT.md's Grid Row ID
entry) and documented as the target end-state by #322.

Both problems compound: a surrogate that exists only to be pointed at by a
column named `_id` reads as if it might carry independent meaning, when it
doesn't. Finishing the rename without collapsing the redundant surrogates
would still leave call-sites doing a needless two-hop lookup (insert parent,
read back its `id`, use that `id` to insert children) purely to satisfy a key
the schema didn't need.

## Decision

One migration, `20260722000002_normalize_internal_row_ids`, does both at once
since the column renames and the surrogate collapses touch the same rows and
splitting them would leave an intermediate schema nothing should ever run
against:

- Rename every internal FK column from `_id` to `_row_id`: `criterion.rubric_id`
  → `rubric_row_id`, `criterion_grade.criterion_id` → `criterion_row_id`, and
  the equivalent column on `check_criterion` / `number_criterion` /
  `options_criterion`. Kysely `renameColumn` propagates through the existing
  ADR 0015 composite FKs and unique constraints without a drop/recreate.
- Collapse `check_criterion` / `number_criterion` / `options_criterion` onto
  their already-`UNIQUE` `criterion_row_id`: drop the surrogate `id`, promote
  `criterion_row_id` to the primary key.
- Collapse `criterion_grade` onto its already-`UNIQUE`
  `(grade_target_row_id, criterion_row_id)`: drop the surrogate `id`, promote
  that pair to the primary key. `grid_row_id` (the ADR 0015 consistency copy)
  and both composite FKs to `criterion` and `grade_target` are untouched.
- Repoint `check_criterion_grade` / `number_criterion_grade` /
  `options_criterion_grade` off the (now-gone) `criterion_grade_id` onto the
  same `(grade_target_row_id, criterion_row_id)` composite directly, with a
  composite FK onto `criterion_grade`'s new primary key.
- Repoint `options_criterion_mark` off `options_criterion.id` onto
  `options_criterion.criterion_row_id` directly (its FK target after the
  collapse above), and rename its own surrogate `id` → `row_id` — it keeps a
  surrogate because a criterion can have many marks, unlike the 1:1 tables
  above.

Application code follows the same collapse: writing a batch of criterion
grades no longer inserts the `criterion_grade` parent, reads back its `id`,
and threads that `id` into the subtype writes — the (Grade Target, Criterion)
pair the caller already has is the subtype tables' key, so
`upsertCriterionGradeParents` just upserts the parent row and the subtype
writers use that same pair directly (`src/grade-persistence/gradeMutations.ts`).
The two trigger functions that previously joined through `criterion_grade.id`
(`enforce_number_criterion_value_bounds`, `enforce_options_criterion_label_valid`)
now look up their sibling subtype-config row directly by `criterion_row_id`,
one join shorter than before.

#144 / ADR 0015 invariants are preserved exactly: no `grid_row_id` column is
dropped, neither composite FK is downgraded to single-column, and neither
`UNIQUE(row_id, grid_row_id)` on `rubric` / `criterion` / `grade_target` is
touched — a cross-grid criterion/rubric or criterion/grade-target pairing
stays structurally unrepresentable.

## Alternatives considered

- **Rename `_id` → `_row_id` without collapsing the surrogates** — the
  narrower reading of #322. Rejected: it would leave `check_criterion.id`,
  `criterion_grade.id`, and the three subtype-grade tables' `id` in place
  as pure dead weight — nothing addresses them, they exist only because the
  Prisma-era schema gave every table a surrogate by default — while the
  column rename alone doesn't remove the two-hop insert-then-read-back
  pattern their FKs forced on every writer.
- **Collapse the surrogates but keep the composite FK columns named `_id`** —
  rejected as leaving the naming half-finished for no reason; the rename is
  free (no data transform, no extra migration step) once the column is being
  touched for the collapse anyway.

## Consequences

- Every internal-only table's generated surrogate is now named `row_id` (or
  removed entirely where the table collapsed onto a natural/composite key);
  every `RowId`-holding foreign key column is suffixed `_row_id`.
- `saveCriterionGradesInDb` no longer needs the `criterion_grade` parent's id
  read back after insert: the subtype tables key off the same
  `(grade_target_row_id, criterion_row_id)` pair the caller already resolved,
  removing a lookup map and a `resolveParentId` step
  (`src/grade-persistence/gradeMutations.ts`).
- `upsertOptionsSubtypeRowsInDb` and the `options` grade-validation query no
  longer hop through `options_criterion.id`: `options_criterion_mark` targets
  `options_criterion.criterion_row_id` directly
  (`src/criteria/options/optionsPersistence.ts`).
- Every DB-facing call-site that read or wrote the removed `id`/`_id` columns
  was updated in the same change (persistence, import contexts, results and
  export loaders, grade completion, rubric management) plus their integration
  tests and fixtures. `src/db/constraints.integration.test.ts` renamed its
  constraint-name literals to match, plus rebuilt the fixtures and assertions
  that previously keyed off `criterion_grade.id` / `criterion_grade_id` — that
  surrogate no longer exists, so those spots had to move onto the
  `(grade_target_row_id, criterion_row_id)` composite key. Every rebuilt
  assertion still checks the same behavior (bounds/label rejection, cascade
  delete, rollback-on-failure); none of the tested invariants changed.

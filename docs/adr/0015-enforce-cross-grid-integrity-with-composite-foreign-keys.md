# Enforce cross-grid integrity with composite foreign keys

- **Status:** Accepted
- **Created:** 2026-07-22
- **Related:** [cross-grid integrity investigation](../investigations/2026-07-22-cross-grid-integrity-enforcement.md), [execution plan](../../plans/2026-07-22-cross-grid-integrity-enforcement.md), #144, [later key normalization (ADR 0016)](0016-collapse-internal-surrogate-keys-onto-natural-keys.md)

## Context

Two grid-scoped relationships had no database-level guarantee that both sides of the relationship belonged to the same grid:

- a `criterion` references a `rubric` through `rubric_row_id`, but nothing forced `criterion.grid_row_id` to equal `rubric.grid_row_id`;
- a `criterion_grade` (the grade cell — the busiest write table) references a `criterion` and a `grade_target` through two independent foreign keys, but nothing forced those two parents to belong to the same grid.

Only the application layer (`saveCriterionGradeInDb`'s grid-scoped id resolution) and defensive read joins rejected cross-grid combinations. A raw insert, a future second writer, or an app-layer bug could silently create a cross-grid row.

`criterion_grade` has no `grid_row_id` column at all today, so enforcing the cell relationship requires adding one purely as an enforcement mechanism rather than as a new piece of domain data.

## Decision

Enforce both relationships with composite foreign keys that replace the existing single-column FKs, each backed by a `UNIQUE (row_id, grid_row_id)` on the referenced parent:

- **`criterion → rubric`** — a composite FK over `(rubric_row_id, grid_row_id)`. `criterion` already carries `grid_row_id`, so no new column.
- **`criterion_grade` (the cell)** — add a `grid_row_id` column and pin it against *both* parents (`criterion` and `grade_target`) with two composite FKs, forcing all three rows to share a grid.

The exact column tuples, backfill, and `NOT NULL` step live in the migrations ([`…_enforce_criterion_rubric_grid_consistency`](../../src/db/migrations/20260722000000_enforce_criterion_rubric_grid_consistency.ts), [`…_add_criterion_grade_grid_row_id`](../../src/db/migrations/20260722000001_add_criterion_grade_grid_row_id.ts)).

This distinguishes two kinds of `grid_row_id` column — a distinction any future grid-scoped child table inherits:

- **True parent link** — the row's own, independently meaningful membership in a grid (e.g. `criterion`'s direct FK to `grid`).
- **Consistency copy** — a `grid_row_id` that exists *solely* to let a composite FK pin two other columns on the same row to the same grid (`criterion_grade.grid_row_id`, and `criterion`'s role in the composite `criterion → rubric` FK). It carries no independent meaning, its correctness is guaranteed by the composite FK rather than by application code, and it needs no direct FK to `grid` (validity follows transitively).

The application write path (`saveCriterionGradeInDb` in `src/grade-persistence/gradeMutations.ts`) keeps its grid-scoped id resolution and populates the new column: the composite FKs are defense-in-depth behind an already-correct writer, not a replacement. The app-layer checks also drive user-facing error messages, which a DB constraint cannot.

## Alternatives considered

- **Trigger guard** — a `BEFORE INSERT OR UPDATE` trigger comparing both parents' `grid_row_id` without adding a column. Rejected: on `criterion_grade`, the hottest write table, a trigger adds per-row PL/pgSQL invocation and two extra lookups on top of the FK checks an insert already pays — more expensive than the composite-FK column it was meant to avoid, while also being invisible in the schema and Kysely types.
- **App-layer-only, no DB enforcement** — ship only the free `criterion → rubric` fix and rely on `saveCriterionGradeInDb` plus tests for the cell. Rejected: leaves #144's core acceptance criterion (a DB-level guarantee) unmet, with no defense against raw SQL, a future migration, or a future second writer.
- **Keep the single-column FKs alongside the new composites** — rejected: it would leave two extra indexes doing nothing the composite FK doesn't already cover, for no benefit.

## Consequences

- Cross-grid rows are now structurally unrepresentable for both relationships, meeting #144's acceptance criterion regardless of write path.
- `criterion_grade` inserts still pay roughly the same two FK checks as before (now against composite unique indexes instead of single-column ones) — no added per-row cost on the hottest table.
- Every direct `criterion_grade` insert (production and test fixtures) must now supply `grid_row_id`, enforced at the type level via the regenerated Kysely types.

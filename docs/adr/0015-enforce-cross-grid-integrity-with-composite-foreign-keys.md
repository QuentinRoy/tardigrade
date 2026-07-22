# Enforce cross-grid integrity with composite foreign keys

- **Status:** Accepted
- **Created:** 2026-07-22
- **Related:** [cross-grid integrity investigation](../investigations/2026-07-22-cross-grid-integrity-enforcement.md) (Option A accepted), [execution plan](../../plans/2026-07-22-cross-grid-integrity-enforcement.md), #144

## Context

Two grid-scoped relationships had no database-level guarantee that both sides of the relationship belonged to the same grid:

- a `criterion` references a `rubric` through `rubric_id`, but nothing forced `criterion.grid_row_id` to equal `rubric.grid_row_id`;
- a `criterion_grade` (the grade cell — the busiest write table) references a `criterion` and a `grade_target` through two independent foreign keys, but nothing forced those two parents to belong to the same grid.

Only the application layer (`saveCriterionGradeInDb`'s grid-scoped id resolution) and defensive read joins rejected cross-grid combinations. A raw insert, a future second writer, or an app-layer bug could silently create a cross-grid row.

`criterion_grade` has no `grid_row_id` column at all today, so enforcing the cell relationship requires adding one purely as an enforcement mechanism, not as a new piece of domain data — a replicated column with no independent meaning of its own.

## Decision

Enforce both relationships with composite foreign keys, replacing the existing single-column FKs where a composite subsumes them:

- `criterion (rubric_id, grid_row_id) REFERENCES rubric (row_id, grid_row_id)`, replacing the single-column `criterion.rubric_id` FK. `criterion` already carries `grid_row_id`; no new column.
- `criterion_grade.grid_row_id` is added, backfilled from `criterion_grade.criterion_id`, and made `NOT NULL`. Two composite FKs then pin it against both parents:
  `criterion_grade (criterion_id, grid_row_id) REFERENCES criterion (row_id, grid_row_id)` and
  `criterion_grade (grade_target_row_id, grid_row_id) REFERENCES grade_target (row_id, grid_row_id)`,
  replacing the single-column `criterion_grade.criterion_id` and `criterion_grade.grade_target_row_id` FKs.

Each composite FK is backed by a cheap `UNIQUE (row_id, grid_row_id)` on the referenced parent (trivially unique, since `row_id` alone already is) — the standard shape Postgres requires for the referenced columns of a composite FK.

This introduces a taxonomy for `grid_row_id` columns across the schema:

- **True parent links** — the row's own, independently meaningful membership in a grid: `student.grid_row_id`, `grade_target.grid_row_id`, `rubric.grid_row_id`, and `criterion.grid_row_id` (`criterion`'s direct FK to `grid`, distinct from its role in the composite FK above).
- **Consistency copies** — a `grid_row_id` whose only purpose is to let a composite FK pin two *other* columns on the same row to the same grid: `criterion`'s use of `grid_row_id` in the `criterion_rubric_id_grid_row_id_fkey` pairing, and all of `criterion_grade.grid_row_id`. A consistency copy carries no independent meaning; its correctness is guaranteed by the composite FK, not by application code.

`criterion_grade.grid_row_id` has no direct FK to `grid`: its validity is guaranteed transitively through the two composite FKs, so a third direct FK would be redundant.

The application write path (`saveCriterionGradeInDb` in `src/grade-persistence/gradeMutations.ts`) keeps its grid-scoped id resolution and populates the new column; nothing is deleted from the app layer. The composite FKs are defense-in-depth backing an already-correct writer, not a replacement for it — the app-layer checks also drive user-facing error messages, which a DB constraint cannot.

## Alternatives considered

- **Trigger guard** (Option B in the investigation) — a `BEFORE INSERT OR UPDATE` trigger comparing both parents' `grid_row_id` without adding a column. Rejected: on `criterion_grade`, the hottest write table, a trigger adds per-row PL/pgSQL invocation and two extra lookups on top of the FK checks an insert already pays — more expensive than the composite-FK column it was meant to avoid, while also being invisible in the schema and Kysely types.
- **App-layer-only, no DB enforcement** (Option C) — ship only the free `criterion → rubric` fix and rely on `saveCriterionGradeInDb` plus tests for the cell. Rejected: leaves #144's core acceptance criterion (a DB-level guarantee) unmet, with no defense against raw SQL, a future migration, or a future second writer.
- **Keep the single-column FKs alongside the new composites** — rejected: it would leave two extra indexes doing nothing the composite FK doesn't already cover, for no benefit.

## Consequences

- Cross-grid rows are now structurally unrepresentable for both relationships, meeting #144's acceptance criterion regardless of write path.
- `criterion_grade` inserts still pay roughly the same two FK checks as before (now against composite unique indexes instead of single-column ones) — no added per-row cost on the hottest table.
- `criterion_grade` gains one `NOT NULL` `integer` column (4 bytes/row) and no dedicated index (deferred until a grid-scoped cell query needs one — see `docs/reference/database-migrations.md`-adjacent migration comments).
- Every direct `criterion_grade` insert (production and test fixtures) must now supply `grid_row_id`; this is enforced at the type level via the regenerated Kysely types.
- The parent-link vs consistency-copy taxonomy above is the reference for any future grid-scoped child table: a `grid_row_id` column is only a consistency copy when it exists solely to back a composite FK pinning two other columns together.

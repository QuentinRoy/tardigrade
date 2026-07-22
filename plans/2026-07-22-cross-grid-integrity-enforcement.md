# Enforce cross-grid integrity with composite foreign keys

- **Status:** Active
- **Created:** 2026-07-22
- **Origin:** [cross-grid integrity investigation](../docs/investigations/2026-07-22-cross-grid-integrity-enforcement.md) (Option A accepted)
- **Tracked by:** [#144](https://github.com/QuentinRoy/tardigrade/issues/144)

## Purpose

Make cross-grid grade rows structurally impossible at the database level:

- a `criterion` may only reference a `rubric` in its own grid (**Part 1**);
- a `criterion_grade` may only reference a `criterion` and a `grade_target` in
  the same grid (**Part 2**), enforced via a replicated `grid_row_id`
  consistency copy on the cell plus composite foreign keys.

This executes **Option A** from the investigation (read it for why A over a
trigger or app-layer-only). The decision itself — the composite-FK enforcement
pattern and the parent-link vs consistency-copy column taxonomy — is recorded in
**ADR 0015** (to be written as part of this work); this plan owns *how* and *in
what order*. The ADR is a decision record, not a migration script: keep the DDL
mechanics here, not in the ADR.

## Guidance consulted

- [database-migrations reference](../docs/reference/database-migrations.md) —
  migrations are immutable history (add new files, never rewrite); no imports of
  generated types or app code; `Kysely<unknown>` for schema-only, a **minimal
  local DB type or raw `sql`** for data queries; prefer the Kysely schema builder
  for DDL, raw `sql` only where it can't express the change; **one DDL per
  `await`** (no `Promise.all` on schema changes); fail loudly over silently
  transforming data; regenerate types with `pnpm run db:types:generate`.
- [CONTEXT.md](../CONTEXT.md) — **Grid Row ID** is DB-internal; **Grid Resolution
  Strategy** (build from Grid ID, resolve in-query). The Grid Row ID glossary
  entry gets a one-line pointer to ADR 0015.
- [documentation-conventions](../docs/guides/documentation-conventions.md) — ADR
  shape (Context / Decision / Alternatives / Consequences; H1 is a descriptive
  sentence, not "ADR 0015:"); investigation flips to `Status: Completed` + a
  `Resolution:` line when an ADR captures the decision.
- [testing-conventions](../docs/reference/testing-conventions.md) — integration
  tests run against a disposable DB; command selection for the changed files.
- [commit-message-conventions](../docs/guides/commit-message-conventions.md) —
  `<area>: <imperative summary>`; keep plan-local stage ids out of titles.
- [tdd skill](../.agents/skills/tdd/SKILL.md) — seams confirmed up front; behavior
  driven red→green in vertical slices, one constraint per slice; structural
  enablers (column/backfill/uniques) are not behavior and aren't test-driven.

## Decisions (locked)

1. **Two migration files, one PR.** Part 1 and Part 2 are distinct schema
   changes on different tables (migration-focus convention), landed together with
   the app + docs + tests in the single PR that closes #144.
2. **Fail loudly on pre-existing violations.** Each `up()` pre-checks for
   offending rows and `throw`s a descriptive error before any DDL. No auto-repair,
   no row deletion.
3. **Backfill `criterion_grade.grid_row_id` from `criterion`** (via
   `criterion_id → criterion.grid_row_id`). Equivalent to sourcing from
   `grade_target` because the pre-check guarantees they agree.
4. **Replace single-column FKs with composites, preserving `ON DELETE CASCADE
   ON UPDATE CASCADE`.** Keeps cell inserts at 2 FK checks (the point of Option
   A), not 4. Applies to `criterion → rubric` and both cell FKs.
5. **No direct `criterion_grade → grid` FK.** `grid_row_id` stays a pure
   consistency copy, validity guaranteed transitively by the two composite FKs;
   grid deletes still cascade through `criterion`/`grade_target`.
6. **Defer the `criterion_grade.grid_row_id` index.** Column is `NOT NULL` with
   no dedicated index; the cell is loaded per grade-target, not by grid. Leave a
   comment; add an index only if a grid-scoped cell query appears.
7. **Defense-in-depth; keep the app code.** The `saveCriterionGradeInDb` and
   `grades.ts` filters do grid-scoped id-resolution and user-facing validation,
   not pure integrity, so nothing is deleted. Add a comment at the cell insert
   that the composite FKs now backstop cross-grid, and record the review in the
   PR.
8. **ADR 0015 + investigation resolution + CONTEXT pointer.** ADR is the
   authoritative record of the decision and the column taxonomy; investigation →
   `Completed` with a `Resolution:` line; CONTEXT.md Grid Row ID entry gets a
   one-line pointer.
9. **Three new integration tests, driven TDD red→green** at a confirmed seam
   (details in [Tests](#4-tests)).

### Confirmed test seams (tdd skill)

- **Seam 1 — the DB schema**, exercised through
  `constraints.integration.test.ts`: insert rows directly via Kysely and assert
  the DB rejects the cross-grid combination with
  `.rejects.toThrow(<constraint_name>)`. This is the only seam that observes the
  new behavior — the app write path resolves grid-scoped ids and cannot construct
  a cross-grid insert, so it exercises nothing. Constraint-name assertions match
  the existing file convention and are the contract for a schema-integrity
  feature.
- **Seam 2 — the grade-save write path is already covered; add nothing.**
  `saveCriterionGrade.integration.test.ts`, `gradeMutations.integration.test.ts`,
  `grades.integration.test.ts`, and `imports/grades/saveGrades.integration.test.ts`
  drive `saveCriterionGradeInDb` end-to-end and go red if the production insert
  omits `gridRowId` against the new `NOT NULL` column. No new write-path test.
- **No app-behavior seam** — decision 7 leaves app behavior unchanged, so there
  is nothing new to specify above the DB.

## Current schema (constraint names to target)

`criterion`
- `criterion_rubric_id_fkey` — `(rubric_id) → rubric(row_id)`, CASCADE/CASCADE — **replaced in Part 1**
- `criterion_grid_row_id_fkey` — `(grid_row_id) → grid(row_id)`, CASCADE/CASCADE — kept
- `criterion_grid_row_id_id_key` — UNIQUE`(grid_row_id, id)` — kept (unrelated)

`criterion_grade`
- `criterion_grade_criterion_id_fkey` — `(criterion_id) → criterion(row_id)`, CASCADE/CASCADE — **replaced in Part 2**
- `criterion_grade_grade_target_row_id_fkey` — `(grade_target_row_id) → grade_target(row_id)`, CASCADE/CASCADE — **replaced in Part 2**
- `criterion_grade_grade_target_row_id_criterion_id_key` — UNIQUE`(grade_target_row_id, criterion_id)` — kept (one cell per pair)

`rubric` / `grade_target` — each has `row_id` PK, `grid_row_id`, and a
`*_grid_row_id_id_key` UNIQUE`(grid_row_id, id)`. Neither has a `(row_id,
grid_row_id)` unique yet — added below to back the composite FKs.

## Work items

### 1. Migration A — `criterion → rubric` grid consistency

File: `src/db/migrations/<ts>_enforce_criterion_rubric_grid_consistency.ts`.

`up`:
1. **Pre-check (fail loud).** `SELECT count(*)` of `criterion` joined to `rubric`
   on `rubric_id` where `criterion.grid_row_id <> rubric.grid_row_id`. If > 0,
   `throw new Error(...)` naming the count and that the rows must be corrected by
   hand first (no auto-fix).
2. Add UNIQUE `rubric_row_id_grid_row_id_key` on `rubric(row_id, grid_row_id)`
   (trivially unique; backs the composite FK).
3. `dropConstraint("criterion_rubric_id_fkey")`.
4. Add composite FK `criterion_rubric_id_grid_row_id_fkey`
   `(rubric_id, grid_row_id) → rubric(row_id, grid_row_id)`,
   `onDelete("cascade").onUpdate("cascade")`.

`down`: drop the composite FK, restore `criterion_rubric_id_fkey`
`(rubric_id) → rubric(row_id)` CASCADE/CASCADE, drop
`rubric_row_id_grid_row_id_key`.

Typing: `Kysely<unknown>` for the schema-builder DDL; the pre-check runs as a raw
`sql` `SELECT` (no generated-type import).

### 2. Migration B — `criterion_grade` grid consistency

File: `src/db/migrations/<ts>_add_criterion_grade_grid_row_id.ts` (timestamp
after Migration A).

`up`:
1. **Pre-check (fail loud).** Count `criterion_grade` where its `criterion`'s
   `grid_row_id <> ` its `grade_target`'s `grid_row_id`. If > 0, `throw` with the
   count and required manual action.
2. `addColumn("grid_row_id", "integer")` — **nullable** initially.
3. **Backfill (raw `sql`):**
   `UPDATE "criterion_grade" SET "grid_row_id" = c."grid_row_id" FROM "criterion" c WHERE c."row_id" = "criterion_grade"."criterion_id";`
4. `alterColumn("grid_row_id", (c) => c.setNotNull())`.
5. Add UNIQUE `criterion_row_id_grid_row_id_key` on
   `criterion(row_id, grid_row_id)`.
6. Add UNIQUE `grade_target_row_id_grid_row_id_key` on
   `grade_target(row_id, grid_row_id)`.
7. `dropConstraint("criterion_grade_criterion_id_fkey")`; add composite
   `criterion_grade_criterion_id_grid_row_id_fkey`
   `(criterion_id, grid_row_id) → criterion(row_id, grid_row_id)` CASCADE/CASCADE.
8. `dropConstraint("criterion_grade_grade_target_row_id_fkey")`; add composite
   `criterion_grade_grade_target_row_id_grid_row_id_fkey`
   `(grade_target_row_id, grid_row_id) → grade_target(row_id, grid_row_id)`
   CASCADE/CASCADE.
9. **No** index on `criterion_grade.grid_row_id` (comment: intentionally
   deferred — decision 6). **No** `grid` FK (decision 5).

One DDL per `await` throughout (no `Promise.all` — heavy locks).

`down`: drop both composite cell FKs; restore the two single-column cell FKs
(CASCADE/CASCADE); drop the two `*_row_id_grid_row_id_key` uniques on
`criterion`/`grade_target`; drop `criterion_grade.grid_row_id`.

Typing: `Kysely<unknown>`; pre-check + backfill as raw `sql`.

### 3. Regenerate types + production write path

- `pnpm run db:types:generate` — adds `gridRowId` to `CriterionGradeTable`
  (`src/db/generated/public/CriterionGrade.ts`). This makes the direct-insert
  sites below fail to type-check until updated, which is the desired forcing
  function.
- `src/grade-persistence/gradeMutations.ts` — in `upsertCriterionGrade`, add
  `gridRowId: grid.rowId` to the `criterionGrade` insert values (`grid.rowId` is
  already resolved at the top of `saveCriterionGradeInDb`). Keep the
  `onConflict(["gradeTargetRowId", "criterionId"])`. Add a one-line comment: the
  composite FKs now enforce cross-grid consistency at the DB level; the
  surrounding grid-scoped lookups remain for id-resolution and user-facing
  errors (decision 7).
- No changes to `grades.ts` joins or the `rubricId`/`kind` validation — retained
  as defense-in-depth + id-resolution (decision 7). Record this review in the PR
  description.

### 4. Tests (TDD red→green vertical slices)

**Structural enablers are not behavior and are not test-driven.** Adding the
column, backfill, `NOT NULL`, and parent uniques only makes a cross-grid insert
*constructable*; they carry no new behavior. The direct
`insertInto("criterionGrade")` sites below must gain `gridRowId` (grid context is
already in scope at each) — mechanical changes forced by the `NOT NULL` column
and guarded by the existing green tests that own them, not new tests:
- `src/test/rubrics.ts:89`
- `src/test/mixedCriterionGradeFixture.ts:260`
- `src/db/constraints.integration.test.ts:166` (the shared fixture)
- `src/imports/students/saveStudents.integration.test.ts:129`
- `src/results/loadResults.integration.test.ts:185, 209, 229`
- `src/export/gradeTargetExport.integration.test.ts:36`
- `src/grade-completion/loadGradeCompletion.integration.test.ts:127`

(`src/grade-persistence/gradeMutations.ts:134` is the production path, item 3,
guarded by Seam 2. Fixtures that write through `saveCriterionGradeInDb` need no
change.)

**The new behavior — DB rejection — is driven one constraint per slice, failing
test first.** Each new test lands in `src/db/constraints.integration.test.ts`,
follows the file's transactional-rollback + `.rejects.toThrow(<constraint_name>)`
pattern, and needs two grids (`createGrid` twice):

- **Slice 1 — criterion → rubric.** Write the test: a `criterion` whose
  `rubric_id` points to a rubric in another grid is rejected. Run it → *red*
  (the insert currently succeeds). Add Migration A's composite FK
  `criterion_rubric_id_grid_row_id_fkey` (+ the `rubric_row_id_grid_row_id_key`
  unique it needs) → *green*.
- **Slice 2 — cell, grade_target side.** Prerequisite enablers land first
  (column, backfill, `NOT NULL`, `criterion`/`grade_target` uniques) so the row
  is constructable. Write the test: a `criterion_grade` with its criterion in
  grid A and its grade_target in grid B is rejected. Run it → *red*. Add the
  `criterion_grade_grade_target_row_id_grid_row_id_fkey` composite FK → *green*.
  (With `grid_row_id` backfilled from the criterion, the grade_target FK is the
  one that catches this.)
- **Slice 3 — cell, criterion side.** Write the test: a `criterion_grade` whose
  `grid_row_id` does not match its criterion's grid is rejected (proves the
  replicated copy cannot be set to a lie). Run it → *red*. Add the
  `criterion_grade_criterion_id_grid_row_id_fkey` composite FK → *green*.

Each of the two cell composite FKs is red-justified by a distinct test, so the
migration is built up constraint-by-constraint rather than tests bolted on after.

### 5. Documentation

- **ADR 0015** — `docs/adr/0015-<slug>.md`. Nygard shape. Context: replicated
  `grid_row_id` without integrity benefit; the cell is the busiest write table;
  only the app layer rejected cross-grid. Decision: enforce with composite FKs;
  `grid_row_id` may be a replicated **consistency copy** on child tables; state
  the **taxonomy** — true parent links (`student`, `grade_target`, `rubric`,
  `criterion → grid`) vs consistency copies (`criterion.rubric_id` pairing, and
  `criterion_grade`). Alternatives: trigger, app-layer-only — why not (summarise
  from the investigation). Consequences: DB-level guarantee, ~2 FK checks on the
  hot path, +1 column, app checks retained as defense-in-depth, pattern reusable
  for future child tables. End by pointing execution at #144 / this plan (no DDL
  in the ADR).
- **Investigation** — set `Status: Completed`, add `Resolution:` pointing to ADR
  0015.
- **CONTEXT.md** — one-line pointer from the **Grid Row ID** entry to ADR 0015
  for the parent-link vs consistency-copy taxonomy.
- **docs/index.md** — add ADR 0015 to the ADR list; the investigation is already
  listed (update its one-liner to "resolved → ADR 0015").
- **plans/index.md** — remove this plan's entry when the PR lands; flip
  `Status: Completed` in the same PR.

## Verification checklist

- `pnpm run migrate` then `pnpm run migrate:down` round-trips both migrations
  cleanly (down restores the original single-column FKs and drops the column).
- `pnpm run db:types:generate` produces no diff beyond `gridRowId` on
  `CriterionGrade`.
- `pnpm run check --fix` and `pnpm run check-types` clean.
- Targeted integration tests pass: `src/db/constraints.integration.test.ts`
  (new + updated fixture), `migrations.integration.test.ts`, and the other
  touched integration suites (results, export, grade-completion, saveStudents).
- Run the simplify pass over the migration + `gradeMutations.ts` diff.
- Confirm on a scratch DB that a hand-written cross-grid `criterion_grade` insert
  fails, and that a normal grade save still succeeds.

## Sequencing within the PR (red→green)

Items 1 and 2 above describe each migration's *final* content; this is the order
in which that content is built, test-first. A test is *red* when its constraint
line is not yet in the migration file (the disposable test DB, `createTestDb`,
runs the whole chain, so the insert still succeeds); *green* once the constraint
is added and the chain re-runs.

1. **Slice 1 (criterion → rubric).** Create Migration A with only the pre-check +
   `rubric_row_id_grid_row_id_key` unique (no FK yet). Write the Slice-1 test →
   red. Add the composite FK → green.
2. **Enablers for the cell.** Create Migration B up to and including the column,
   pre-check, backfill, `NOT NULL`, and the `criterion`/`grade_target` uniques —
   no cell FKs yet. Run `pnpm run db:types:generate` (adds `gridRowId`). Add
   `gridRowId: grid.rowId` to the `gradeMutations.ts` insert (+ backstop comment)
   and to the flagged fixture/test insert sites; the existing write-path suites
   (Seam 2) stay green. This is scaffolding, no new behavior test.
3. **Slice 2 (cell, grade_target side).** Write the Slice-2 test → red. Add the
   `grade_target` composite FK → green.
4. **Slice 3 (cell, criterion side).** Write the Slice-3 test → red. Add the
   `criterion` composite FK → green.
5. ADR 0015, investigation resolution, CONTEXT + docs/index pointers.
6. Simplify pass over the migration + `gradeMutations.ts` diff, then
   `check --fix`, `check-types`, targeted tests, and a full `migrate` up/down
   round-trip.

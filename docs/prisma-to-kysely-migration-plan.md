# Prisma to Kysely Migration Plan

## Why migrate

This migration is driven by two goals:

1. Less magic, more control over generated SQL and query plans.
2. Better performance on high-volume operations that Prisma does not handle well in this project:
   - true bulk upsert for imports
   - streaming export with low memory usage

Compatibility stance for this migration:

- We do not preserve migration continuity with the previous Prisma-backed setup.
- Breaking compatibility is accepted.
- We assume a fresh, empty database for initial rollout.

## Execution status update (2026-05-13)

### Completed so far

1. Foundation and tooling are in place.
- Added Kysely stack dependencies and scripts in package scripts.
- Added migration runner and commands for up, down, and status.
- Added generated DB type flow with numeric parser configured for number handling.

2. Kysely migration baseline is implemented and working.
- Added baseline migration file in [src/db/migrations/20260513000000_init.ts](src/db/migrations/20260513000000_init.ts).
- Added migration runner in [src/db/migrate.ts](src/db/migrate.ts).
- Baseline migration includes all core schema, foreign keys, uniqueness, check constraint, and rubric type enforcement triggers.

3. Read-path migrations are complete for the planned Phase 1 modules.
- [src/db/submissions.ts](src/db/submissions.ts) migrated from Prisma to Kysely.
- [src/db/questions.ts](src/db/questions.ts) migrated from Prisma to Kysely.
- [src/db/assessmentsProgress.ts](src/db/assessmentsProgress.ts) migrated from Prisma to Kysely.

4. Export path migration is complete and now truly streaming.
- [src/db/submissionExport.ts](src/db/submissionExport.ts) moved from Prisma cursor extension usage to Kysely stream-based row iteration.
- Export row assembly is incremental by submission and does not materialize all rows in memory.

5. Write-path migration is partially complete.
- [src/import/saveStudents.ts](src/import/saveStudents.ts) migrated to Kysely transaction + set-based operations.
- [src/import/saveQuestions.ts](src/import/saveQuestions.ts) migrated to Kysely transaction + conflict-based upserts + set-based ordinal cleanup.
- [src/import/saveUtils.ts](src/import/saveUtils.ts) decoupled from Prisma enum import.

6. Final write-path migration is complete.
- [src/db/assessments.ts](src/db/assessments.ts) migrated from Prisma to Kysely.
- [src/import/saveAssessments.ts](src/import/saveAssessments.ts) migrated from Prisma to Kysely.
- Assessment rubric and submission type handling now use lowercase DB enum values directly (no uppercase conversion helpers).

7. Submission enum normalization is complete.
- `TEAM`/`INDIVIDUAL` usage in `src/*` has been switched to lowercase `team`/`individual`.
- Export and import paths now operate on lowercase submission enum values end-to-end.
- Remaining case conversion logic for submission type normalization was removed where no longer needed.

8. Prisma runtime client in application code is removed.
- [src/db/prisma.ts](src/db/prisma.ts) has been deleted.
- No Prisma runtime imports remain under `src/`.

9. Migration hardening verification from reset state is complete.
- Verified migration lifecycle using Kysely runner: `status -> down -> status -> up -> status`.
- Observed expected states for baseline migration `20260513000000_init` (`executed -> pending -> executed`).
- Regenerated DB types with [src/db/generated/db.ts](src/db/generated/db.ts) after re-apply.
- Re-ran validation: lint, typecheck, and tests all green.

10. Transitional rollback scaffolding has been reduced.
- Baseline down migration in [src/db/migrations/20260513000000_init.ts](src/db/migrations/20260513000000_init.ts) now drops only current snake_case objects.
- Removed legacy uppercase/Prisma-era fallback drops from the down path.
- Re-verified `status -> down -> up -> status` plus full validation after the cleanup.

11. Focused import/export parity checks have been expanded.
- Added export parity cases in [src/export/submissionExportCsv.test.ts](src/export/submissionExportCsv.test.ts) for:
  - team submitter identity resolution
  - missing individual submitter invariant
- Added import parity case in [src/import/importParsers.test.ts](src/import/importParsers.test.ts) for deterministic unique team submission IDs when normalized slugs collide.
- Re-validated targeted suites: `src/export/submissionExportCsv.test.ts` and `src/import/importParsers.test.ts` (12 tests passing).

### Added beyond original plan (unplanned but implemented)

1. Physical schema naming convention changed to snake_case.
- Baseline migration now creates snake_case tables and columns.
- Enum type identifiers were also converted to snake_case: rubric_type and submission_type.

2. Kysely CamelCasePlugin adoption.
- Runtime DB client now uses CamelCasePlugin so application code remains camelCase while the physical DB is snake_case.
- Implemented in [src/db/kysely.ts](src/db/kysely.ts).

3. Join table naming cleanup.
- Removed Prisma-style underscore naming and moved to explicit student_to_team physical table.
- Replaced opaque join column names with explicit student_id and team_id.

4. Numeric handling policy tightened.
- Added pg numeric parser override to parse numeric as number at runtime.
- Configured code generation to use numeric parser number.

5. Schema wrapper elimination and direct generated-types adoption.
- Removed [src/db/schema.ts](src/db/schema.ts) wrapper module.
- All Kysely client instances now use `DB` type from [src/db/generated/db.ts](src/db/generated/db.ts) directly.
- Application modules import required types directly from generated module.
- Eliminated one layer of indirection and made source of truth clear: generated types are the canonical DB interface.

6. Transitional rollback hardening in baseline down migration.
- Down migration currently drops both legacy and new object names to make repeated development resets reliable while naming converges.

### Current Prisma surface area remaining

1. No Prisma runtime usage remains under `src/`.
2. Prisma packages/scripts/config cleanup is complete:
- Prisma dependencies removed from [package.json](package.json).
- Prisma scripts removed from [package.json](package.json).
- Legacy Prisma CLI config removed.

### What is left to do

1. Test and performance completion criteria.
- Add/expand parity tests for assessment save/load paths (DB-integrated behavior).
- Add representative performance checks/profiling for imports and exports.
- Confirm lint, types, and tests remain green in CI after dependency cleanup.

### Recommended next execution order

1. Add DB-integrated assessment parity checks (save/load validation paths).
2. Add representative import/export performance profiling checks.
3. Finalize docs/runbook with any remaining operational notes.

## Current state (project-specific)

Primary remaining Prisma coupling is package-level only:

- None in runtime or package tooling.

Resolved pain points so far:

- Read paths no longer rely on Prisma in submissions, questions, and global progress.
- Export path now uses true streaming and no Prisma cursor extension.
- Student and question import writes now use set-based Kysely operations instead of per-row Prisma upserts.

## Target architecture

### 1) Data access boundary

Introduce a clear boundary:

- `src/db/kysely.ts`: Kysely connection and plugins.
- `src/db/generated/db.ts`: generated DB types (via `kysely-codegen`).
- Keep query modules in each feature directory with a flat structure (no nested repository layer), for example:
  - `src/db/*.ts`
  - `src/import/*.ts`
  - `src/export/*.ts`
  - `src/assessment/*.ts`

Application code (`app/*`, UI clients, import actions) should call feature module functions only, never raw DB client instances.

### 2) Type strategy

- Generate table/column types from the live schema using `kysely-codegen`.
- Keep domain DTOs in `src/db/types.ts` (or split per domain) to avoid leaking raw row shapes.
- Centralize numeric/decimal mapping in one helper layer instead of repeated per-file conversions.

### 3) SQL-first but type-safe

- Prefer Kysely query builder for composability and type safety.
- Use raw SQL (`sql```) when it materially improves performance/readability (bulk upsert, COPY/streaming, advanced CTEs).
- Every non-trivial query should have a quick `EXPLAIN (ANALYZE, BUFFERS)` validation during rollout.

## Migration strategy (strangler pattern)

Do not do a big-bang rewrite. Migrate domain by domain behind stable function signatures.

### Phase 0: Foundations

Deliverables:

- Add deps: `kysely`, `kysely-codegen`.
- Create `src/db/kysely.ts` using Postgres dialect + `pg` pool.
- Add scripts:
  - `db:types:generate` -> regenerate Kysely DB types
  - `db:check:plans` (optional) -> scripted EXPLAIN checks for critical queries
- Add DB observability guardrails:
  - query timing logs for slow query threshold
  - optional request correlation id

Acceptance criteria:

- App still runs unchanged on Prisma.
- Kysely client compiles and can execute a smoke query.

### Phase 0.5: Kysely migration files setup

Deliverables:

- Create migration folder for Kysely runtime migrations:
  - `src/db/migrations/`
- Add migration runner module:
  - `src/db/migrate.ts`
- Create one baseline migration file that represents the full current schema:
  - `src/db/migrations/0001_init.ts`
- Add scripts:
  - `db:migrate:up` -> run all pending Kysely migrations
  - `db:migrate:down` -> rollback one migration (dev only)
  - `db:migrate:status` -> print migration status

Migration file conventions:

- Baseline file: `YYYYMMDDHHmmss_init.ts`
- Follow-up files: `YYYYMMDDHHmmss_description.ts`
- Each file exports:
  - `up(db)`
  - `down(db)`
- Keep migrations SQL-explicit and idempotent where practical.
- Prefer `sql` blocks for advanced PostgreSQL features (triggers, check constraints, indexes with predicates).

Execution model:

- In dev/CI: run migrations before type generation.
- In production: run migrations as an explicit deployment step before app rollout.
- Keep migration logs and fail deploy on partial migration state.

Acceptance criteria:

- Empty database can be migrated to latest using Kysely migration files only.
- `YYYYMMDDHHmmss_init.ts` fully bootstraps schema without any Prisma migration dependency.
- Rollback of the latest migration is verified in development.

### Phase 1: Read-only endpoints first

Migrate low-risk read paths:

1. `src/db/submissions.ts`
2. `src/db/questions.ts`
3. `src/db/assessmentsProgress.ts`

Approach:

- Keep exported function signatures unchanged.
- Re-implement internals with Kysely.
- Validate result parity with snapshot-style tests and route-level smoke tests.

Acceptance criteria:

- No behavior change in UI.
- Query count and p95 latency equal or better than Prisma baseline.

### Phase 2: Export streaming (high-impact)

Migrate `src/db/submissionExport.ts` to Kysely + pg-native streaming.

Design:

- Build a deterministic ordered query (`ORDER BY submission.id`) selecting only export columns.
- Use cursor/streaming from `pg` (through pooled connection) to feed async generator rows.
- Preserve current CSV contract from `src/export/submissionExportCsv.ts`.

Expected gains:

- Lower peak memory during export.
- Better throughput and reduced GC pressure on large datasets.

Acceptance criteria:

- Constant-memory behavior verified on large fixture.
- Output parity with current CSV tests.

### Phase 3: Write paths and bulk upsert (highest-impact)

Migrate import write paths:

1. `src/import/saveStudents.ts`
2. `src/import/saveQuestions.ts`
3. `src/import/saveAssessments.ts`
4. `src/db/assessments.ts` (single-save path)

Key changes:

- Replace per-row upsert loops with batched statements.
- Use `INSERT ... ON CONFLICT (...) DO UPDATE` in chunked batches.
- Use transaction-scoped staging tables for very large imports when needed.

Bulk upsert pattern (example):

```sql
INSERT INTO student (id, family_name, first_name)
VALUES (...), (...), ...
ON CONFLICT (id)
DO UPDATE SET
  family_name = EXCLUDED.family_name,
  first_name = EXCLUDED.first_name;
```

For associative/typed rubric tables:

- Batch parent rows first.
- Batch child typed rows second.
- Delete obsolete child rows in bounded set-based statements (not per-row deletes).

Acceptance criteria:

- Import throughput materially improved (target: at least 3x faster on representative fixtures).
- Transaction integrity preserved with rollback on failure.
- Error reporting remains row/action understandable.

### Phase 4: Prisma removal

After all domains are migrated and stable:

- Remove Prisma runtime dependencies from app code:
  - `@prisma/client`
  - `@prisma/adapter-pg`
  - `prisma-cursorstream`
- Delete `src/db/prisma.ts`.
- Update docs/scripts in `README.md`.

Important note on migrations:

- We do not carry forward Prisma migration history.
- Kysely `0001_init.ts` is the new schema baseline.
- All future schema changes are additive Kysely migrations after `0001_init.ts`.

Cutover guardrails for migration files:

- Never mix Prisma and Kysely migration creation; Prisma migrations are considered legacy only.
- One migration owner per PR to avoid drift.
- CI must validate:
  - migration apply from empty DB
  - migration status is clean after apply
  - generated Kysely types are up to date

## Performance plan

## Baseline before changes

Capture before/after metrics for:

- import duration by file size (students/questions/assessments)
- export duration and peak memory
- query count per request on grading pages
- slowest SQL statements (top N)

## Planned optimizations

1. Bulk upsert

- Chunk size tuning (start 500-2000 rows/chunk depending on row width).
- Single statement per entity per chunk.
- Avoid row-by-row `await` loops.

2. Streaming export

- Backpressure-aware async iterator.
- No full result materialization in memory.
- Fetch size tuning based on row width.

3. Query shaping

- Select minimal columns only.
- Push aggregation into SQL where practical.
- Add/verify indexes for ON CONFLICT keys and common join/filter keys.

## Quality and safety

## Test strategy

- Keep existing unit tests green.
- Add parity tests for every migrated feature module function:
  - same inputs -> same outputs
  - deterministic ordering where expected
- Add large-fixture performance tests for import/export paths.

## Rollout strategy

- Introduce per-domain feature flags:
  - `DB_IMPL=submissions:kysely,questions:prisma,...`
- Allow immediate fallback to Prisma implementation during rollout.
- Roll out in production-like env with shadow verification where possible.

## Risks and mitigations

1. Type drift between DB schema and generated types

- Mitigation: run `db:types:generate` in CI and fail on diff.

2. Decimal/number precision regressions

- Mitigation: central conversion policy and precision tests around numerical rubrics.

3. Behavior drift in complex rubric logic

- Mitigation: parity tests against fixtures for boolean/ordinal/numerical branches.

4. Transaction deadlocks under concurrent imports

- Mitigation: stable write ordering, chunking, retry policy on serialization/deadlock errors.

## Suggested implementation order

1. Foundation (`kysely.ts`, generated types, scripts)
2. Read-only feature modules
3. Export streaming
4. Bulk-upsert import paths
5. Final cleanup and Prisma dependency removal

## Definition of done

Migration is complete when:

- All application runtime queries use Kysely/pg paths.
- Prisma runtime client is not imported anywhere in `src/`.
- Import/export performance targets are met.
- Test suite, type checks, and lint/check pass.
- Runbook documents rollback and operational troubleshooting.

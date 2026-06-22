# Project Reliability Audit and Test Tracker

Status: Active
Last Updated: 2026-06-22 (R-010 promoted to Verified, closing out Tier 1; milestones M4/M5 closed — see Change Log)
Primary Goal: Prevent data loss/corruption (especially assessments) while progressively hardening correctness and UX safety.
Cadence: Update at least once per week and after every reliability-related merge.

## 1. How to Use This Document

This file is a living audit and delivery tracker. Update it whenever:
- A new risk is discovered.
- An issue status changes.
- A mitigation lands in code.
- Tests are added/updated.

**GitHub Issue Linkage:** Each risk in Section 4 has a corresponding GitHub issue (visible in the Issue # column). These are the canonical tracking references for implementation work. Update this document and the GitHub issues in sync.

Update workflow for each issue:
1. Add or update issue entry in Section 4 (Risk Register).
2. Link concrete evidence (file + symbol/function or SQL trigger).
3. Define acceptance tests in Section 6.
4. Update progress counters in Section 3.
5. Add an entry to Section 9 (Change Log).
6. Link the related GitHub issue number in the Issue # column.
7. When opening a PR for the mitigation, include an auto-close keyword in the PR body (for example: `Fixes #<issue>`), so the linked issue is closed automatically on merge.

Weekly maintenance ritual:
1. Refresh Section 3 dashboard counts and active sprint focus.
2. Re-score each Open/In Progress risk in Section 4 using Section 2.1.
3. Promote completed work to Verified only when test evidence is linked.
4. Move deferred items to explicit Accepted status with rationale and revisit date.

## 2. Severity and Status Definitions

Severity:
- Tier 0: Data loss/corruption or cross-project contamination.
- Tier 1: Wrong grades/totals/progress/export values.
- Tier 2: UX/operational regressions (errors, recoverability, routing, messaging).

Status:
- Open: Confirmed risk; no mitigation implemented.
- In Progress: Mitigation work started.
- Mitigated: Code changes landed, tests not fully complete.
- Verified: Mitigation + required tests passing.
- Accepted: Intentionally accepted risk with explicit rationale.

### 2.1 Prioritization Score

Use this to rank issues inside each tier:
- Impact (1-5): Data integrity and user/business impact if the bug occurs.
- Likelihood (1-5): How likely this is to happen in normal operation.
- Detectability (1-5): How hard it is to detect quickly (5 means hard to detect).

Priority Score = Impact x Likelihood x Detectability

Interpretation:
- 80-125: Urgent
- 40-79: High
- 20-39: Medium
- 1-19: Low

Note: Tier still dominates score. A Tier 0 item is always prioritized above Tier 1/2 unless explicitly accepted.

## 3. Audit Dashboard

Current snapshot (2026-06-22):
- Tier 0: 0 open, 0 in progress, 0 mitigated, 6 verified
- Tier 1: 0 open, 0 in progress, 7 verified
- Tier 2: 4 open, 0 in progress, 0 verified

Overall issue status:
- Total tracked risks: 17
- Verified: 13/17
- Remaining: 4/17

Current sprint focus:
- Sprint label: Reliability Sprint A — complete (all six Tier 0 items Verified with merge-blocking `ci-status`); Tier 1 — complete (all seven items Verified)
- Remaining scope: R-012, R-013, R-014, R-015 (Tier 2)
- Exit criteria: Tier 2 action/route/UX error contracts covered by tests

Critical policy decisions confirmed:
- Import atomicity: Fully atomic (all-or-nothing).
- Concurrent grading writes: last-write-wins is the current behavior, not a locked-in policy. A multi-user concurrency policy (optimistic locking vs. pulling server changes into the client) is deferred to multi-user workflow. R-004 proves write-path integrity under concurrent in-flight saves; it does not enshrine last-write-wins.

Immediate execution recommendation:
1. Implement R-016 first to establish merge-blocking CI guardrails.
2. Implement remaining Tier 0 items.
3. Follow immediately with Tier 1.
4. Then complete Tier 2 action/UX hardening.

## 4. Risk Register (Living)

| ID | Tier | Score | Area | Risk | Evidence | Status | Issue # | Owner | Target | Test Evidence | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R-001 | Tier 0 | 100 | Import / Assessments | Assessment import can persist partial writes before reporting failure. Violates all-or-nothing policy. | src/import/prepareAssessmentImport.ts (pure plan with Blocking Diagnostics), src/import/assessmentImportContext.ts, src/import/saveAssessments.ts (single transaction: load context → prepare → write) | Verified | [#17](https://github.com/QuentinRoy/grading/issues/17) | Unassigned | Sprint A | `src/import/prepareAssessmentImport.test.ts`: pure-plan unit coverage for unmatched/ambiguous submissions, invalid values, unknown columns, ignored columns, overwrites; `src/import/saveAssessments.integration.test.ts`: `saveAssessments does not persist valid rows when a later row fails validation`, `saveAssessments rejects unknown columns before writing any assessment`, `saveAssessments blocks the import when a row has no matching submission` (2026-06-10 behavior change: unmatched submissions now block instead of being silently skipped), `saveAssessments rolls back all writes if a later transactional write fails`, `saveAssessments returns imported and overwritten counts`; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration`; CI: `test-integration` is a required branch-protection check on `main` (R-016 audit) and runs this suite on every PR — green on `main` as of 2026-06-10, with PR #146 carrying the current test names | None — monitor via the required `test-integration` check; keep evidence in sync if the import suite moves. |
| R-002 | Tier 0 | 80 | Data integrity constraints | Strong DB triggers/checks exist but are under-tested in integration suites. | src/db/migrations/20260513000000_init.ts, src/db/migrations/20260514000001_enforce_numerical_score_bounds.ts, src/db/migrations/20260514000002_enforce_ordinal_label_valid.ts | Verified | [#18](https://github.com/QuentinRoy/grading/issues/18) | Unassigned | Sprint A | `src/db/constraints.integration.test.ts`: `ordinal rubric assessments accept valid labels and roll back failed transactional writes`, `numerical rubric assessments enforce score bounds and roll back failed transactional writes`, `submission owner/type check rejects invalid rows and rolls back transactional writes`, `rubric subtype triggers reject mismatched subtype rows and roll back transactional writes`; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration` (21 tests passing) | Confirm `constraints.integration.test.ts` covers the post-audit identifier constraints (row_id rekey uniqueness from `20260518000001_rekey_question_and_rubric`; project id/row_id split and FK rebuild from `20260527000000_normalize_project_identifiers`); keep test evidence current if constraints coverage moves. |
| R-003 | Tier 0 | 75 | Questions/rubrics mutation | saveQuestionDefinitionInDb contains complex delete/reinsert/reconcile logic with limited direct integration coverage; high chance of subtle data breakage. | src/questions/questionDefinitionMutations.ts, src/questions/questionDefinitions.ts | Verified | [#19](https://github.com/QuentinRoy/grading/issues/19) | Unassigned | Sprint A | `src/questions/questionDefinitionMutations.integration.test.ts`: `saveQuestionDefinitionInDb renames question id while preserving linked assessments`, `saveQuestionDefinitionInDb replaces rubric subtype data when rubric type changes`, `saveQuestionDefinitionInDb removes stale rubrics that are no longer referenced`, `saveQuestionDefinitionInDb replaces ordinal rubric values using the provided label set`, `deleteQuestionDefinitionInDb reports deletion and cascades linked assessments`; `src/questions/questionDefinitions.integration.test.ts`: `getQuestionDefinitionDeleteImpactFromDb reports the linked assessment count`, `getQuestionDefinitionDeleteImpactFromDb reports zero for an unassessed question` (counts `assessment.id` explicitly to avoid ambiguous-column failures under joins); local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration` | None — keep test evidence current if questions integration coverage moves. |
| R-004 | Tier 0 | 64 | Concurrency | Write paths are not proven to stay corruption-free under concurrent in-flight saves (single-user optimistic UI today; multi-user later). No thrown errors, no duplicate/partial rows, and surviving values must be one of the submitted inputs. Last-write-wins is current behavior, not an enshrined policy. | src/assessments/assessmentMutations.ts (`saveAssessmentInDb` — shared by interactive grading and assessment import), src/import/saveStudents.ts (`saveStudentImportPlanInDb`), src/import/saveQuestions.ts (`saveQuestionImportPlanInDb`) | Verified | [#20](https://github.com/QuentinRoy/grading/issues/20) | Unassigned | Sprint B | `src/assessments/assessmentMutations.integration.test.ts`: forced-interleaving tests via Kysely controlled transactions with a `pg_stat_activity` lock-wait barrier (`src/test/concurrency.ts`) for `saveAssessmentInDb` — Scenario A (same rubric, last-write-wins, no torn/blended value) and Scenario B (same question, different rubrics, both coexist), plus a `saveAssessment` wrapper smoke test under naive `Promise.all` parallelism; `src/import/saveStudents.integration.test.ts` and `src/import/saveQuestions.integration.test.ts`: lighter overlap-invariant forced-interleaving tests for `saveStudentImportPlanInDb` (studentToTeam delete-then-reinsert race) and `saveQuestionImportPlanInDb` (rubric delete-then-recreate race), asserting row-level integrity without asserting drift-prone counts. All three primitives were already correct under READ COMMITTED — confirmed test-and-fix by temporarily reverting each guard (`ON CONFLICT DO NOTHING` on the assessment grouping insert, the `studentToTeam` delete, the rubric recreate delete) and observing each test fail; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration` (84 tests passing) | None — keep test evidence current if these modules move. |
| R-005 | Tier 0 | 90 | Project isolation | Project scoping exists but needs stronger adversarial fixtures to prove no cross-project contamination across duplicated external IDs. | src/submissions/submissions.ts, src/assessments/loadAssessmentCompletion.ts, src/import/saveStudents.ts | Verified | [#21](https://github.com/QuentinRoy/grading/issues/21) | Unassigned | Sprint A | `src/submissions/submissions.integration.test.ts`: `loadSubmissionsFromDb returns only individual submissions for the requested project when student ids collide across projects`, `loadSubmissions returns only team submissions for the requested project when team names collide across projects`; `src/assessments/loadAssessmentCompletion.integration.test.ts`: `loadAssessedRubricCountsBySubmissionFromDb counts only assessments within the requested project when question ids collide across projects`, `loadAssessmentCompletionBySubmissionFromDb counts only questions and assessments within the requested project when question ids collide across projects`; `src/import/saveAssessments.integration.test.ts`: `saveAssessments links assessments only to the target project even when the same student id exists in another project`; local verification: `pnpm run check-types`, `pnpm run check --fix`, `pnpm run test:integration` | None — keep test evidence current if these suites move. |
| R-006 | Tier 1 | 60 | Export correctness | Streamed submission export assembly has complex state transitions; gaps may produce wrong rows/totals/order in edge cases. | src/export/submissionExport.ts, src/export/submissionExportGrouping.ts, src/export/submissionExportCsv.ts | Verified | [#32](https://github.com/QuentinRoy/grading/issues/32) | Unassigned | Sprint B | `plans/completed/2026-06-11-submission-export-internals.md`: `src/export/submissionExportGrouping.test.ts` covers stream boundaries (single-submission group, multi-submission boundary detection, last-group flush, empty input), value classification (boolean/ordinal/numerical, sparse assessments with null questionId/rubricId), and input-order preservation across submissions; `src/export/submissionExportCsv.test.ts` covers header/record ordering, sparse record values with question/grand totals, and submission-type invariants; `src/export/submissionExport.integration.test.ts` snapshots end-to-end CSV output for mixed rubric types and submission states through the ADR 0007 `{ db = defaultDb }` seam; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm test src/export/` (29 tests) | None — issue #32 closed 2026-06-22 (resolved by #152); keep test evidence current if the export suite moves. |
| R-007 | Tier 1 | 72 | Progress metrics | Submission/global progress aggregates are business-critical and under-covered against edge combinations (zero-rubric questions, sparse assessments). | src/assessments/assessmentCompletion.ts (pure builder), src/assessments/loadAssessmentCompletion.ts (loaders + primitive) | Verified | [#24](https://github.com/QuentinRoy/grading/issues/24) | Unassigned | Done | `plans/completed/2026-06-11-assessment-completion-consolidation.md`: `assessmentCompletion.test.ts` covers tracer/partial/zero-rubric/vacuous (no-submissions, no-questions)/robustness cases for `buildAssessmentCompletion`; `loadAssessmentCompletion.integration.test.ts` pins zero-rubric-question completion and empty-project vacuous aggregates through `loadAssessmentCompletionRowsFromDb`; `assessmentSummary.test.ts` covers the client-side zero-rubric counting; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm test:unit assessmentCompletion assessmentSummary`, `pnpm test src/assessments/` | None — closed by PR #153 (2026-06-11); keep evidence in sync if these modules move. |
| R-008 | Tier 1 | 45 | Rubric overview analytics | Class/rubric averages and completion percentages can drift if aggregation assumptions change; coverage is partial. | src/assessments/loadRubricOverview.ts (loader + primitive), src/assessments/rubricOverviewBuilder.ts (pure builder) | Verified | [#26](https://github.com/QuentinRoy/grading/issues/26) | Unassigned | Sprint C | `plans/completed/2026-06-22-rubric-overview-projection-extraction.md`: extracted `loadRubricAssessmentRecordsFromDb` (ADR 0007 primitive/wrapper shape, `db` test seam) plus `rubricOverviewCacheTags()`, with `loadRubricOverview.test.ts` (cache tags) and `loadRubricOverview.integration.test.ts` (all three rubric types' value-column mapping, project isolation); `rubricOverviewBuilder.test.ts` expanded with duplicate-record skip, per-type null-field, unknown-id, and mixed-rubric-type-distribution coverage; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm test:unit rubricOverviewBuilder loadRubricOverview`, `pnpm test src/assessments/loadRubricOverview.integration.test.ts` | None — keep evidence in sync if these modules move. |
| R-009 | Tier 1 | 54 | Import/export roundtrip | Export includes both assessment and marks columns; import behavior may diverge if only marks columns are present. | src/export/submissionExportCsv.ts, src/import/prepareAssessmentImport.ts, src/import/parseAssessments.ts | Verified | [#27](https://github.com/QuentinRoy/grading/issues/27) | Unassigned | Sprint B | Implemented per `plans/completed/2026-06-22-r009-import-export-roundtrip-contract.md` (grilled via `/grill-with-docs`): `AssessmentImportBlockingDiagnostic` gained a `no-assessment-columns` variant, detected in `prepareAssessmentImport` whenever the header has zero columns matching a project rubric (covers marks-only files and the empty-CSV degenerate case), surfaced by `saveAssessments.ts`'s `formatBlockingDiagnostic`. `src/import/prepareAssessmentImport.test.ts` adds marks-only-header-blocks, empty-CSV-blocks, and assessment-column-with-no-values-does-not-block cases. New `src/import/assessmentImportRoundtrip.integration.test.ts` exports a seeded project via `createCsvSubmissionExport`, re-imports the CSV through `parseAssessmentsCsv` → `loadAssessmentImportContextFromDb` → `prepareAssessmentImport`, and asserts the plan: full export and assessment-only export reproduce the seeded values exactly with zero blocking diagnostics; marks-only export blocks with `no-assessment-columns` and writes nothing. local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm vitest run --project=unit --project=integration src/import/` (48 tests passing) | None — keep test evidence current if the import suite moves. |
| R-010 | Tier 1 | 24 | Numerical rubric math | `markNumericalRubric` was an inconsistent mix of computation and validation: it silently returned `NaN`/`Infinity` for a zero-width score range while throwing on inverted ranges and out-of-range scores that are actually computable. Grilling (`/grill-with-docs`, 2026-06-22) reshaped the fix into making the marking function a pure computer and closing the editor/DB gaps that made the removed throws safe to drop. | src/rubrics/rubric.ts (`markNumericalRubric`), src/rubrics/rubric.test.ts, src/questions/schemas.ts (`questionDefinitionSchema` superRefine), src/questions/schemas.test.ts, src/db/migrations/20260622000000_enforce_numerical_rubric_bounds.ts, src/db/constraints.integration.test.ts | Verified | [#23](https://github.com/QuentinRoy/grading/issues/23) | Unassigned | Sprint C | `src/rubrics/rubric.test.ts`: `markNumericalRubric` now throws only on a zero-width score range (`minScore === maxScore`), and returns the finite value for inverted ranges, out-of-range/extrapolated scores, and inverted marks (behavior change, confirmed via TDD red/green per `plans/completed/2026-06-22-numerical-rubric-bounds.md`); `src/questions/schemas.test.ts`: `questionDefinitionSchema` rejects `minScore >= maxScore` (`rubrics.<i>.maxScore`) and `minMarks > maxMarks` (`rubrics.<i>.maxMarks`), accepts flat-marks and valid cases; `src/db/constraints.integration.test.ts`: new `numerical_rubric_score_range_check` and `numerical_rubric_marks_range_check` CHECK constraints (migration `20260622000000_enforce_numerical_rubric_bounds.ts`) reject collapsed/inverted ranges and inverted marks with transactional rollback. Each GREEN change was confirmed by reverting it and observing its RED test fail, then restoring. Import zod (`src/import/schemas.ts`) already enforced both rules and was left unchanged. `CONTEXT.md` gained the `Numerical Rubric Bounds` glossary entry. local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm test:unit rubric schemas`, `pnpm test src/db/` | None — keep test evidence current if these modules move. |
| R-011 | Tier 1 | 48 | Question/rubric saves | Save paths for imported questions need tests on ID collisions, type transitions, and ordinal value replacement semantics. | src/import/prepareQuestionImport.ts (pure plan with Blocking Diagnostics), src/import/questionImportContext.ts, src/import/saveQuestions.ts (single transaction: load context → prepare → write) | Verified | [#25](https://github.com/QuentinRoy/grading/issues/25) | Unassigned | Sprint B | `src/import/prepareQuestionImport.test.ts`: pure-plan unit coverage for question/rubric upserts, rubric type changes blocked when assessments are linked, rubric type changes allowed and reported when no assessments are linked, and rubric id collisions across questions; `src/import/saveQuestions.integration.test.ts`: `saveQuestions blocks a rubric type change when the rubric has linked assessments` (2026-06-10 behavior change: previously the rubric was silently deleted and recreated, cascading away assessments), `saveQuestions allows a rubric type change when the rubric has no linked assessments`, `saveQuestions blocks an imported rubric id that already belongs to another question`, plus the existing project-isolation and upsert suites; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration` | None — issue #25 closed 2026-06-22 (resolved by #147); monitor via the required `test-integration` check; keep evidence in sync if the import suite moves. |
| R-012 | Tier 2 | 40 | Server action contracts | Question/import/grading actions need explicit tests for actionable error messaging and controlled failure paths. The interactive-grading action `saveAssessment` is a bare `"use server"` passthrough that re-throws DB/pool errors to the client with no recovery path. | src/questions/actions.ts, src/import/*ImportAction.ts, src/import/actionUtils.ts, src/assessments/saveAssessment.ts | Open | [#31](https://github.com/QuentinRoy/grading/issues/31) | Unassigned | Sprint C | Pending | Add action tests covering parse, validation, and infrastructure errors; wrap `saveAssessment` with actionable-error/recovery shaping (it currently re-exports `assessmentMutations.saveAssessment` directly) and cover it. |
| R-013 | Tier 2 | 24 | UI optimistic save behavior | Assessment session optimistic updates and rollback/pending accounting are not explicitly tested. | src/assessments/useAssessmentSession.ts | Open | [#30](https://github.com/QuentinRoy/grading/issues/30) | Unassigned | Sprint C | Pending | Add hook/component tests for success/failure ordering and pending counter integrity. |
| R-014 | Tier 2 | 27 | Export routes API behavior | Route response contracts (404/400/200, headers, filenames) need route-level tests. | app/projects/[projectId]/[projectSlug]/export/questions/route.ts, app/projects/[projectId]/[projectSlug]/export/submissions/route.ts | Open | [#28](https://github.com/QuentinRoy/grading/issues/28) | Unassigned | Sprint C | Pending | Add route tests for status and headers under valid/invalid conditions. |
| R-015 | Tier 2 | 20 | Operational signal quality | Some paths surface generic errors; consistency of user-recoverable guidance should be tested and standardized. | app/projects/page.tsx, src/import/actionUtils.ts | Open | [#29](https://github.com/QuentinRoy/grading/issues/29) | Unassigned | Sprint C | Pending | Add contract checks for actionable, non-internal error text and recovery guidance. |
| R-016 | Tier 0 | 100 | Delivery pipeline / CI | GitHub CI integration is not yet defined as a required reliability gate; critical regressions could merge without automated checks. | package.json scripts (`test:unit`, `test:integration`, `check-types`, `check`), reliability goals in this audit, .github/workflows/ci.yml, src/test/dbIntegration.ts | Verified | [#22](https://github.com/QuentinRoy/grading/issues/22) | Unassigned | Sprint A | `.github/workflows/ci.yml` runs `check-types`, `check`, `test-unit`, `test-integration`, `test-storybook`, `build`, and `e2e` on pull_request/push to `main`, then fans into a single `ci-status` job that fails if any of them didn't succeed; integration Postgres is now provisioned via Testcontainers in CI and locally (PR #203), so the prior `TEST_DB_BACKEND=external` service-container path is gone; local verification: `pnpm run check-types`, `pnpm run check`, `pnpm run test:unit`, `pnpm run test:integration`; branch protection audit (2026-06-22, re-checked via `gh api repos/.../branches/main/protection`): the only required status check on `main` is `ci-status`, which itself requires `changes`, `check-types`, `check`, `test-unit`, `test-integration`, `test-storybook`, `build`, `e2e`. | Monitor required-check drift and keep branch protection aligned with CI workflow changes. Issue #22 is now closed (its stale auto-generated body had referenced a nonexistent `src/ci/branchProtection.ts`). |
| R-017 | Tier 1 | 48 | Cache invalidation correctness | Stale cache after a mutation could show wrong grades/progress/overview values. Tag-based invalidation (ADR 0008) governs read freshness across grading, import, and question edits. | src/db/cacheTags.ts, src/db/cacheInvalidation.ts, docs/reference/cache-invalidation-map.md | Verified | [#59](https://github.com/QuentinRoy/grading/issues/59) | Unassigned | Done | `src/db/cacheTags.test.ts`, `src/db/cacheInvalidation.test.ts` (tag factories + `updateTag`/`revalidateTag` semantics); mutation integration suites assert emitted tags (`src/assessments/assessmentMutations.integration.test.ts`, `src/import/saveAssessments.integration.test.ts`, `src/import/saveQuestions.integration.test.ts`, `src/import/saveStudents.integration.test.ts`, `src/questions/questionDefinitionMutations.integration.test.ts`); owned by `plans/completed/2026-06-17-caching-loading-hardening.md` and ADR 0008 (umbrella issue #59, closed). | None — cross-referenced from the completed caching plan; keep tag/invalidation evidence current if `cacheTags.ts`/`cacheInvalidation.ts` move. |

Notes:
- Score values are initial estimates and must be re-evaluated each weekly update.
- Target sprint labels are planning placeholders and should be replaced with actual iteration names/dates.

## 5. Existing Coverage Inventory (Baseline)

Currently present tests (not exhaustive for critical paths):
- src/db/assessments.integration.test.ts
- src/db/constraints.integration.test.ts
- src/db/questions.integration.test.ts
- src/import/saveStudents.integration.test.ts
- src/import/importParsers.test.ts
- src/export/submissionExportCsv.test.ts
- src/export/questionsExport.test.ts
- src/db/rubricOverview.test.ts
- src/submissions/quickJumpSearch.test.ts
- src/rubrics/rubric.test.ts

Notably under-covered critical modules:
- src/import/saveAssessments.ts
- src/import/saveQuestions.ts
- src/export/submissionExport.ts
- src/db/submissionProgress.ts
- src/db/assessmentsProgress.ts
- src/questions/actions.ts
- app/projects/[projectId]/[projectSlug]/export/*/route.ts
- src/assessment/useAssessmentSession.ts

## 6. Required Test Backlog by Priority

### Tier 0 Required Tests (blocker)

1. GitHub CI required reliability gates
- Target: .github/workflows/*
- Scenarios:
  - pull_request runs required checks (check-types, check, test:unit, test:integration)
  - failing checks block merge via branch protection
  - path/trigger rules include reliability-critical code paths
  - integration suite provisions Postgres via Testcontainers locally and in CI (the external service-container backend was removed in #203)

2. Atomic assessment import rollback
- Target: src/import/saveAssessments.ts
- Scenarios:
  - mixed valid + invalid rows => no writes persisted
  - unknown column => no writes persisted
  - write-phase transactional failure => no writes persisted

3. DB invariant enforcement
- Targets: migration triggers/checks
- Scenarios:
  - invalid ordinal label insert/update rejected
  - out-of-bounds numerical score rejected
  - submission owner/type check rejected
  - rubric subtype table mismatch rejected

4. saveQuestionDefinitionInDb data safety matrix
- Target: src/questions/questionDefinitionMutations.ts
- Scenarios:
  - rename with existing assessments
  - rubric type change with existing assessments
  - stale rubric cleanup
  - delete question impact and cascade behavior

5. Concurrency behavior (last write wins)
- Targets: src/assessments/assessmentMutations.ts and import save modules
- Scenarios:
  - concurrent writes on same rubric assessment
  - concurrent overlapping imports in same project

6. Cross-project isolation adversarial fixtures
- Targets: save/load paths across submissions, progress, import
- Scenarios:
  - duplicated student IDs/team names/rubric IDs across projects remain isolated

### Tier 1 Required Tests

1. Export streaming correctness
- Target: src/export/submissionExport.ts
- Scenarios:
  - submission boundary flushes
  - sparse assessments
  - ordering stable by submission/assessment/rubric

2. Progress aggregation correctness
- Targets: src/assessments/loadAssessmentCompletion.ts, src/assessments/assessmentCompletion.ts
- Scenarios:
  - zero-rubric questions
  - partial completion
  - over-count guard behavior

3. Roundtrip contract
- Targets: export + import assessment flows
- Scenarios:
  - exported assessment columns re-import without semantic drift
  - marks-only files treated explicitly per contract

4. Rubric math boundaries
- Target: src/rubrics/rubric.ts
- Scenarios:
  - min/max boundaries
  - reversed interpolation boundaries
  - invalid ranges and explicit failures

### Tier 2 Required Tests

1. Action and error contract tests
- Targets: src/questions/actions.ts, src/import/actionUtils.ts, import actions

2. Export route tests
- Targets: app/projects/[projectId]/[projectSlug]/export/*/route.ts

3. Assessment UI state management tests
- Target: src/assessments/useAssessmentSession.ts

## 7. Refactor Candidates to Improve Testability

These are behavior-preserving refactors intended only to make tests deterministic and reduce risk:
- ~~Extract pure normalization/validation phase from src/import/saveAssessments.ts.~~ Done 2026-06-10: `prepareAssessmentImport` (pure plan) + `loadAssessmentImportContextFromDb` + `saveAssessmentImportPlanInDb`; see `docs/design/2026-06-10-import-parse-prepare-write-seams.md`. Questions (#147) and students (#148) flows followed the same parse → prepare → write pattern.
- ~~Separate export stream state machine steps in src/export/submissionExport.ts.~~ Done 2026-06-11 (#152): extracted `src/export/submissionExportGrouping.ts`; request-option parsing now lives in the route layer. See `plans/completed/2026-06-11-submission-export-internals.md`.
- ~~Introduce shared DB fixture builders for project/question/rubric/submission/assessment setup.~~ Done: `src/test/projects.ts`, `src/test/questions.ts`, `src/test/assessments.ts`, plus the `src/test/dbIntegration.ts` harness.
- Add small domain helpers for repeated aggregate logic to reduce brittle integration-only verification.

## 8. Definition of Done by Tier

Tier 0 issue is Done when:
1. Risk has a code mitigation or explicit architectural guard.
2. Integration tests prove failure modes and rollback behavior.
3. Cross-project contamination checks pass where relevant.
4. Issue status is set to Verified with linked test file(s).

Tier 1 issue is Done when:
1. Correctness math/aggregation assertions exist for boundary cases.
2. Contract tests cover import/export or reporting outputs.
3. Regression tests fail when invariant is intentionally broken.
4. Issue status is Verified.

Tier 2 issue is Done when:
1. User-facing error/recovery behavior is tested.
2. No internal framework control-flow errors are surfaced.
3. Route/action/component contracts are covered by tests.
4. Issue status is Verified.

## 9. Progress Tracker

### Milestones
- [x] M0: Baseline completed (coverage inventory + issue register frozen for first execution cycle)
- [x] M1: GitHub CI reliability gates implemented (R-016)
- [x] M2: Tier 0 tests implemented
- [x] M3: Tier 0 verified in CI
- [x] M4: Tier 1 tests implemented
- [x] M5: Tier 1 verified in CI
- [ ] M6: Tier 2 tests implemented
- [ ] M7: Tier 2 verified in CI

### Execution Log
- 2026-05-17: Initial deep audit completed. Risks R-001..R-015 registered.
- 2026-05-17: Migrated integration tests to shared `test.extend` fixtures (`src/test/integrationTest.ts`) across assessment import/student/assessment DB suites; targeted reliability tests pass.
- 2026-05-17: Implemented GitHub Actions CI workflow (`.github/workflows/ci.yml`) with separate required-candidate jobs: `check-types`, `check`, and `test-unit` on pull requests and pushes to `main`.
- 2026-05-18: Added `test-integration` GitHub Actions job with a Postgres service and backend-switching integration helpers (`TEST_DB_BACKEND=external`) while keeping local default integration backend on Testcontainers.
- 2026-05-18: Refactored `src/import/saveAssessments.ts` to batch submission resolution and keep all writes in one transaction; expanded `src/import/saveAssessments.test.ts` with unknown-column and forced write-phase rollback coverage. Local reliability checks pass (`check`, `check-types`, `test:integration`).
- 2026-05-18: Audited GitHub `main` branch protection via GitHub API and confirmed strict required status checks enforce `build`, `test-integration`, `test-storybook`, `test-unit`, `check`, and `check-types` before merge.
- 2026-05-18: Implemented R-002 constraint hardening integration suite (`src/db/constraints.integration.test.ts`) covering ordinal label validity, numerical score bounds, submission participant/type check, and rubric subtype mismatch with transactional rollback assertions; local reliability checks pass (`check --fix`, `check-types`, full `test:integration` with 21 passing tests).
- 2026-05-18: Implemented R-003 mutation hardening integration suite (`src/db/questions.integration.test.ts`) covering question rename with linked assessments, rubric type transitions, stale rubric cleanup, ordinal value replacement semantics, and delete impact/cascade behavior. Fixed `getQuestionDeleteImpact` to count `assessment.id` explicitly and avoid ambiguous-column failures in joined queries. Local reliability checks pass (`check --fix`, `check-types`, full `test:integration` with 26 passing tests).
- 2026-06-10: Restructured the assessment import around parse → load context → prepare → write seams (`docs/design/2026-06-10-import-parse-prepare-write-seams.md`, PR 1 of the seams plan). New pure `prepareAssessmentImport` builds an Import Plan with Blocking Diagnostics, Ignored Columns, and overwrite detection; unmatched submissions now block the import instead of being silently skipped (behavior change). Success path reports overwrite counts. Unit suite covers the plan; integration suite stays green with the flipped unmatched-submission test. R-001 promoted to Verified (required `test-integration` check green in CI).

## 10. Change Log

- 2026-05-17: Created initial living audit with severity taxonomy, risk register, and test backlog.
- 2026-05-17: Added prioritization score model, ownership/target fields, definition-of-done criteria, and weekly maintenance ritual.
- 2026-05-17: Added R-016 for GitHub CI integration as a Tier 0 high-priority blocking task and promoted CI gating to first execution step.
- 2026-05-17: Added reusable integration test fixtures and migrated `src/import/saveAssessments.test.ts`, `src/import/saveStudents.test.ts`, and `src/db/assessments.test.ts` to reduce boilerplate and improve consistency.
- 2026-05-17: Added GitHub Actions workflow at `.github/workflows/ci.yml` to run `check-types`, `check`, and `test:unit` on pull requests and pushes to `main`; marked R-016 as Mitigated pending branch protection enforcement.
- 2026-05-18: Split Vitest into `unit` and `integration` projects, added `test:integration`, introduced a backend-aware DB integration helper (`testcontainers` local default, `external` for CI), and wired `.github/workflows/ci.yml` `test-integration` to GitHub Actions Postgres service.
- 2026-05-18: Created GitHub issues for all 16 risks (R-001..R-015, R-016) matching audit register. Issue numbers linked in Risk Register table. Added GitHub Issue Linkage guidance in Section 1.
- 2026-05-18: Implemented first R-001 hardening pass: `saveAssessments` now preloads submission mappings in batch and retains single-transaction writes; added integration assertions for unknown header rejection and write-phase rollback atomicity.
- 2026-05-18: Verified R-016 by confirming `main` branch protection enforces strict required checks (`build`, `test-integration`, `test-storybook`, `test-unit`, `check`, `check-types`); updated dashboard counts and marked M0 complete.
- 2026-05-18: R-005 Verified — added two-project collision integration tests: `src/db/submissions.integration.test.ts` (individual + team submission isolation), `src/db/submissionProgress.integration.test.ts` (`loadSubmissionQuestionProgress` + `loadSubmissionOverviewProgress` isolation), and `src/import/saveAssessments.integration.test.ts` (assessment import doesn't leak into sibling project with same student external id); all 9 new tests pass locally.
- 2026-05-18: Issue #54 parity update — removed Testcontainers backend switching from integration bootstrap and standardized on `TEST_DATABASE_URL` for all environments. Added an automatic local integration runner that creates an isolated Docker Compose Postgres service, waits for readiness, runs tests, and removes containers/volumes on completion; CI integration job now uses only `TEST_DATABASE_URL`.
- 2026-05-18: Implemented R-002 mitigation by adding `src/db/constraints.integration.test.ts` with transactional rollback assertions for DB trigger/check enforcement (ordinal labels, numerical score bounds, submission type/participant ownership, and rubric subtype integrity). Local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration` (21/21 passing).
- 2026-05-18: Implemented R-003 mitigation by adding `src/db/questions.integration.test.ts` with mutation-path coverage for `saveManagedQuestion`/`deleteManagedQuestion` (rename, type transition, stale cleanup, ordinal replacement, and delete cascade). Fixed joined count ambiguity in `getQuestionDeleteImpact` (`assessment.id`). Local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration` (26/26 passing).
- 2026-06-10: Assessment import prepare seam (seams plan PR 1): refreshed R-001 evidence (restructured modules + flipped unmatched-submission test), recorded R-009 Ignored Column groundwork, and marked the saveAssessments pure-phase refactor candidate done.
- 2026-06-10: Promoted R-001 to Verified. The promotion gate (CI `test-integration` green in PR checks) has been met since `test-integration` became a required branch-protection check on `main` (R-016 audit, 2026-05-18); CI on `main` is green and runs the R-001 suite on every PR. Dashboard counts updated (Tier 0: 3 verified; overall 3/16).
- 2026-06-10: Promoted R-002 and R-003 to Verified after status sync with closed GitHub issues #18 and #19 (state reason: completed). Dashboard counts updated (Tier 0: 5 verified; overall 5/16).
- 2026-06-10: Promoted R-011 to Verified via PR [#147](https://github.com/QuentinRoy/grading/pull/147) (question import restructured around parse/prepare/write seams). Added `prepareQuestionImport` pure-plan unit coverage plus `saveQuestions.integration.test.ts` cases for rubric type changes blocked when assessments are linked, allowed and reported when not, and cross-question rubric id collisions; a rubric type change with linked assessments now blocks instead of silently deleting and recreating the rubric (behavior change). The status flip landed in the register within PR #147 but was never recorded in this Change Log until the 2026-06-22 doc-integrity sync.
- 2026-06-11: Promoted R-006 to Verified after the submission export internals refactor (`plans/completed/2026-06-11-submission-export-internals.md`) added `src/export/submissionExportGrouping.ts` with stream-boundary/sparse/ordering unit tests and `src/export/submissionExport.integration.test.ts` end-to-end CSV coverage. Updated R-007/R-008 evidence paths to their post-reorganization locations under `src/assessments/` and linked them to `docs/investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md` as the remaining read-projection-extraction scope from that investigation. Dashboard counts updated (Tier 1: 1 verified; overall 6/16).
- 2026-06-11: Follow-up path/name sync for R-003, R-004, R-005 after the source reorganization and ADR 0007 split (`saveManagedQuestion`/`deleteManagedQuestion`/`getQuestionDeleteImpact` → `saveQuestionDefinitionInDb`/`deleteQuestionDefinitionInDb`/`getQuestionDefinitionDeleteImpactFromDb` in `src/questions/`; `src/db/assessments.ts` → `src/assessments/assessmentMutations.ts`; `src/db/submissions.ts`/`src/db/submissionProgress.ts` → `src/submissions/submissions.ts`/`src/assessments/submissionProgress.ts`, with `FromDb`-suffixed test names). No status changes; evidence and test references now match current file layout.
- 2026-06-22: Sync pass against current repo/issue state. Promoted R-007 to Verified — closed by PR #153 (assessment completion consolidation, `plans/completed/2026-06-11-assessment-completion-consolidation.md`), which had landed on 2026-06-11 but was never reflected here; evidence path updated from the stale `src/assessment/progressAggregator.ts` to `assessmentCompletion.ts`/`loadAssessmentCompletion.ts`. Refreshed R-016 evidence to describe the current `ci-status` aggregator job (gates `check-types`, `check`, `test-unit`, `test-integration`, `test-storybook`, `build`, `e2e`) and the Testcontainers-based integration Postgres provisioning (PR #203); flagged issue #22 as still open with stale auto-generated content despite the mitigation being verified. Dashboard counts updated (Tier 1: 2 verified; overall 7/16).
- 2026-06-22: Grilled R-008 (`/grill-with-docs`). Corrected the prior claim that `rubricOverview.ts` already follows the ADR 0007 primitive/wrapper shape — it does not (no `...FromDb` primitive, no `db` test seam, no integration test). Created `plans/active/2026-06-22-rubric-overview-projection-extraction.md` as the concrete execution plan (extraction + cache-tag helper + expanded unit test matrix + integration test, single PR closing #26). Updated R-008's Evidence/Next Action accordingly; status stays Open until that plan's PR lands. Moved `docs/investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md` to Completed in `docs/index.md` — its proposed direction is accepted/implemented and its remaining scope is now owned by the new plan, ahead of that plan's implementation.
- 2026-06-22: Executed `plans/completed/2026-06-22-rubric-overview-projection-extraction.md` via PR [#210](https://github.com/QuentinRoy/grading/pull/210). Renamed `rubricOverview.ts` to `loadRubricOverview.ts`, extracted `loadRubricAssessmentRecordsFromDb(db, { projectId })` (the three-way leftJoin across boolean/ordinal/numerical assessment subtype tables) as an ADR 0007 primitive, added `rubricOverviewCacheTags()`, and reworked `loadRubricOverviewData` onto the `options?: { db?: Kysely<DB> }` seam while keeping it composing the cached `loadSubmissions`/`loadQuestionGrid` wrappers (Design B, cache topology unchanged). Added `loadRubricOverview.test.ts` (cache tags) and `loadRubricOverview.integration.test.ts` (per-type value-column mapping, project isolation). Renamed `rubricOverview.test.ts` to `rubricOverviewBuilder.test.ts` and added duplicate-record, per-type-null, unknown-id, and mixed-rubric-type-distribution coverage. Updated the one call site (`app/.../assessments/overview/page.tsx`) to the named-object call shape. Promoted R-008 to Verified and moved the execution plan to `plans/completed/`. Local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm test:unit rubricOverviewBuilder loadRubricOverview`, `pnpm test src/assessments/loadRubricOverview.integration.test.ts`. Dashboard counts updated (Tier 1: 3 verified; overall 8/16).
- 2026-06-22: Promoted R-004 to Verified per `plans/completed/2026-06-22-r004-concurrency-tests.md` (design locked the same day). Added forced-interleaving integration tests via Kysely controlled transactions and a `pg_stat_activity` lock-wait barrier (`src/test/concurrency.ts`): `saveAssessmentInDb` Scenarios A and B (`src/assessments/assessmentMutations.integration.test.ts`), and lighter overlap-invariant tests for `saveStudentImportPlanInDb` and `saveQuestionImportPlanInDb` (`src/import/saveStudents.integration.test.ts`, `src/import/saveQuestions.integration.test.ts`). All three primitives proved already correct under READ COMMITTED — test-and-fix confirmed by temporarily reverting each guard and observing the new tests fail, then restoring. Dashboard counts updated (Tier 0: 6 verified; overall 9/16).
- 2026-06-22: Doc-integrity sync (no code changes). Corrected the Section 3 dashboard to match the register — Tier 1 is 2 open / 4 verified (the prior "3 open / 3 verified" had not counted R-011), and overall is 10/16 verified / 6 remaining (prior "9/16"). Backfilled the missing R-011 Verified entry above (PR #147, 2026-06-10). Reconciled register references to the post-consolidation file layout: R-005 evidence and R-005/R-007 test evidence moved off the removed `submissionProgress.ts` / `submissionProgress.integration.test.ts` to `loadAssessmentCompletion.ts` / `loadAssessmentCompletion.integration.test.ts` (PR #153 completion consolidation; `loadSubmissionQuestionProgressFromDb` → `loadAssessedRubricCountsBySubmissionFromDb`, `loadSubmissionOverviewProgressFromDb` → `loadAssessmentCompletionBySubmissionFromDb`); R-013 and the Section 6 Tier 2 target moved from `src/assessment/useAssessmentSession.ts` to `src/assessments/useAssessmentSession.ts`; Section 6 Tier 0/1 targets moved from `src/db/questions.ts` / `src/db/assessments.ts` / `src/db/submissionProgress.ts` / `src/db/assessmentsProgress.ts` to their `src/questions/` and `src/assessments/` homes. Repaired the R-008 register row, which carried an extra (13th) column. Left intact as accurate point-in-time records: the Section 5 Baseline inventory, the Execution Log and earlier Change Log entries (pre-reorg paths), R-016's reference to the nonexistent `src/ci/branchProtection.ts` (it describes a stale GitHub issue body), and the earlier note about the stale `src/assessment/progressAggregator.ts`.
- 2026-06-22: Second-pass repo audit (157 commits since the audit was created). Doc corrections applied: marked milestones M2/M3 complete (all six Tier 0 risks Verified behind the merge-blocking `ci-status` check); refreshed the Section 3 sprint focus (Sprint A complete; remaining work is R-009/R-010, then Tier 2); marked the export-stream-separation (#152) and shared-DB-fixture refactor candidates done and noted the questions/students import seams landed (#147/#148); updated the Section 6 Tier 0 CI scenario (the external Postgres service backend was removed in #203 — Testcontainers everywhere now); corrected R-016's Next Action (issue #22 is closed); added a constraint-coverage check to R-002's Next Action for the post-audit identifier migrations. Issue-sync gaps flagged in the register: R-006 (#32) and R-011 (#25) are Verified here but their GitHub issues remain open. Untracked areas identified for triage (not yet registered): (a) the interactive-grading server action `src/assessments/saveAssessment.ts` is an unguarded `"use server"` passthrough with no validation, no actionable-error/recovery shaping, and no unit/integration test — e2e (`e2e/grading-workflow.spec.ts`) only exercises the CSV-import write path, so the hot interactive write path can surface raw DB/pool errors to the client (candidate to fold into R-012); (b) cache-tag invalidation correctness (ADR 0008) determines whether stale grades/progress are shown after a mutation — it is tested (`src/db/cacheInvalidation.test.ts`, `src/db/cacheTags.test.ts`, and the mutation integration suites assert tags) and owned by the completed caching plan (`plans/completed/2026-06-17-caching-loading-hardening.md`), but this reliability tracker does not yet reference it; (c) post-audit operational hardening not reflected here — Postgres pool error handling (#190/#199/#202) and scoped pino logging (ADR 0009) — strengthens R-015's area; (d) forward watch item: the offline-support investigation (`docs/investigations/2026-05-19-offline-support.md`), if pursued, introduces local assessment storage as a Tier 0 data-loss surface.
- 2026-06-22: Grilled R-009 (`/grill-with-docs`). Locked the design for the marks-only-file contract: rather than a soft warning, a file with zero header columns matching a project rubric becomes a new `no-assessment-columns` Blocking Diagnostic (it can never produce a write anyway, so blocking only changes messaging, not behavior) — this also covers the empty-CSV and zero-rubric-project edge cases under the same rule, with no short-circuiting of existing row-level diagnostics. Roundtrip fidelity (full export, assessment-only export, and the new marks-only-blocks case) gets a new `src/import/assessmentImportRoundtrip.integration.test.ts`. Created `plans/completed/2026-06-22-r009-import-export-roundtrip-contract.md` as the execution plan; R-009 status stays Open until that plan's PR lands.
- 2026-06-22: Acted on the second-pass findings. Closed GitHub issues #32 (R-006, resolved by #152) and #25 (R-011, resolved by #147) as completed, and updated their Next Actions accordingly. Registered R-017 (Tier 1, Verified, score 48) for cache-tag invalidation correctness, cross-referencing ADR 0008, `plans/completed/2026-06-17-caching-loading-hardening.md`, the `cacheTags`/`cacheInvalidation` unit tests, and the mutation integration suites (umbrella issue #59, closed) — no new issue created since the work is already done and verified. Expanded R-012 to cover the interactive-grading action `src/assessments/saveAssessment.ts` and re-scored it 30→40 (scope expansion commented on #31). Re-scored R-010 36→24 because `markNumericalRubric` already guards out-of-range and inverted inputs, so the remaining work is characterization rather than a fix. Dashboard updated (Tier 1: 5 verified; total 17; 11/17 verified, 6 remaining).
- 2026-06-22: Implemented `plans/completed/2026-06-22-r009-import-export-roundtrip-contract.md`. Added the `no-assessment-columns` Blocking Diagnostic variant to `AssessmentImportBlockingDiagnostic`, detected in `prepareAssessmentImport` whenever the header has zero columns matching a project rubric (covers marks-only files and the empty-CSV degenerate case alike), and surfaced its message in `saveAssessments.ts`'s `formatBlockingDiagnostic`. Added marks-only/empty-CSV/assessment-column-with-no-values unit cases to `src/import/prepareAssessmentImport.test.ts` and a new `src/import/assessmentImportRoundtrip.integration.test.ts` (full export, assessment-only export, marks-only-blocks). Local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm vitest run --project=unit --project=integration src/import/` (48 passing). Promoted R-009 to Verified; dashboard updated (Tier 1: 1 open, 6 verified; total 17; 12/17 verified, 5 remaining).
- 2026-06-22: Implemented `plans/completed/2026-06-22-numerical-rubric-bounds.md` (grilled via `/grill-with-docs`, then executed per `/tdd`). Made `markNumericalRubric` a pure computer: it now throws only on a zero-width score range (`scoreRange === 0`), and removed the `scoreRange < 0` and out-of-range-score throws — inverted ranges and out-of-range scores now return finite (extrapolated) values, since the editor and a new DB CHECK make the underlying invalid rubric states unrepresentable, and the existing `enforce_numerical_score_bounds` trigger already blocks out-of-range persisted scores. Added both well-formedness rules (`minScore < maxScore`, `minMarks <= maxMarks`) to the editor's `questionDefinitionSchema` superRefine and to a new migration (`20260622000000_enforce_numerical_rubric_bounds.ts`) adding `numerical_rubric_score_range_check` and `numerical_rubric_marks_range_check` CHECK constraints with a working `down()`. Each behavior change followed red/green TDD, and every GREEN change was confirmed by reverting it and observing its RED test fail, then restoring. Added the `Numerical Rubric Bounds` glossary entry to `CONTEXT.md`. Promoted R-010 to Verified; dashboard updated (Tier 1: 0 open, 7 verified; total 17; 13/17 verified, 4 remaining).

## 11. Issue Entry Template (for future additions)

Copy this block when adding new issues:

```text
Issue ID: R-XXX
Tier: Tier 0 | Tier 1 | Tier 2
Score: <Impact x Likelihood x Detectability>
Area: <module/domain>
Risk: <what can go wrong>
Impact: <data loss / wrong grading / UX>
Evidence: <file(s), symbols, failing scenario>
Status: Open | In Progress | Mitigated | Verified | Accepted
Owner: <name or unassigned>
Target: <sprint or date>
Test Evidence: <test file(s) / CI link / pending>
Next Action: <specific implementation/testing action>
Required Tests: <test file names + scenarios>
Date Opened: YYYY-MM-DD
Date Updated: YYYY-MM-DD
```

## 12. Next Review Checklist

Use this short checklist during each update pass:
- [ ] Dashboard counts match risk table statuses.
- [ ] Every Open/In Progress item has Owner, Target, and Next Action.
- [ ] Every Mitigated/Verified item includes Test Evidence.
- [ ] Score reviewed for all items touched this week.
- [ ] GitHub issue numbers in Issue # column match each risk.
- [ ] PR body includes an auto-close keyword for each addressed risk issue (for example: `Fixes #<issue>`).
- [ ] Any new risks have corresponding GitHub issues created and linked.
- [ ] Change Log entry added.

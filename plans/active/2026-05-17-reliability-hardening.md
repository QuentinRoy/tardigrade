# Project Reliability Audit and Test Tracker

Status: Active
Last Updated: 2026-06-22 (sync pass: R-007 Verified, R-016 evidence refreshed)
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
- Tier 0: 1 open, 0 in progress, 0 mitigated, 5 verified
- Tier 1: 4 open, 0 in progress, 2 verified
- Tier 2: 4 open, 0 in progress, 0 verified

Overall issue status:
- Total tracked risks: 16
- Verified: 7/16
- Remaining: 9/16

Current sprint focus:
- Sprint label: Reliability Sprint A (proposed)
- Target scope: R-001, R-002, R-003, R-005, R-016
- Exit criteria: Tier 0 write-path invariants enforced by automated tests and required GitHub CI checks are blocking merges

Critical policy decisions confirmed:
- Import atomicity: Fully atomic (all-or-nothing).
- Concurrent same-rubric grading writes: Last write wins.

Immediate execution recommendation:
1. Implement R-016 first to establish merge-blocking CI guardrails.
2. Implement remaining Tier 0 items.
3. Follow immediately with Tier 1.
4. Then complete Tier 2 action/UX hardening.

## 4. Risk Register (Living)

| ID | Tier | Score | Area | Risk | Evidence | Status | Issue # | Owner | Target | Test Evidence | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R-001 | Tier 0 | 100 | Import / Assessments | Assessment import can persist partial writes before reporting failure. Violates all-or-nothing policy. | src/import/prepareAssessmentImport.ts (pure plan with Blocking Diagnostics), src/import/assessmentImportContext.ts, src/import/saveAssessments.ts (single transaction: load context → prepare → write) | Verified | [#17](https://github.com/QuentinRoy/grading/issues/17) | Unassigned | Sprint A | `src/import/prepareAssessmentImport.test.ts`: pure-plan unit coverage for unmatched/ambiguous submissions, invalid values, unknown columns, ignored columns, overwrites; `src/import/saveAssessments.integration.test.ts`: `saveAssessments does not persist valid rows when a later row fails validation`, `saveAssessments rejects unknown columns before writing any assessment`, `saveAssessments blocks the import when a row has no matching submission` (2026-06-10 behavior change: unmatched submissions now block instead of being silently skipped), `saveAssessments rolls back all writes if a later transactional write fails`, `saveAssessments returns imported and overwritten counts`; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration`; CI: `test-integration` is a required branch-protection check on `main` (R-016 audit) and runs this suite on every PR — green on `main` as of 2026-06-10, with PR #146 carrying the current test names | None — monitor via the required `test-integration` check; keep evidence in sync if the import suite moves. |
| R-002 | Tier 0 | 80 | Data integrity constraints | Strong DB triggers/checks exist but are under-tested in integration suites. | src/db/migrations/20260513000000_init.ts, src/db/migrations/20260514000001_enforce_numerical_score_bounds.ts, src/db/migrations/20260514000002_enforce_ordinal_label_valid.ts | Verified | [#18](https://github.com/QuentinRoy/grading/issues/18) | Unassigned | Sprint A | `src/db/constraints.integration.test.ts`: `ordinal rubric assessments accept valid labels and roll back failed transactional writes`, `numerical rubric assessments enforce score bounds and roll back failed transactional writes`, `submission owner/type check rejects invalid rows and rolls back transactional writes`, `rubric subtype triggers reject mismatched subtype rows and roll back transactional writes`; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration` (21 tests passing) | None — keep test evidence current if constraints coverage moves. |
| R-003 | Tier 0 | 75 | Questions/rubrics mutation | saveQuestionDefinitionInDb contains complex delete/reinsert/reconcile logic with limited direct integration coverage; high chance of subtle data breakage. | src/questions/questionDefinitionMutations.ts, src/questions/questionDefinitions.ts | Verified | [#19](https://github.com/QuentinRoy/grading/issues/19) | Unassigned | Sprint A | `src/questions/questionDefinitionMutations.integration.test.ts`: `saveQuestionDefinitionInDb renames question id while preserving linked assessments`, `saveQuestionDefinitionInDb replaces rubric subtype data when rubric type changes`, `saveQuestionDefinitionInDb removes stale rubrics that are no longer referenced`, `saveQuestionDefinitionInDb replaces ordinal rubric values using the provided label set`, `deleteQuestionDefinitionInDb reports deletion and cascades linked assessments`; `src/questions/questionDefinitions.integration.test.ts`: `getQuestionDefinitionDeleteImpactFromDb reports the linked assessment count`, `getQuestionDefinitionDeleteImpactFromDb reports zero for an unassessed question` (counts `assessment.id` explicitly to avoid ambiguous-column failures under joins); local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration` | None — keep test evidence current if questions integration coverage moves. |
| R-004 | Tier 0 | 64 | Concurrency | Last-write-wins semantics are desired but currently not proven under concurrent writes/import overlap. | src/assessments/assessmentMutations.ts, src/import/prepareStudentImport.ts, src/import/studentImportContext.ts, src/import/saveStudents.ts (single transaction: load context → prepare → write), src/import/saveQuestions.ts | Open | [#20](https://github.com/QuentinRoy/grading/issues/20) | Unassigned | Sprint B | Groundwork (2026-06-10): student import restructured around the same load context → prepare → write seam as assessments/questions (`src/import/prepareStudentImport.test.ts`, `src/import/saveStudents.integration.test.ts`), narrowing the surface for future concurrency tests. | Add race tests for concurrent writes to same rubric/submission/question and overlapping imports. |
| R-005 | Tier 0 | 90 | Project isolation | Project scoping exists but needs stronger adversarial fixtures to prove no cross-project contamination across duplicated external IDs. | src/submissions/submissions.ts, src/assessments/submissionProgress.ts, src/import/saveStudents.ts | Verified | [#21](https://github.com/QuentinRoy/grading/issues/21) | Unassigned | Sprint A | `src/submissions/submissions.integration.test.ts`: `loadSubmissionsFromDb returns only individual submissions for the requested project when student ids collide across projects`, `loadSubmissions returns only team submissions for the requested project when team names collide across projects`; `src/assessments/submissionProgress.integration.test.ts`: `loadSubmissionQuestionProgressFromDb counts only assessments within the requested project when question ids collide across projects`, `loadSubmissionOverviewProgressFromDb counts only questions and assessments within the requested project when question ids collide across projects`; `src/import/saveAssessments.integration.test.ts`: `saveAssessments links assessments only to the target project even when the same student id exists in another project`; local verification: `pnpm run check-types`, `pnpm run check --fix`, `pnpm run test:integration` | None — keep test evidence current if these suites move. |
| R-006 | Tier 1 | 60 | Export correctness | Streamed submission export assembly has complex state transitions; gaps may produce wrong rows/totals/order in edge cases. | src/export/submissionExport.ts, src/export/submissionExportGrouping.ts, src/export/submissionExportCsv.ts | Verified | [#32](https://github.com/QuentinRoy/grading/issues/32) | Unassigned | Sprint B | `plans/completed/2026-06-11-submission-export-internals.md`: `src/export/submissionExportGrouping.test.ts` covers stream boundaries (single-submission group, multi-submission boundary detection, last-group flush, empty input), value classification (boolean/ordinal/numerical, sparse assessments with null questionId/rubricId), and input-order preservation across submissions; `src/export/submissionExportCsv.test.ts` covers header/record ordering, sparse record values with question/grand totals, and submission-type invariants; `src/export/submissionExport.integration.test.ts` snapshots end-to-end CSV output for mixed rubric types and submission states through the ADR 0007 `{ db = defaultDb }` seam; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm test src/export/` (29 tests) | None — keep test evidence current if the export suite moves. |
| R-007 | Tier 1 | 72 | Progress metrics | Submission/global progress aggregates are business-critical and under-covered against edge combinations (zero-rubric questions, sparse assessments). | src/assessments/assessmentCompletion.ts (pure builder), src/assessments/loadAssessmentCompletion.ts (loaders + primitive) | Verified | [#24](https://github.com/QuentinRoy/grading/issues/24) | Unassigned | Done | `plans/completed/2026-06-11-assessment-completion-consolidation.md`: `assessmentCompletion.test.ts` covers tracer/partial/zero-rubric/vacuous (no-submissions, no-questions)/robustness cases for `buildAssessmentCompletion`; `submissionProgress.integration.test.ts` and the summary-loader integration tests pin zero-rubric-question completion and empty-project vacuous aggregates through `loadAssessmentCompletionRowsFromDb`; `assessmentSummary.test.ts` covers the client-side zero-rubric counting; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm test:unit assessmentCompletion assessmentSummary`, `pnpm test src/assessments/` | None — closed by PR #153 (2026-06-11); keep evidence in sync if these modules move. |
| R-008 | Tier 1 | 45 | Rubric overview analytics | Class/rubric averages and completion percentages can drift if aggregation assumptions change; coverage is partial. | src/assessments/rubricOverviewBuilder.ts, src/assessments/rubricOverview.test.ts | Open | [#26](https://github.com/QuentinRoy/grading/issues/26) | Unassigned | Sprint C | Pending | Expand test matrix for duplicate/partial/null assessment records and mixed rubric distributions. Treat as the remaining read-projection extraction from `docs/investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md` (§5/§0): module already follows the ADR 0007 primitive/wrapper shape but lacks a dedicated projection/test-hardening pass. |
| R-009 | Tier 1 | 54 | Import/export roundtrip | Export includes both assessment and marks columns; import behavior may diverge if only marks columns are present. | src/export/submissionExportCsv.ts, src/import/prepareAssessmentImport.ts, src/import/parseAssessments.ts | Open | [#27](https://github.com/QuentinRoy/grading/issues/27) | Unassigned | Sprint B | Groundwork (2026-06-10): `src/import/prepareAssessmentImport.test.ts` covers derived export columns (`grand_total_marks`, per-rubric `:marks`, question columns) reported as explicit Ignored Columns, never imported and never blocking. | Enforce contract test: assessment-column roundtrip preserves semantics; marks-only import behavior is explicit and validated. |
| R-010 | Tier 1 | 36 | Numerical rubric math | markNumericalRubric boundary behavior (score range edges, reversed mode) needs broader coverage beyond current happy-path tests. | src/rubrics/rubric.ts, src/rubrics/rubric.test.ts | Open | [#23](https://github.com/QuentinRoy/grading/issues/23) | Unassigned | Sprint C | Pending | Add boundary and invalid-input tests for score interpolation and reversed mapping. |
| R-011 | Tier 1 | 48 | Question/rubric saves | Save paths for imported questions need tests on ID collisions, type transitions, and ordinal value replacement semantics. | src/import/prepareQuestionImport.ts (pure plan with Blocking Diagnostics), src/import/questionImportContext.ts, src/import/saveQuestions.ts (single transaction: load context → prepare → write) | Verified | [#25](https://github.com/QuentinRoy/grading/issues/25) | Unassigned | Sprint B | `src/import/prepareQuestionImport.test.ts`: pure-plan unit coverage for question/rubric upserts, rubric type changes blocked when assessments are linked, rubric type changes allowed and reported when no assessments are linked, and rubric id collisions across questions; `src/import/saveQuestions.integration.test.ts`: `saveQuestions blocks a rubric type change when the rubric has linked assessments` (2026-06-10 behavior change: previously the rubric was silently deleted and recreated, cascading away assessments), `saveQuestions allows a rubric type change when the rubric has no linked assessments`, `saveQuestions blocks an imported rubric id that already belongs to another question`, plus the existing project-isolation and upsert suites; local verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration` | None — monitor via the required `test-integration` check; keep evidence in sync if the import suite moves. |
| R-012 | Tier 2 | 30 | Server action contracts | Question/import actions need explicit tests for actionable error messaging and controlled failure paths. | src/questions/actions.ts, src/import/*ImportAction.ts, src/import/actionUtils.ts | Open | [#31](https://github.com/QuentinRoy/grading/issues/31) | Unassigned | Sprint C | Pending | Add action tests covering parse errors, validation errors, and infrastructure errors. |
| R-013 | Tier 2 | 24 | UI optimistic save behavior | Assessment session optimistic updates and rollback/pending accounting are not explicitly tested. | src/assessment/useAssessmentSession.ts | Open | [#30](https://github.com/QuentinRoy/grading/issues/30) | Unassigned | Sprint C | Pending | Add hook/component tests for success/failure ordering and pending counter integrity. |
| R-014 | Tier 2 | 27 | Export routes API behavior | Route response contracts (404/400/200, headers, filenames) need route-level tests. | app/projects/[projectId]/[projectSlug]/export/questions/route.ts, app/projects/[projectId]/[projectSlug]/export/submissions/route.ts | Open | [#28](https://github.com/QuentinRoy/grading/issues/28) | Unassigned | Sprint C | Pending | Add route tests for status and headers under valid/invalid conditions. |
| R-015 | Tier 2 | 20 | Operational signal quality | Some paths surface generic errors; consistency of user-recoverable guidance should be tested and standardized. | app/projects/page.tsx, src/import/actionUtils.ts | Open | [#29](https://github.com/QuentinRoy/grading/issues/29) | Unassigned | Sprint C | Pending | Add contract checks for actionable, non-internal error text and recovery guidance. |
| R-016 | Tier 0 | 100 | Delivery pipeline / CI | GitHub CI integration is not yet defined as a required reliability gate; critical regressions could merge without automated checks. | package.json scripts (`test:unit`, `test:integration`, `check-types`, `check`), reliability goals in this audit, .github/workflows/ci.yml, src/test/dbIntegration.ts | Verified | [#22](https://github.com/QuentinRoy/grading/issues/22) | Unassigned | Sprint A | `.github/workflows/ci.yml` runs `check-types`, `check`, `test-unit`, `test-integration`, `test-storybook`, `build`, and `e2e` on pull_request/push to `main`, then fans into a single `ci-status` job that fails if any of them didn't succeed; integration Postgres is now provisioned via Testcontainers in CI and locally (PR #203), so the prior `TEST_DB_BACKEND=external` service-container path is gone; local verification: `pnpm run check-types`, `pnpm run check`, `pnpm run test:unit`, `pnpm run test:integration`; branch protection audit (2026-06-22, re-checked via `gh api repos/.../branches/main/protection`): the only required status check on `main` is `ci-status`, which itself requires `changes`, `check-types`, `check`, `test-unit`, `test-integration`, `test-storybook`, `build`, `e2e`. | Monitor required-check drift and keep branch protection aligned with CI workflow changes; close issue #22 (still open, stale auto-generated body referencing a nonexistent `src/ci/branchProtection.ts`). |

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
  - integration suite supports both local Testcontainers and CI Postgres service backend via shared test helpers

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

4. saveManagedQuestion data safety matrix
- Target: src/db/questions.ts
- Scenarios:
  - rename with existing assessments
  - rubric type change with existing assessments
  - stale rubric cleanup
  - delete question impact and cascade behavior

5. Concurrency behavior (last write wins)
- Targets: src/db/assessments.ts and import save modules
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
- Targets: src/db/submissionProgress.ts, src/db/assessmentsProgress.ts
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
- Target: src/assessment/useAssessmentSession.ts

## 7. Refactor Candidates to Improve Testability

These are behavior-preserving refactors intended only to make tests deterministic and reduce risk:
- ~~Extract pure normalization/validation phase from src/import/saveAssessments.ts.~~ Done 2026-06-10: `prepareAssessmentImport` (pure plan) + `loadAssessmentImportContextFromDb` + `saveAssessmentImportPlanInDb`; see `docs/design/2026-06-10-import-parse-prepare-write-seams.md`. Questions and students flows remain.
- Separate export stream state machine steps in src/export/submissionExport.ts; request-option parsing now lives in route layer.
- Introduce shared DB fixture builders for project/question/rubric/submission/assessment setup.
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
- [ ] M2: Tier 0 tests implemented
- [ ] M3: Tier 0 verified in CI
- [ ] M4: Tier 1 tests implemented
- [ ] M5: Tier 1 verified in CI
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
- 2026-06-11: Promoted R-006 to Verified after the submission export internals refactor (`plans/completed/2026-06-11-submission-export-internals.md`) added `src/export/submissionExportGrouping.ts` with stream-boundary/sparse/ordering unit tests and `src/export/submissionExport.integration.test.ts` end-to-end CSV coverage. Updated R-007/R-008 evidence paths to their post-reorganization locations under `src/assessments/` and linked them to `docs/investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md` as the remaining read-projection-extraction scope from that investigation. Dashboard counts updated (Tier 1: 1 verified; overall 6/16).
- 2026-06-11: Follow-up path/name sync for R-003, R-004, R-005 after the source reorganization and ADR 0007 split (`saveManagedQuestion`/`deleteManagedQuestion`/`getQuestionDeleteImpact` → `saveQuestionDefinitionInDb`/`deleteQuestionDefinitionInDb`/`getQuestionDefinitionDeleteImpactFromDb` in `src/questions/`; `src/db/assessments.ts` → `src/assessments/assessmentMutations.ts`; `src/db/submissions.ts`/`src/db/submissionProgress.ts` → `src/submissions/submissions.ts`/`src/assessments/submissionProgress.ts`, with `FromDb`-suffixed test names). No status changes; evidence and test references now match current file layout.
- 2026-06-22: Sync pass against current repo/issue state. Promoted R-007 to Verified — closed by PR #153 (assessment completion consolidation, `plans/completed/2026-06-11-assessment-completion-consolidation.md`), which had landed on 2026-06-11 but was never reflected here; evidence path updated from the stale `src/assessment/progressAggregator.ts` to `assessmentCompletion.ts`/`loadAssessmentCompletion.ts`. Refreshed R-016 evidence to describe the current `ci-status` aggregator job (gates `check-types`, `check`, `test-unit`, `test-integration`, `test-storybook`, `build`, `e2e`) and the Testcontainers-based integration Postgres provisioning (PR #203); flagged issue #22 as still open with stale auto-generated content despite the mitigation being verified. Dashboard counts updated (Tier 1: 2 verified; overall 7/16).

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

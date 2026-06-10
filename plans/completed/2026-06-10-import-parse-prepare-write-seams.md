# Execution plan: import parse/prepare/write seams

Status: Completed
Date: 2026-06-10
Resolution: Done — three PRs (assessments, questions, students), each implemented test-first.
Follow-up: Preview UI and configurable policies deferred to the import/product workflow investigation.

Design: [Import parse, prepare, and write seams](../../docs/design/2026-06-10-import-parse-prepare-write-seams.md). All policy and structure decisions live there; this plan only tracks delivery.

## Method: TDD

Each PR proceeds in vertical slices: one failing test for one behavior, minimal code to green, then the next behavior. No bulk test writing ahead of implementation.

- Tests target public interfaces only: the pure `prepare…Import` function and the app-level wrapper. Context loaders and write primitives are exercised through the wrapper's integration tests, not tested in isolation.
- The existing integration suites are the regression net for the behavior-preserving parts of the restructure; they must stay green through every cycle.
- Structural extraction (context loader module, write primitive, dead-code deletion, simplify pass) happens in the refactor step, only while green.
- Behavior changes (blocking policies, overwrite reporting) get their failing test first, before any implementation.

## PR 1 — Assessments (exemplar)

Tracer bullet:

- [x] RED: unit test — `prepareAssessmentImport` plans one write per non-empty rubric cell of a matched submission. GREEN: minimal pure function extracted from `saveAssessments.ts` logic, fed by a hand-built `AssessmentImportContext`.

Diagnostic cycles (one RED→GREEN each, on the pure function):

- [x] Unmatched submission → Blocking Diagnostic (behavior change: was silent skip).
- [x] Ambiguous submission → Blocking Diagnostic.
- [x] Invalid cell value → Blocking Diagnostic.
- [x] Unknown column → Blocking Diagnostic; derived columns (`grand_total_marks`, `:marks`, question columns) reported as Ignored Columns, never blocking.
- [x] Existing values for targeted (submission, rubric) pairs → listed as overwrites.

Integration cutover (wrapper behavior):

- [x] RED: flip the existing "skips rows with no matching submission mapping" integration test to expect a blocking error and zero writes; assert the wrapper returns imported + overwritten counts. GREEN: rewire `saveAssessments` to load context → prepare → throw on blocking diagnostics → write, all in one transaction.
- [x] All pre-existing integration tests (atomicity, unknown column, rollback, cross-project isolation, cache invalidation) stay green through the cutover.

Refactor while green:

- [x] Extract `loadAssessmentImportContextFromDb` into `assessmentImportContext.ts`; write primitive `saveAssessmentImportPlanInDb`; delete superseded code paths in `saveAssessments.ts`; simplify pass.
- [x] Success message includes overwrite count (action formatting).
- [x] Behavior change called out in PR body; reliability tracker updated (touches R-001 #17 evidence; advances R-009 #27 groundwork).

## PR 2 — Questions

Same method. Cycles:

- [x] Tracer bullet: `prepareQuestionImport` plans question/rubric upserts from parsed questions and a hand-built context.
- [x] Rubric type change with linked assessments → Blocking Diagnostic naming rubric + assessment count, pointing to the question management UI (behavior change: was silent delete + recreate).
- [x] Rubric type change without linked assessments → proceeds, reported in the plan.
- [x] Rubric id reused under a different question → Blocking Diagnostic (`rubric-question-mismatch`).
- [x] Integration cutover: wrapper composes the stages in one transaction; existing `saveQuestions.integration.test.ts` stays green (renamed `saveQuestionsInDb` calls to the `saveQuestions` wrapper) plus new tests for the type-change blocking behavior. Advances R-011 #25.
- [x] Refactor while green: context loader (`questionImportContext.ts`) + write primitive (`saveQuestionImportPlanInDb`) extraction; simplify pass; tracker update.

## PR 3 — Students

Same method. Cycles:

- [x] Tracer bullet: `prepareStudentImport` plans student/team/submission upserts.
- [x] Created vs updated classification for students and submissions (new plan data; success message reports both).
- [x] Team membership change reflected in the plan.
- [x] Integration cutover: wrapper composes stages in one transaction; existing suite stays green (no blocking diagnostics in this flow).
- [x] Refactor while green: extraction + simplify pass; tracker update; move this plan to `plans/completed/`.

## Checks per PR

`pnpm run check --fix`, `pnpm run check-types`, `pnpm test:unit <prepare-module-stem>`, and the matching `test:integration` suites per testing conventions.

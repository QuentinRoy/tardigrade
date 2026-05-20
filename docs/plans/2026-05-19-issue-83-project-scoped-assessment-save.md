# Issue 83: Project-Scoped Assessment Save

## Context

Saving an assessment can fail when two projects reuse the same question id (and rubric ids) because question resolution in the save path currently uses question.id without project scoping.

## Goals

- Ensure assessment save resolves questions in the submission project.
- Preserve rubric validation scoped to the resolved project/question.
- Add regression coverage for duplicate ids across projects.
- Keep public/business ids at boundaries and row ids internal.

## Scope

In scope:
- `src/db/assessments.ts` query hardening in `saveAssessmentWithDb`.
- `src/db/assessments.ts` defensive read-path hardening in `loadAssessment`.
- `src/db/assessments.integration.test.ts` regression tests.

Out of scope:
- Schema migration changes.
- API contract redesign to use raw/row ids externally.
- Unrelated UI changes.

## Plan

1. Update save path to resolve submission first, then question by `(projectId, id)`.
2. Keep/verify rubric lookup scoped to project and question row id.
3. Harden `loadAssessment` with explicit project-scoped predicate.
4. Add integration regressions for duplicated question/rubric ids across projects.
5. Run formatting, types, and focused tests.

## Acceptance Criteria

- [x] Saving an assessment works when two projects contain the same question id.
- [x] Saving an assessment works when those projects also contain matching rubric ids.
- [x] `saveAssessmentWithDb` resolves questions using the submission project context.
- [x] `loadAssessment` is reviewed and made project-safe.
- [x] Regression tests cover cross-project duplicate question ids.
- [x] Valid same-project saves do not return `Submission or question not found.`.
- [x] Invalid cross-project combinations still fail safely.

## Risks

- Potential behavior drift in error ordering/messages for invalid input combinations.
- Tests may need careful fixture setup to guarantee id collisions across projects.

## Validation

- `pnpm run check --fix`
- `pnpm run check-types`
- Focused integration tests for assessments

## Progress

- [x] Plan created
- [x] Implementation complete
- [x] Validation complete

## Validation Results

- `pnpm run check --fix` passed (`biome check --fix`, no fixes needed).
- `pnpm run check-types` passed (`tsc --noEmit`).
- `pnpm run test:integration -- src/db/assessments.integration.test.ts` passed.

## Notes

- User-facing assessment save errors were rewritten to plain language with recovery guidance (reload/retry and report-issue path for persistent failures).

# R-001 Atomic Assessment Import: Implementation Plan

Status: Implemented (local verification complete)
Date: 2026-05-18
Owner: Copilot
Related tracker: docs/plans/2026-05-17-deep-project-audit-and-test-tracker.md (R-001)

## Objective

Implement and verify all-or-nothing assessment import behavior with broader refactoring of `saveAssessments` and expanded integration coverage.

## Scope

Included:
- Refactor `src/import/saveAssessments.ts` into explicit phases.
- Replace serial submission resolution with batched project-scoped lookup.
- Keep all writes in a single transaction.
- Expand `src/import/saveAssessments.test.ts` coverage for R-001 acceptance scenarios.
- Run formatting, type checks, and integration tests.
- Update the reliability tracker status/evidence for R-001.

Excluded:
- Concurrency race tests (R-004 scope).
- Other Tier 1/Tier 2 reliability issues.

## Implementation Steps

1. Refactor `saveAssessments`:
   - Add helper to batch-resolve submissions by `(submission_type, submitter)`.
   - Keep column recognition validation up front.
   - Split into clear read/validate/prepare/write phases.
   - Preserve existing behavior for ambiguous and missing submission mapping.

2. Expand integration tests in `saveAssessments.test.ts`:
   - Unknown header column rejects import and persists nothing.
   - Ambiguous submitter mapping rejects import and persists nothing.
   - Late transactional failure rolls back all prepared writes.

3. Verify and update tracker:
   - `pnpm run check --fix`
   - `pnpm run check-types`
   - `pnpm run test:integration`
   - Update R-001 status and test evidence in tracker doc.

## Acceptance Criteria

- Assessment imports remain atomic under all tested failure scenarios.
- New tests are deterministic and pass in integration suite.
- Tracker reflects current status with linked test evidence.

## Verification Notes

- 2026-05-18 local checks passed: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run test:integration`.
- External backend integration command requires a running Postgres service on `localhost:55432`; this was not available in the current local environment.

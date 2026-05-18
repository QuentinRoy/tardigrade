# R-003 Save Managed Question Hardening Plan

Status: Completed
Date: 2026-05-18
Scope: Reliability issue R-003 (`src/db/questions.ts`)

## Goal
Add integration coverage for `saveManagedQuestion` and related delete/reconcile paths to reduce risk of silent data breakage in question/rubric mutation workflows.

## Risks Addressed
- Rename with existing assessments can break associations or cache invalidation semantics.
- Rubric type transitions can leave stale subtype rows or fail to preserve intended behavior.
- Stale rubric and ordinal value reconciliation can be incomplete, causing drift.
- Delete behavior with existing assessments must cascade predictably.

## Implementation Steps
1. Add dedicated integration test suite at `src/db/questions.integration.test.ts` using `createIntegrationTest(import.meta.url)`.
2. Add fixture builders for project/question/rubric/submission/assessment setup with deterministic IDs.
3. Add matrix tests:
   - rename question id while preserving assessments linkage
   - rubric type change (existing rubric id) removes obsolete subtype data and writes new subtype rows
   - stale rubric cleanup removes no-longer-referenced rubrics for the managed question
   - ordinal value replacement removes removed labels and upserts retained/new labels
   - delete impact/cascade removes question-linked assessments and returns impact counts
4. Validate with `pnpm run check --fix`, `pnpm run check-types`, and `pnpm run test:integration`.
5. Update tracker `docs/plans/2026-05-18-reliability-hardening-tracker.md` with R-003 status/evidence and changelog entries.

## Non-Goals
- Concurrency behavior hardening (R-004).
- Import pipeline changes (R-001/R-011).
- UI/action-layer behavior tests (Tier 2 items).

## Exit Criteria
- New integration tests reliably reproduce and guard each targeted mutation scenario.
- Full integration suite passes locally.
- Tracker reflects R-003 mitigation state and concrete evidence.

# Plan: Issues #46 + #34 Unified Key Migration

## Goal
Fix project-scoped ID reuse bugs (#46) and migrate question/rubric relations to surrogate row keys (#34) in one coordinated change.

## Scope
- Add surrogate row keys for `question` and `rubric`.
- Keep natural IDs (`question.id`, `rubric.id`) as business IDs with project-scoped uniqueness.
- Repoint relational FKs from natural IDs to row keys.
- Update import/save/assessment logic to remain project-scoped and non-cross-mutating.
- Add regression tests for cross-project reuse and managed save behavior.

## Phases
1. Add migration with additive columns/backfill/switch-over/drop old FK columns.
2. Update DB access code paths (`saveQuestions`, managed question save, assessments).
3. Regenerate DB types and fix compile errors.
4. Add/adjust integration tests.
5. Run format, typecheck, and integration tests.

## Risks and mitigations
- High migration blast radius: keep migration atomic and backfill via explicit joins.
- Cross-project mutation risk: enforce project-scoped predicates on deletes/updates.
- Runtime mismatch risk: ship migration + code together in same branch.

## Validation
- `pnpm run check --fix`
- `pnpm run check-types`
- targeted integration tests for import/questions/assessments
- `pnpm run test:integration`

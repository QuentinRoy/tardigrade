# Issue 1 Refactor Plan Audit

## Scope
This audit reviews the selected direction for Issue 1 (Option B): migrate export marking to use markRubric throughout, with a staged plan.

## Executive Verdict
Option B is viable, but only if done as an adapter-first migration.

Primary reason:
- Export currently uses a split model in src/export/submissionExportCsv.ts:
  - rubric metadata in ExportRubricPlan
  - assessment values in valuesByKey map
- markRubric in src/rubrics/rubric.ts requires a combined AssessedRubric object.

So the plan must first introduce a thin adapter at the export boundary, then move call sites, then remove old paths.

## Current-State Findings
1. Hard mismatch exists now
- Current code computes marks with markRubric(rubric) in src/export/submissionExportCsv.ts.
- rubric here is ExportRubricPlan (no assessment field), so this is structurally incompatible with markRubric(AssessedRubric).

2. Export data is already rich enough for adapter conversion
- Export has all rubric fields needed for marking:
  - boolean: marks and falseMarks
  - ordinal: marks map
  - numerical: minScore, maxScore, minMarks, maxMarks, reversed
- Export also has per-rubric assessment values in valuesByKey keyed by questionId::rubricId.

3. Runtime invariants are favorable
- loadQuestionPlan in src/export/submissionExport.ts normalizes missing boolean and numerical rows to defaults.
- That reduces migration risk because adapter output can be made stable.

4. Test coverage is good but incomplete for migration safety
- Existing tests cover CSV header ordering and row values in src/export/submissionExportCsv.test.ts.
- Missing migration-specific checks:
  - parity between old marking path and adapter + markRubric path
  - explicit mismatch behavior when rubric.type and value.type diverge

## Recommended Refactor Plan

### Phase 0: Safety Net
Goal: lock behavior before structural change.

Tasks:
1. Add parity tests in src/export/submissionExportCsv.test.ts for:
- boolean pass/fail
- ordinal label selection
- numerical reversed false and true
2. Add a mismatch test asserting throw when rubric type and assessment type differ.

Exit criteria:
- Tests fail if marks calculation behavior changes unexpectedly.

### Phase 1: Adapter Introduction (No Behavior Change)
Goal: create an export-only adapter that converts split export data into AssessedRubric shape.

Tasks:
1. In src/export/submissionExportCsv.ts add:
- a helper to convert (rubric, value) to AssessedRubric union
- explicit type guard or switch per rubric.type
2. Keep existing runtime behavior for null/undefined value identical.

Suggested helper contract:
- input: ExportRubricPlan and optional AssessmentRubricValue
- output: AssessedRubric with assessment null when value is absent
- throw on type mismatch

Exit criteria:
- No change in output rows compared to baseline tests.

### Phase 2: Switch Marking Call Site
Goal: use markRubric through the adapter, remove direct split-path assumptions.

Tasks:
1. Replace rubricMarks assignment in buildSubmissionExportRow:
- from split logic
- to markRubric(adapterResult)
2. Keep rubric assessment text output logic unchanged.

Exit criteria:
- Existing tests pass.
- New parity tests pass.

### Phase 3: Cleanup
Goal: remove temporary compatibility code and clarify contracts.

Tasks:
1. Delete obsolete code paths used only for interim compatibility.
2. Tighten local export helper types where now safe.
3. Document adapter invariants with short comments in complex branches only.

Exit criteria:
- No dead code.
- Types remain strict without any.

### Phase 4: Optional Hardening
Goal: reduce future drift.

Tasks:
1. Consider extracting adapter into a small shared utility if reused.
2. Add focused tests for helper-level behavior.

## Risk Register
1. Type drift risk
- Risk: adapter returns a shape that compiles but is semantically wrong.
- Mitigation: parity tests plus mismatch throw tests.

2. Silent scoring regressions
- Risk: numeric or falseMarks defaults change marks subtly.
- Mitigation: explicit tests for edge values and reversed behavior.

3. Over-coupling export and rubric modules
- Risk: export starts depending on internal rubric assumptions.
- Mitigation: keep adapter at export boundary and keep its API narrow.

## Acceptance Criteria
1. buildSubmissionExportRow returns identical marks and totals for existing fixtures.
2. markRubric is called with AssessedRubric-compatible data only.
3. Type mismatch between rubric and assessment throws deterministically.
4. No use of any.
5. check-types and tests pass.

## Validation Commands
- pnpm run check-types
- pnpm run check --fix
- pnpm run test -- src/export/submissionExportCsv.test.ts src/rubrics/rubric.test.ts

## Recommended Implementation Order
1. Add safety tests.
2. Add adapter helper (no call-site change yet).
3. Switch call site to adapter + markRubric.
4. Remove temporary code.
5. Run full type and test validation.

## Final Assessment
The plan is sound if executed incrementally. The key success factor is strict adapter boundaries plus parity tests before call-site migration.
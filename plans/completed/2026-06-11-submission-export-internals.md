# Submission export internals

Status: Completed
Date: 2026-06-11
Source: `docs/investigations/2026-05-25-source-structure-and-tech-debt-audit.md` Priority 4 (Findings 8, 10, 18; #32)
PRs: #151 (Ordinal Marks Minimum), #152 (export internals)

## Guidance consulted

- `CONTEXT.md` — gained **Rubric Subtype Invariant** and **Ordinal Marks Minimum** during planning.
- ADR 0007 (primitives take a handle), ADR 0004/0006 (no barrels, flat modules).
- `docs/reference/testing-conventions.md` (test selection).
- `.agents/skills/tdd/SKILL.md` — vertical red→green slices; characterization test pinned before refactors.
- `docs/guides/issue-and-pr-conventions.md`, `docs/guides/commit-message-conventions.md`.

## Decisions made while grilling

1. All four Priority 4 deliverables in scope, split across two PRs.
2. `groupSubmissionRows` yields raw groups (`submissionId`, submitter fields, `valuesByKey`), not finished export rows; plan-dependent mapping stays in `submissionExport.ts`.
3. `toRubric` stays strict for missing `booleanRubric` or `numericalRubric` data — those subtype tables always have exactly one row per rubric, so a missing row is a Rubric Subtype Invariant violation and throws. An ordinal rubric with zero `ordinal_rubric_value` rows is valid: it maps to `{ type: "ordinal", marks: {} }`, never silently coerced to `type: "boolean"`. Only a missing `ordinal_rubric` row itself (no row at all for an ordinal-typed rubric) throws.
4. Canonical rule: an ordinal rubric has at least 2 mark entries, enforced identically at the editor schema and the import schema (Ordinal Marks Minimum). The import schema already enforces it; the editor schema gains it.
5. No gate migration and no permanent DB trigger for the ordinal minimum. The app isn't deployed anywhere yet, and a DB-level gate can't protect against external/manual modifications anyway. Defense is at write boundaries (editor + import schemas) plus correct, non-misleading read behavior (decision 3).
6. Export derives its question plan from `loadQuestionRowsFromDb` (the primitive, fresh read — never the `"use cache"` wrapper, per ADR 0007 rule 6) mapped through strict `toRubric`; `ExportQuestionPlan` type stays in `submissionExportCsv.ts`.
7. Dated filenames standardize on `YYYY-MM-DD` via a shared helper in `src/export/`.
8. Test scope: pure grouping unit tests plus one DB integration test through the ADR 0007 seam. The marks-only-importability test is import-side and deferred.

## PR 1 — enforce Ordinal Marks Minimum at write boundaries (merged, #151)

TDD cycles (each RED → GREEN):

1. ✅ `questionDefinitionSchema` rejects an ordinal rubric with 0 mark entries, error on the marks path → add a ≥2 refine in `src/questions/schemas.ts` (same message as `src/import/schemas.ts`: "Ordinal rubric must have at least 2 mark entries").
2. ✅ Rejects exactly 1 entry.
3. ✅ Accepts 2 entries; the editor surfaces the field error through the existing `errors.ts` plumbing (touch only if the path mapping needs it).

Checks: `pnpm run check --fix`, `pnpm run check-types`, schema unit tests, question mutation integration tests — all done.

## PR 2 — export internals (merges after PR 1)

Order matters: pin behavior first, then refactor under green.

Status: all 7 steps implemented in the working tree (uncommitted). Type checks and targeted tests (`pnpm test src/export/ src/questions/questions.test.ts`, 29 tests) pass. `pnpm run check` only fails on an unrelated pre-existing `.claude/settings.local.json` formatting issue. Remaining: commit and open the PR.

1. ✅ **Characterization tracer**: new `src/export/submissionExport.integration.test.ts` against the test database — seed project, questions with mixed rubric types, several submissions including one with no assessments and sparse values; snapshot the CSV from `createCsvSubmissionExport`. Pins query ordering and end-to-end behavior.
2. ✅ **`toRubric`** in `src/questions/questions.ts`: throws on missing `booleanRubric` or missing `numericalRubric` (today both silently return a boolean shape) — true Rubric Subtype Invariant violations. An ordinal rubric with zero mark values maps to `{ type: "ordinal", marks: {} }`, not the boolean fallback; only a missing `ordinal_rubric` row throws. Requires the question-row query to report ordinal-rubric presence independently of whether it has any values (today's inner join on `ordinal_rubric_value` conflates "no `ordinal_rubric` row" with "zero values"). Valid mappings pinned, including the empty-marks case.
3. ✅ **Plan derivation** (refactor under green): delete `loadQuestionPlan`; derive `ExportQuestionPlan[]` from `loadQuestionRowsFromDb(db, …)` + `toRubric`.
4. ✅ **`groupSubmissionRows`** in new pure `src/export/submissionExportGrouping.ts` (no `server-only`), unit cycles: single-submission tracer → boundary detection between submissions → last flush → boolean/ordinal/numerical value classification and sparse values → input-order preservation. Then replace the `rows()` closure with the transform.
5. ✅ **ADR 0007 alignment** (refactor under green): `assertSubmissionInvariantsFromDb(db, { projectId })` and `streamSubmissionExportRowsFromDb(db, { projectId })` primitives; `createSubmissionExport` / `createCsvSubmissionExport` gain the trailing `{ db = defaultDb } = {}` seam used by the integration test.
6. ✅ **`buildDatedFilename`** unit-first in `src/export/`; both export routes adopt `YYYY-MM-DD` (submissions route changes from `YYYYMMDD`).
7. ✅ Simplify pass over modified code, `pnpm run check --fix`, `pnpm run check-types`, targeted unit + integration tests.

## Non-goals

- No DB-level gate or permanent trigger for the ordinal minimum (write-boundary validation only).
- No migration of import context loaders onto the shared read model (audit Finding 8 caution).
- No marks-only-import safety test (import-side, #32 territory).
- No change to `ExportOptions` or CSV column semantics.

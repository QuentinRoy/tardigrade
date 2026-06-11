# Submission export internals

Status: active
Date: 2026-06-11
Source: `docs/investigations/source-structure-and-tech-debt-audit.md` Priority 4 (Findings 8, 10, 18; #32)

## Guidance consulted

- `CONTEXT.md` — gained **Rubric Subtype Invariant** and **Ordinal Marks Minimum** during planning.
- ADR 0007 (primitives take a handle), ADR 0004/0006 (no barrels, flat modules).
- `docs/reference/database-migrations.md` (gate migration), `docs/reference/testing-conventions.md` (test selection).
- `.agents/skills/tdd/SKILL.md` — vertical red→green slices; characterization test pinned before refactors.
- `docs/guides/issue-and-pr-conventions.md`, `docs/guides/commit-message-conventions.md`.

## Decisions made while grilling

1. All four Priority 4 deliverables in scope, split across two PRs.
2. `groupSubmissionRows` yields raw groups (`submissionId`, submitter fields, `valuesByKey`), not finished export rows; plan-dependent mapping stays in `submissionExport.ts`.
3. `toRubric` becomes fully strict: missing `booleanRubric`, `numericalRubric`, or `ordinalRubric` data throws (Rubric Subtype Invariant). No tolerant read-side defaults.
4. Canonical rule: an ordinal rubric has at least 2 mark entries, enforced identically at the editor schema and the import schema (Ordinal Marks Minimum). The import schema already enforces it; the editor schema gains it.
5. Existing data: a non-destructive gate migration raises with a meaningful, actionable error listing violating ordinal rubrics and the recovery path (fix via question editor, re-deploy). No deletion, no permanent trigger — the question-save path deletes and recreates ordinal values mid-transaction, so a count trigger would transiently fire.
6. Export derives its question plan from `loadQuestionRowsFromDb` (the primitive, fresh read — never the `"use cache"` wrapper, per ADR 0007 rule 6) mapped through strict `toRubric`; `ExportQuestionPlan` type stays in `submissionExportCsv.ts`.
7. Dated filenames standardize on `YYYY-MM-DD` via a shared helper in `src/export/`.
8. Test scope: pure grouping unit tests plus one DB integration test through the ADR 0007 seam. The marks-only-importability test is import-side and deferred.

## PR 1 — enforce Ordinal Marks Minimum at write boundaries

TDD cycles (each RED → GREEN):

1. `questionDefinitionSchema` rejects an ordinal rubric with 0 mark entries, error on the marks path → add a ≥2 refine in `src/questions/schemas.ts` (same message as `src/import/schemas.ts`: "Ordinal rubric must have at least 2 mark entries").
2. Rejects exactly 1 entry.
3. Accepts 2 entries; the editor surfaces the field error through the existing `errors.ts` plumbing (touch only if the path mapping needs it).

Then the gate migration (not TDD; follows migration isolation conventions, precedent `20260514000002_enforce_ordinal_label_valid.ts`):

- raw SQL: count ordinal rubrics with fewer than 2 `ordinal_rubric_value` rows; if any, `RAISE EXCEPTION` listing rubric ids and instructing to fill in their marks or delete them via the question editor, then re-deploy. `down` is a no-op (validation only).

Checks: `pnpm run check --fix`, `pnpm run check-types`, schema unit tests, question mutation integration tests.

## PR 2 — export internals (merges after PR 1)

Order matters: pin behavior first, then refactor under green.

1. **Characterization tracer**: new `src/export/submissionExport.integration.test.ts` against the test database — seed project, questions with mixed rubric types, several submissions including one with no assessments and sparse values; snapshot the CSV from `createCsvSubmissionExport`. Pins query ordering and end-to-end behavior.
2. **Strict `toRubric`** in `src/questions/questions.ts`, one cycle per violation: throws on missing `booleanRubric`; missing `numericalRubric` (today silently returns a boolean shape); missing `ordinalRubric`. Valid mappings pinned.
3. **Plan derivation** (refactor under green): delete `loadQuestionPlan`; derive `ExportQuestionPlan[]` from `loadQuestionRowsFromDb(db, …)` + `toRubric`.
4. **`groupSubmissionRows`** in new pure `src/export/submissionExportGrouping.ts` (no `server-only`), unit cycles: single-submission tracer → boundary detection between submissions → last flush → boolean/ordinal/numerical value classification and sparse values → input-order preservation. Then replace the `rows()` closure with the transform.
5. **ADR 0007 alignment** (refactor under green): `assertSubmissionInvariantsFromDb(db, { projectId })` and `streamSubmissionExportRowsFromDb(db, { projectId })` primitives; `createSubmissionExport` / `createCsvSubmissionExport` gain the trailing `{ db = defaultDb } = {}` seam used by the integration test.
6. **`buildDatedFilename`** unit-first in `src/export/`; both export routes adopt `YYYY-MM-DD` (submissions route changes from `YYYYMMDD`).
7. Simplify pass over modified code, `pnpm run check --fix`, `pnpm run check-types`, targeted unit + integration tests.

## Non-goals

- No permanent DB trigger for the ordinal minimum.
- No migration of import context loaders onto the shared read model (audit Finding 8 caution).
- No marks-only-import safety test (import-side, #32 territory).
- No change to `ExportOptions` or CSV column semantics.

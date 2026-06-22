# R-009 — Import/export roundtrip contract

Status: Active
Created: 2026-06-22
Parent: `plans/active/2026-05-17-reliability-hardening.md` (risk R-009, Tier 1, issue [#27](https://github.com/QuentinRoy/grading/issues/27))

## Purpose

Lock in two contracts that are currently implicit:

1. **Roundtrip fidelity** — assessment columns from a CSV export re-import
   without semantic drift.
2. **Marks-only files are explicitly rejected, not silently dropped** — a file
   that has nothing to import (because its only recognized columns are derived
   export output: `:marks`, bare question-id totals, `grand_total_marks`)
   currently produces a silent zero-write "success". That is a UX trap: a user
   who re-imports their own export with `includeRubricAssessment: false` sees
   nothing happen and no explanation.

## Decisions locked (do not re-litigate)

1. **Scenario B is a new Blocking Diagnostic, not a warning.** A file with zero
   matched assessment columns can never produce a write, so blocking changes
   only the *messaging* (an explicit blocked status instead of a silent
   zero-write success) — it does not change what gets persisted. No new
   "Import Warning" domain term is needed; this fits the existing **Blocking
   Diagnostic** definition in `CONTEXT.md` (an import whose plan contains any
   blocking diagnostic writes nothing — already true here, even without
   blocking).
2. **Trigger condition (broad):** fires whenever the header contains zero
   columns matching `context.rubricsByColumn`, regardless of whether any
   derived/ignored columns are present. This also covers the empty-CSV case
   (no rows, header is just `submission_type`/`submitter`) and the
   zero-rubrics-project case (a project with no rubrics can never have a file
   block in any other way) — both block consistently with the same rule.
3. **New diagnostic shape:** a header-level variant on
   `AssessmentImportBlockingDiagnostic`, `{ type: "no-assessment-columns" }`
   (no `row`/`column` fields — same shape pattern as the existing
   `unknown-column` variant). Detected once per import in
   `prepareAssessmentImport`: after building `headerColumns`, push it when
   `!headerColumns.some((column) => context.rubricsByColumn.has(column))`.
   Empty CSV note: `headerColumns` is derived from `Object.keys(rows.at(0) ?? {})`
   (`prepareAssessmentImport.ts:141`), so a CSV with no data rows yields
   `headerColumns = []`, which satisfies the same condition and blocks — the
   degenerate path, not true header introspection.
4. **No short-circuiting.** Row-level diagnostics (`unmatched-submission`,
   `ambiguous-submission`, `invalid-value`) are still computed and reported
   alongside `no-assessment-columns`, exactly as today — the function reports
   everything it finds rather than stopping early.
5. **Message text** (in `saveAssessments.ts`'s `formatBlockingDiagnostic`):
   `"No assessment columns found in this file. Nothing would be imported."`
6. **Roundtrip test covers both export shapes, in the new
   `src/import/assessmentImportRoundtrip.integration.test.ts` file:**
   - Full export (`includeRubricAssessment: true, includeRubricMarks: true`,
     matching the existing export integration test's default): re-import
     reproduces identical assessment values (`writes` match the originals
     exactly), marks/question-total/grand-total columns land in
     `ignoredColumns`, zero blocking diagnostics.
   - Assessment-only export (`includeRubricMarks: false`): same fidelity
     assertion without any derived columns to filter.
   - Marks-only export (`includeRubricAssessment: false,
     includeRubricMarks: true`): re-import is blocked with
     `no-assessment-columns`, `writes` is empty.
7. **File placement & shape:** the roundtrip test is an import-pipeline
   contract (the export is just the fixture source), so it lives under
   `src/import/`, not `src/export/`. It builds its fixture the same way as
   `src/export/submissionExport.integration.test.ts` (mixed rubric-type
   question, one fully-assessed submission), exports via
   `createCsvSubmissionExport`, then runs the CSV through
   `parseAssessmentsCsv` → `loadAssessmentImportContextFromDb` →
   `prepareAssessmentImport` to assert the **plan** (not the write path, which
   R-001/R-004 already cover). Re-import into the **same project** with its
   assessments left in place: the full/assessment-only scenarios then expect
   `plan.writes` to reproduce the seeded values exactly and `plan.overwrites`
   to cover every one of them, with `plan.blockingDiagnostics` empty. (Same
   project avoids recreating submissions/questions in a second project and also
   exercises overwrite detection for free.)

## Verified facts (checked against code 2026-06-22)

- **Column naming aligns end to end.** Export assessment columns are
  `${questionId}:${rubricId}` (`submissionExportCsv.ts:99`); import keys
  `context.rubricsByColumn` identically (`assessmentImportContext.ts:37`).
  Derived columns (`…:marks`, bare `${questionId}`, `grand_total_marks`) are
  all recognized-and-ignored by `prepareAssessmentImport`'s header loop, never
  unknown.
- **Values roundtrip without drift.** Booleans are cast to `"true"`/`"false"`
  on export (`submissionExport.ts:266` `cast: { boolean }`) and lowercased +
  compared on import (`parseAssessmentValue`); ordinal `selectedLabel` matches
  the rubric's labels; numerical `score` survives `parseFloat`.
- **Numerical `score` is a JS `number`, not a string.** The column is
  `numeric(10, 6)` (`20260513000000_init.ts:326`); the `pg` driver returns
  `numeric` (OID 1700) as a string by default, but `kysely.ts:11` registers a
  global `setTypeParser(1700, Number)`, so it comes back as a number
  (generated type `Numeric = ColumnType<number, …>`). That parser is a side
  effect of importing `src/db/kysely.ts`; if a test pool ever bypassed it,
  `score` could surface as a string — harmless here, since re-import does
  `parseFloat` and the assertion compares against the seeded number.
- **The existing test stays green.** `prepareAssessmentImport reports derived
  export columns as ignored, never blocking` (`prepareAssessmentImport.test.ts:220`)
  includes a real `q1:r-bool` assessment column in its row, so the new
  diagnostic does **not** fire on it. The new marks-only unit test must use a
  row with **no** assessment column (only `:marks` / bare-question / grand-total).
- **`saveAssessments` already writes nothing today on this input** — it just
  reports a silent zero-write success. Adding the diagnostic flips that to an
  explicit blocked status; no persisted behavior changes.

## Out of scope

- Building the deferred plan→preview→confirm UX
  (`docs/design/2026-06-10-import-parse-prepare-write-seams.md` explicitly
  defers this; the investigation overlap audit scopes import-preview UI out of
  the reliability tracker). This task only adds a new diagnostic value to the
  existing one-shot flow's flattened message.
- R-010 (numerical rubric math boundaries) — separate risk, separate task.
- Any change to `ignoredColumns` classification rules.

## Acceptance (Tier 1 Definition of Done)

- [ ] `AssessmentImportBlockingDiagnostic` gains the `no-assessment-columns`
      variant; `prepareAssessmentImport` detects it; `saveAssessments.ts`'s
      `formatBlockingDiagnostic` handles it (exhaustive switch keeps this
      type-checked).
- [ ] Unit coverage in `prepareAssessmentImport.test.ts`: marks-only header
      blocks with `no-assessment-columns`; empty CSV (no rows) blocks the same
      way; a header with at least one assessment column does not block even
      when zero rows have a value for it.
- [ ] `src/import/assessmentImportRoundtrip.integration.test.ts` covers the
      three scenarios in decision 6.
- [ ] `pnpm run check --fix`, `pnpm run check-types`, targeted
      `pnpm test src/import/` green.
- [ ] R-009 promoted to Verified in
      `plans/active/2026-05-17-reliability-hardening.md` with linked test
      files; dashboard counts and Change Log updated. PR body includes
      `Fixes #27`.

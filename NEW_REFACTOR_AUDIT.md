# Refactor Audit

This file tracks the issues that came up during the export/rubric refactor, what we changed, and why the final shape is easier to work with.

## 1. Export row building needed a clearer contract

### Problem

The export path was mixing two different shapes:

- raw export rubric metadata
- assessed rubric data

That made the row-building code harder to reason about and created confusion about where assessment attachment should happen.

### What we changed

- Kept `buildSubmissionExportRow()` focused on row formatting.
- Moved the assessed-question shape to the call site instead of rebuilding it inside the tests.
- Updated the tests in [src/export/submissionExportCsv.test.ts](src/export/submissionExportCsv.test.ts) so they build explicit assessed fixtures.

### Result

The row builder is easier to read because it now receives the shape it actually needs. The tests are also simpler because they show the final data shape directly instead of introducing a helper transformation layer.

### DX note

This was the biggest readability win. The function under test is now obvious from the fixture.

## 2. Test helpers were hiding the real behavior

### Problem

The earlier test setup reconstructed assessed questions by mapping values through keys and helper conversion. That was correct, but it made the test harder to scan.

### What we changed

- Removed the key-based transformation path from the test file.
- Replaced it with explicit assessed fixtures for:
  - fully assessed questions
  - failed boolean assessments
  - unassessed questions

### Result

The tests now read like examples of `buildSubmissionExportRow()` inputs and outputs. That is much better for maintenance and debugging.

### DX note

This reduced indirection and made the test file much easier to edit without re-learning the helper logic.

## 3. Rubric scoring needed a single source of truth

### Problem

We wanted the scoring rules to live in one place instead of being duplicated across export, assessment UI, and tests.

### What we changed

- Kept the scoring helpers in [src/rubrics/rubric.ts](src/rubrics/rubric.ts).
- Used `attachAssessment()` to build assessed rubrics from raw rubric data and assessment values.
- Kept `markRubric()` as the single marking entry point for assessed rubrics.

### Result

The rubric module now owns the scoring rules, which makes the domain behavior easier to follow.

### DX note

The tradeoff is that the generic narrowing in `attachAssessment()` is still a little dense, but at least the branching logic is centralized instead of scattered.

## 4. Schema/runtime mismatch caused a build break

### Problem

We hit a runtime schema mismatch during the build path when the database shape and the code assumptions were out of sync.

### What we changed

- Verified the migration state.
- Normalized numeric DB values in [src/db/questions.ts](src/db/questions.ts) where needed.
- Confirmed the export path and schema line up again.

### Result

The build issue was resolved, and the export path is no longer depending on stale schema assumptions.

### DX note

This was a good reminder that typecheck success is not enough when the database schema is involved.

## 5. Current code quality assessment

### Good

- Domain logic is more centralized.
- The export row formatter is easier to scan.
- The tests are less clever and more direct.
- The data-loading path in the export flow is explicit and predictable.

### Still rough

- `createSubmissionExport()` is still a fairly stateful streaming function.
- `attachAssessment()` still has some type-system ceremony.
- The export pipeline has a lot of moving parts, so future edits need care.

## 6. What to remember next time

1. Keep export tests on explicit fixtures.
2. Keep normalization at the edge.
3. Avoid test-only helper layers when the direct fixture is readable.
4. Prefer simple call-site shape over clever transformations.

## 7. Status

- Issue tracking is restored in this file.
- The final code shape is documented above.
- The main unresolved risk is future drift between schema defaults and runtime assumptions.

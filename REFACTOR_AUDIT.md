# Refactor Audit

This file records the original issues we tried to fix, what changed, and which extra cleanup items happened along the way.

## Original issues we were trying to fix

### Issue 1: Export row building used the wrong data shape

The export path needed to work with assessed rubric data in a way that matched the row builder.

What changed:
- `buildSubmissionExportRow()` stayed focused on formatting the final row.
- The export/tests were adjusted to provide the shape the row builder actually expects.

Result:
- The export contract is clearer now.
- The row builder is easier to read because it receives already-prepared data.

### Issue 2: Test fixture construction was too indirect

The tests originally rebuilt assessed questions through helper logic and key lookups.

What changed:
- The test file now uses explicit assessed fixtures.
- The row tests directly show the data shape under test instead of rebuilding it through transformation helpers.

Result:
- Better DX.
- Less mental overhead when reading or changing the tests.

### Issue 3: Rubric scoring needed to stay centralized

The scoring rules belong in the rubric domain, not spread across callers.

What changed:
- The rubric helpers remain centralized in [src/rubrics/rubric.ts](src/rubrics/rubric.ts).
- `attachAssessment()` is still the bridge from raw assessment values to assessed rubrics.
- `markRubric()` remains the single scoring entry point once a rubric has been assessed.

Result:
- The domain logic is easier to find.
- The code is more consistent, even if the generic narrowing still has some type-system ceremony.

### Issue 4: Runtime schema and code assumptions drifted

We hit a build/runtime mismatch when the database shape did not match the export path assumptions.

What changed:
- The migration state was checked.
- Numeric values were normalized in [src/db/questions.ts](src/db/questions.ts).
- The export path was brought back into alignment with the schema.

Result:
- The build issue was resolved.
- This reinforced that typecheck success alone is not enough for DB-backed code.

## Additional work that happened beyond the original issues

These items were necessary cleanup, but they were not the original audit targets.

### 1. The export streaming flow was clarified

`createSubmissionExport()` is still a streaming state machine, but its data loading and row flushing are now easier to follow.

Why it matters:
- The code is still a bit dense, but the transformation boundaries are more visible.
- This was a readability improvement, not a new functional requirement.

### 2. The tests were rewritten to be more direct

The new tests are not just a fix for correctness. They are a quality-of-life improvement.

What was added:
- fully assessed fixtures
- failed-boolean fixtures
- unassessed fixtures

Why it matters:
- The tests now reflect the actual contract of `buildSubmissionExportRow()`.
- This is easier for future changes than a helper-driven setup.

### 3. There was a recovery phase after the first round of edits

Some of the earlier work was done while the branch and implementation path were still being recovered.

What that meant in practice:
- files were repaired to get back to a working state,
- the export/rubric path was re-aligned,
- and only then was the cleanup written down in this audit.

Why it matters:
- It explains why this refactor touched more than the original audit list.
- It also explains why some changes were about recovery and simplification, not just feature-level fixes.

## Current read on the code

### Good

- Rubric scoring is centralized.
- The export row builder is more explicit.
- The tests are easier to read.
- The data-loading path is predictable.

### Still rough

- `createSubmissionExport()` is still fairly stateful.
- `attachAssessment()` still has some generic narrowing complexity.
- The export pipeline has enough moving parts that future edits should stay careful.

## Bottom line

The original issues were mostly about contract shape, test readability, and keeping rubric logic centralized.

The additional work was cleanup and recovery:
- making the tests direct,
- clarifying the export flow,
- and fixing runtime/schema drift.

That extra work should be treated as follow-up work, not as part of the original problem statement.

# R-010 — Numerical rubric score-range invariant

Status: Active
Created: 2026-06-22
Parent: `plans/active/2026-05-17-reliability-hardening.md` (risk R-010, Tier 1, issue [#23](https://github.com/QuentinRoy/grading/issues/23))
Branch: `r010-numerical-rubric-score-range`

## Purpose

R-010 began as "add characterization tests for `markNumericalRubric` boundaries."
Grilling (`/grill-with-docs`, 2026-06-22) found a real hole the original scope
missed, so the task grew into enforcing one domain invariant — **a numerical
rubric must satisfy `minScore < maxScore`** — identically at every write
boundary, plus failing loudly in the marking function instead of returning
`NaN`.

The hole: `markNumericalRubric` (`src/rubrics/rubric.ts:36`) guards only
`scoreRange < 0`. When `minScore === maxScore` the score is forced to equal both
bounds, `scoreOffset` is `0`, and the interpolation computes `0 / 0 = NaN`,
returned **silently**. `markRubric` calls straight into it, so a collapsed-range
rubric would push `NaN` marks into export, the assessment summary, the rubric
overview, and `RubricGradeRow`. Meanwhile the interactive write path
(`saveNumericalAssessment`, `src/assessments/assessmentMutations.ts:225`) already
rejects `maxScore <= minScore`, and the import schema
(`src/import/schemas.ts:63`) already rejects `minScore >= maxScore` — but the
**editor** schema and the **DB** do not. So the invariant is enforced
inconsistently across boundaries, exactly what `CONTEXT.md` ("enforced
identically at every write boundary") warns against.

## Decisions locked (do not re-litigate)

1. **Collapsed range throws; it does not return a defined value.** The user
   considered returning `minMarks` (the `scoreOffset → 0` limit) but chose to
   **throw**, aligning the marking function with the write validators. The guard
   becomes `scoreRange <= 0` (was `< 0`), and the message drops "or equal to":
   `Invalid rubric: maxScore (X) must be greater than minScore (Y)`. This is a
   deliberate behavior change (silent `NaN` → throw). It is an **invariant
   violation** error, not a user-facing recoverable error, consistent with the
   `CONTEXT.md` *Rubric Subtype Invariant* ("readers fail loudly on a violation
   instead of substituting defaults") — keep it a plain `Error`, no
   actionable-recovery shaping.
2. **Enforce at every write boundary (defense in depth), because the user
   required collapsed rubrics to be "impossible":**
   - **Editor zod** (`src/questions/schemas.ts`): gap → close it.
   - **DB CHECK** (`numerical_rubric`): gap → close it with a new migration.
   - **Import zod** (`src/import/schemas.ts:63`): already enforced → leave as-is.
   - **`markNumericalRubric`**: fail loudly (decision 1).
   All four then agree on the same strict rule: `maxScore > minScore`.
3. **Editor check placement.** Add it inside the existing `superRefine` on
   `questionDefinitionSchema` (`src/questions/schemas.ts:57`), where rubric-level
   cross-field validation already lives (id uniqueness). Iterate
   `question.rubrics`; for a `type === "numerical"` rubric with
   `minScore >= maxScore`, push a field issue at
   `["rubrics", index, "maxScore"]`. This sidesteps any
   `discriminatedUnion` + `.refine` friction and co-locates the rule with the
   other rubric validation. Message: `Max score must be greater than min score`.
4. **DB constraint is a new migration**, never a rewrite of the committed
   `20260513000000_init.ts`. Add `CHECK (max_score > min_score)` to
   `numerical_rubric`, with a `down()` that drops it. Follow
   `docs/reference/database-migrations.md`.
5. **`minMarks <= maxMarks` editor parity is OUT OF SCOPE.** Import enforces it
   (`src/import/schemas.ts:60`); the editor does not. It is a *different*
   invariant — `markNumericalRubric` tolerates inverted marks (it interpolates
   fine, no `NaN`), so it carries no correctness hazard here. Folding it in would
   blur R-010's story. Flag it as a separate follow-up risk instead (see
   "Follow-up").
6. **No ADR.** This applies the already-documented *Rubric Subtype Invariant* /
   fail-loudly pattern, already precedented by R-002's DB enforcement on this
   exact table. Not hard-to-reverse, not surprising.
7. **Add a `CONTEXT.md` glossary entry, `Numerical Score Range`**, parallel to
   *Ordinal Marks Minimum*. Land it in the same PR as the enforcement so the
   glossary never describes an unenforced rule. Proposed text:

   > **Numerical Score Range**:
   > A numerical **Rubric Definition** must satisfy `minScore < maxScore`,
   > enforced identically at every write boundary (editor, import, and a DB
   > CHECK). The marking function fails loudly on a violation rather than
   > returning `NaN`; a collapsed or inverted range is not an authorable state.
   > _Avoid_: zero-width score ranges, tolerant `NaN` marks, per-boundary rules
   > that disagree.

## TDD execution (behavior changes go red→green; characterization is a net)

Per `/tdd` (user instruction: "any behavior change must follow /tdd pattern for
the new boundaries"). Only the three boundary changes are behavior changes and
get a failing test first. The `markNumericalRubric` characterization tests pin
**existing** behavior, are green the moment written, and act as a golden-master
net protecting slice 1 — they are not TDD slices and writing them is not
horizontal slicing.

Do the work as vertical slices, in this order. Run the targeted test after each
step; do not batch.

### Step 0 — Characterization net (green immediately), `src/rubrics/rubric.test.ts`

Before touching `rubric.ts`, add tests that assert today's behavior. Rename the
stale `describe("scoreToMarks")` / `describe("booleanToMarks")` blocks to the
actual function names (`markNumericalRubric`, `markBooleanRubric`) since the file
is being edited. Cases (all pass against current code):

- non-reversed edge: `score === minScore → minMarks`.
- non-reversed edge: `score === maxScore → maxMarks`.
- reversed edge: `score === minScore → maxMarks`.
- reversed edge: `score === maxScore → minMarks`.
- a mid-range interpolation case with non-zero `minMarks` and/or negative marks
  (characterizes the linear formula, not just the `minMarks = 0` happy path).
- `score > maxScore` throws.
- `score < minScore` throws.
- `minScore > maxScore` (strictly inverted, `scoreRange < 0`) throws.

### Slice 1 — `markNumericalRubric` collapsed range (behavior change)

- **RED:** `markNumericalRubric throws when minScore === maxScore`. Fails today
  (returns `NaN`, no throw).
- **GREEN:** change the guard in `src/rubrics/rubric.ts` from `scoreRange < 0` to
  `scoreRange <= 0` and update the message (decision 1).

### Slice 2 — Editor zod (new boundary), `src/questions/schemas.ts`

- **RED:** in `src/questions/schemas.test.ts`, `questionDefinitionSchema rejects a
  numerical rubric with minScore === maxScore` — assert
  `result.success === false` and an issue at path `rubrics.0.maxScore` with
  message `Max score must be greater than min score`. Fails today (parses fine).
  Use `safeParse` and the `issue.path.join(".")` matching already used in that
  file.
- **GREEN:** add the `superRefine` check (decision 3).
- **Then (green after impl, confirming + characterization):**
  - `rejects a numerical rubric with minScore > maxScore` (same path/message).
  - `accepts a numerical rubric with minScore < maxScore`.

### Slice 3 — DB CHECK (new boundary)

- **RED:** in `src/db/constraints.integration.test.ts`, add a case asserting a
  `numericalRubric` insert with `maxScore === minScore` is rejected and rolls
  back inside a transaction (mirror the existing R-002 rollback assertions in
  that file; it already inserts into `numericalRubric` directly). Fails today
  (insert succeeds).
- **GREEN:** new migration
  `src/db/migrations/<timestamp>_enforce_numerical_rubric_score_range.ts` adding
  `ALTER TABLE "numerical_rubric" ADD CONSTRAINT "numerical_rubric_score_range_check"
  CHECK ("max_score" > "min_score")`, with a `down()` dropping the constraint.
- **Then (green after migration, confirming):** `maxScore < minScore` likewise
  rejected. The existing valid-row fixtures already cover the accept case.

### Refactor / simplify pass

After all slices are green, run the simplify pass (`.agents/skills/simplify/SKILL.md`)
over the touched code only (`rubric.ts`, `schemas.ts`, the migration, the three
test files). Preserve behavior; no broad refactors.

## Verified facts (checked against code 2026-06-22)

- **`markNumericalRubric` guards only `scoreRange < 0`** (`src/rubrics/rubric.ts:41`);
  `minScore === maxScore` reaches the `0 / 0` interpolation and returns `NaN`.
- **Interactive write path already rejects `maxScore <= minScore`**
  (`src/assessments/assessmentMutations.ts:225`), so a collapsed-range numerical
  *assessment* cannot be saved through grading today — but that does not stop a
  collapsed-range *rubric config* from being authored.
- **Import zod already enforces `minScore < maxScore`** (`src/import/schemas.ts:63`)
  and `minMarks <= maxMarks` (`:60`).
- **Editor zod does NOT enforce either.** `numericalRubricDefinitionSchema`
  (`src/questions/schemas.ts:31`) only types the four numbers; the `superRefine`
  (`:57`) checks only rubric-id uniqueness.
- **DB has no `max_score > min_score` check.** `numerical_rubric` declares
  `min_score`/`max_score` as `notNull` `numeric(10, 2)` with no CHECK
  (`src/db/migrations/20260513000000_init.ts:197`). The only numerical DB guard
  is the assessment-score-bounds trigger (`20260514000001_…`) and the
  subtype-match trigger — neither constrains the config range.
- **Callers of `markNumericalRubric` (via `markRubric`)**: `submissionExport.ts:195`,
  `assessmentSummary.ts:23`, `rubricOverviewBuilder.ts:250`,
  `RubricGradeRow.tsx:35`. All would surface `NaN` today on a collapsed-range
  rubric with a recorded assessment.

## Out of scope

- `minMarks <= maxMarks` editor parity (decision 5) — separate follow-up risk.
- Any change to the import schema (already correct) or to the interactive
  assessment write path (already correct).
- Reworking `markNumericalRubric`'s out-of-range / inverted-range throws — those
  already exist and are only being characterized, not changed.

## Acceptance (Tier 1 Definition of Done)

- [ ] `markNumericalRubric` throws on `scoreRange <= 0` with the updated message;
      slice-1 RED test and the Step-0 characterization net all green.
- [ ] `questionDefinitionSchema` rejects `minScore >= maxScore` with a
      `rubrics.<i>.maxScore` field issue; slice-2 tests green.
- [ ] New migration adds `CHECK (max_score > min_score)` to `numerical_rubric`
      with a working `down()`; slice-3 integration tests green; migration applies
      cleanly (`pnpm` migration task).
- [ ] `CONTEXT.md` gains the `Numerical Score Range` entry (decision 7).
- [ ] Regression check (TDD discipline): temporarily revert each GREEN change and
      confirm its RED test fails, then restore.
- [ ] `pnpm run check --fix`, `pnpm run check-types`, `pnpm test:unit rubric schemas`,
      `pnpm test src/db/` all green.
- [ ] R-010 promoted to Verified in
      `plans/active/2026-05-17-reliability-hardening.md`: rewrite the Risk/Next
      Action wording (it became multi-layer enforcement with a deliberate
      `NaN → throw` behavior change — the prior "no behavior change expected" is
      now false), link the test files, refresh the Section 3 dashboard
      (Tier 1: 0 open, 7 verified) and milestones (M4/M5), and add a Change Log
      entry. PR body includes `Fixes #23`.
- [ ] Move this plan to `plans/completed/` on merge.

## Follow-up (new risk to register, not done here)

Editor/import asymmetry on `minMarks <= maxMarks`: import rejects inverted marks
(`src/import/schemas.ts:60`), the editor does not. Lower severity than the score
range (no `NaN`; `markNumericalRubric` interpolates inverted marks fine), but it
is still a write-boundary inconsistency. Register as its own Tier 1/Tier 2 risk
with a GitHub issue rather than folding into R-010.

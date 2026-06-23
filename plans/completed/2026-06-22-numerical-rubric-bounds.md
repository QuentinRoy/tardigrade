# R-010 — Numerical rubric bounds invariants (score range + marks ordering)

Status: Done
Created: 2026-06-22
Parent: `plans/completed/2026-05-17-reliability-hardening.md` (risk R-010, Tier 1, issue [#23](https://github.com/QuentinRoy/grading/issues/23))
Branch: `numerical-rubric-bounds`

## Purpose

R-010 began as "add characterization tests for `markNumericalRubric` boundaries."
Grilling (`/grill-with-docs`, 2026-06-22) reshaped it into two coordinated
changes:

1. **Establish one rule for the marking function** — it is a *pure computer* that
   throws only when it cannot produce a finite result, and trusts its inputs
   otherwise. Today it is an inconsistent mix: it computes, but also validates
   (inverted range, out-of-range score) while *silently* returning `NaN` for the
   one case it should reject. We make it consistent.
2. **Enforce the two numerical-rubric well-formedness rules at every write
   boundary** — `minScore < maxScore` and `minMarks <= maxMarks` — closing the
   editor and DB gaps so these states are impossible to persist. All rubric
   validity then lives at the write boundaries, not in the marking function.

### The marking function today (`src/rubrics/rubric.ts:36`)

```
if (scoreRange < 0) throw …          // validation (inverted range)
if (score > maxScore) throw …        // validation (out-of-range score)
if (score < minScore) throw …        // validation (out-of-range score)
return minMarks + scoreOffset*(maxMarks-minMarks)/scoreRange
```

- `scoreRange === 0` (collapsed range) is **not** caught: `scoreOffset/0`
  produces `NaN` (or `Infinity`), returned silently. `markRubric` feeds it into
  export, the assessment summary, the rubric overview, and `RubricGradeRow`, so
  `NaN` can reach displayed/exported grades.
- `scoreRange < 0` (inverted) and out-of-range scores are **computable** — they
  yield finite values — so the existing throws are *validation*, not
  computational necessity. (Verified: with `minScore 10, maxScore 5, minMarks 0,
  maxMarks 10, score 7`, removing the guards gives `(−3·10)/−5 = 6`, finite.)

### Current enforcement of the two rules (before this task)

| Boundary | `minScore < maxScore` | `minMarks <= maxMarks` |
|---|---|---|
| Import zod (`src/import/schemas.ts:63`, `:60`) | ✅ | ✅ |
| Editor zod (`src/questions/schemas.ts`) | ❌ | ❌ |
| DB (`numerical_rubric`) | ❌ | ❌ |

`CONTEXT.md` already warns against this asymmetry ("enforced identically at every
write boundary"). The interactive write path also rejects `maxScore <= minScore`
(`src/assessments/assessmentMutations.ts:225`) and the DB trigger
`enforce_numerical_score_bounds` (`20260514000001`) rejects out-of-range
*assessment scores* on every write path — so once the editor and DB CHECK close
their gaps, the marking function can safely trust its inputs.

## Decisions locked (do not re-litigate)

1. **`markNumericalRubric` becomes a pure computer: it throws iff it cannot
   compute a finite result.** The only such case is a **zero-width score range**
   (`scoreRange === 0`), where `scoreOffset/0` is `NaN`/`Infinity`. End state:

   ```ts
   const scoreRange = rubric.maxScore - rubric.minScore;
   if (scoreRange === 0) {
     throw new Error(
       `Cannot mark a numerical rubric with a zero-width score range ` +
       `(minScore and maxScore are both ${rubric.minScore})`,
     );
   }
   const scoreOffset = rubric.reversed
     ? rubric.maxScore - score
     : score - rubric.minScore;
   return rubric.minMarks +
     (scoreOffset * (rubric.maxMarks - rubric.minMarks)) / scoreRange;
   ```

   Concretely this means:
   - **Add** the `scoreRange === 0` guard (closes the silent-`NaN` hole). `=== 0`
     also catches the `x/0 → Infinity` sub-case where a stray score accompanies a
     collapsed range, so it covers every division-by-zero.
   - **Remove** the `scoreRange < 0` (inverted) throw — inverted ranges compute a
     finite descending value, and the editor + DB CHECK now make them
     unrepresentable.
   - **Remove** both out-of-range-score throws — out-of-range scores extrapolate
     to a finite value, and the DB trigger `enforce_numerical_score_bounds`
     already makes them unpersistable on every path.
   - **No marks-ordering throw** — `minMarks > maxMarks` computes a finite
     descending value; it is never the marking function's concern.

   Rationale for keeping *only* the zero-width guard while removing the others:
   all four prevented states are blocked upstream by write boundaries, so none is
   reachable in practice; but the zero-width case is the only one whose
   "leakage" symptom is **non-finite garbage** (`NaN`/`Infinity`) silently
   entering grades, versus a wrong-but-finite number. The guard is one cheap line
   against the single catastrophic, hard-to-detect failure. This is the
   `CONTEXT.md` *Rubric Subtype Invariant* "fail loudly instead of substituting
   defaults" applied precisely where a silent default would be `NaN`.

2. **All rubric well-formedness rules live only at the write boundaries.** The
   marking function does not validate rubric configuration or score range
   membership. This removes the duplication concern: the validity rules are not
   copied into the marking function at all.

3. **Enforce both rules at every write boundary (defense in depth):**
   - **Editor zod** (`src/questions/schemas.ts`): add both checks → close gaps.
   - **DB CHECK** (`numerical_rubric`): add both checks via one new migration.
   - **Import zod** (`src/import/schemas.ts`): already enforces both → leave it.
   Strictness matches import and the math: score strict (`>`), marks non-strict
   (`>=`, flat marks are valid).

4. **Editor check placement.** Both go inside the existing `superRefine` on
   `questionDefinitionSchema` (`src/questions/schemas.ts:57`), where rubric-level
   cross-field validation already lives (id uniqueness). For a
   `type === "numerical"` rubric:
   - `minScore >= maxScore` → issue at `["rubrics", index, "maxScore"]`, message
     `Max score must be greater than min score`.
   - `minMarks > maxMarks` → issue at `["rubrics", index, "maxMarks"]`, message
     `Max marks must be greater than or equal to min marks`.

5. **DB constraints are a new migration**, never a rewrite of committed
   `20260513000000_init.ts`. One file
   `src/db/migrations/<timestamp>_enforce_numerical_rubric_bounds.ts` adding both:
   - `CHECK ("max_score" > "min_score")` (`numerical_rubric_score_range_check`)
   - `CHECK ("max_marks" >= "min_marks")` (`numerical_rubric_marks_range_check`)
   with `down()` dropping both. Columns confirmed `min_score`/`max_score`/
   `min_marks`/`max_marks`, all `numeric(10, 2)` notNull
   (`20260513000000_init.ts:201-204`). Per `docs/reference/database-migrations.md`.
   Building both checks across slices 4–5 in the same not-yet-applied local
   migration is allowed under the local-development exception.

6. **No ADR.** Applies the documented *Rubric Subtype Invariant* / fail-loudly
   pattern, precedented by R-002's DB enforcement on this table. Not
   hard-to-reverse, not surprising.

7. **Add a `CONTEXT.md` glossary entry, `Numerical Rubric Bounds`**, parallel to
   *Ordinal Marks Minimum*. Land it in the same PR. Proposed text:

   > **Numerical Rubric Bounds**:
   > A numerical **Rubric Definition** must satisfy `minScore < maxScore` (a
   > collapsed or inverted score range is not authorable) and
   > `minMarks <= maxMarks` (marks may be flat but not inverted). Both are
   > enforced identically at every write boundary — editor, import, and a DB
   > CHECK. The marking function is a pure computer: it trusts validated inputs
   > and throws only on a zero-width score range, the one case that would
   > otherwise yield `NaN` rather than a finite mark.
   > _Avoid_: zero-width or inverted score ranges, inverted marks ranges,
   > tolerant `NaN` marks, per-boundary rules that disagree, re-validating rubric
   > shape inside the marking function.

## TDD execution

Per `/tdd` (user: "any behavior change must follow /tdd"). The marking function
now has **four** behavior changes (add zero-width throw; remove inverted throw;
remove both out-of-range throws — observable as "now returns a finite value"),
plus the two write-boundary additions. Each behavior change gets a failing test
first. Only the genuinely unchanged behaviors are characterization (green on
arrival); writing those is not horizontal slicing.

Vertical slices, in order. Run the targeted test after each step.

### Step 0 — Characterization net (green immediately), `src/rubrics/rubric.test.ts`

Assert today's behavior that survives the change. Rename the stale
`describe("scoreToMarks")` / `describe("booleanToMarks")` blocks to the real
function names. Cases (pass before and after):

- maps low scores to low marks (existing); reverses when requested (existing).
- non-reversed edges: `score === minScore → minMarks`, `score === maxScore →
  maxMarks`.
- reversed edges: `score === minScore → maxMarks`, `score === maxScore →
  minMarks`.
- mid-range interpolation with non-zero `minMarks` and/or negative marks.
- inverted marks tolerated: `minMarks > maxMarks` returns the descending value,
  no throw (true today and after).

### Slice 1 — zero-width score range throws (behavior change)

- **RED:** `throws when minScore === maxScore` — fails today (returns `NaN`).
- **GREEN:** add the `scoreRange === 0` guard (decision 1).

### Slice 2 — inverted score range computes, no throw (behavior change)

- **RED:** `markNumericalRubric with minScore > maxScore returns the finite
  descending value` (e.g. the `6` worked example) — fails today (the `< 0` guard,
  and the out-of-range guards, throw).
- **GREEN:** remove the `scoreRange < 0` guard **and** both out-of-range-score
  guards (they jointly block inverted ranges). Only `scoreRange === 0` remains.

### Slice 3 — out-of-range score extrapolates, no throw (behavior change)

- **RED:** `markNumericalRubric with score > maxScore returns the extrapolated
  value` and `score < minScore` likewise — fails today (throws). (After slice 2
  the guards are already gone, so author this test alongside slice 2's removal
  and confirm both behaviors in one removal; kept as a named slice for the
  observable behavior it pins.)
- **GREEN:** covered by slice 2's guard removal; this slice exists to assert the
  extrapolation behavior explicitly.

### Slice 4 — Editor zod: both rules, `src/questions/schemas.ts`

- **RED (score):** `questionDefinitionSchema rejects a numerical rubric with
  minScore === maxScore` — issue at `rubrics.0.maxScore`, message `Max score must
  be greater than min score`. Fails today. (`safeParse` + `issue.path.join(".")`
  as in that file.)
- **GREEN:** add the score-range `superRefine` check.
- **RED (marks):** `rejects a numerical rubric with minMarks > maxMarks` — issue
  at `rubrics.0.maxMarks`, message `Max marks must be greater than or equal to
  min marks`. Fails today.
- **GREEN:** add the marks-ordering `superRefine` check.
- **Then (green):** `rejects minScore > maxScore`; `accepts minScore < maxScore`;
  `accepts minMarks === maxMarks`; `accepts minMarks < maxMarks`.

### Slice 5 — DB CHECK: both rules

- **RED (score):** in `src/db/constraints.integration.test.ts`, a
  `numericalRubric` insert with `maxScore === minScore` is rejected and rolls
  back (mirror the existing R-002 rollback assertions; the file already inserts
  into `numericalRubric` directly). Fails today.
- **GREEN:** new migration adding `numerical_rubric_score_range_check`.
- **RED (marks):** insert with `maxMarks < minMarks` is rejected and rolls back.
  Fails today.
- **GREEN:** add `numerical_rubric_marks_range_check` to the same migration.
- **Then (green):** `maxScore < minScore` rejected; `maxMarks === minMarks`
  accepted.

### Refactor / simplify pass

After all slices green, run `.agents/skills/simplify/SKILL.md` over touched code
only (`rubric.ts`, `schemas.ts`, the migration, the three test files). Preserve
behavior; no broad refactors.

## Verified facts (checked against code 2026-06-22)

- **Inverted/out-of-range are computable, not necessary throws.** Worked example
  above; the existing throws (`rubric.ts:41,46,51`) are validation choices.
- **Zero-width is the only non-finite case.** `scoreRange === 0` ⇒
  `scoreOffset/0` ⇒ `NaN` (offset 0) or `Infinity` (offset ≠ 0). Removing the
  other guards never introduces `NaN`/`Infinity`.
- **Write boundaries make the removed guards redundant in practice:**
  - DB trigger `enforce_numerical_score_bounds` (`20260514000001`) rejects
    out-of-range assessment scores BEFORE INSERT on
    `numerical_rubric_assessment`, on every write path (interactive *and*
    import) — so any persisted score is in `[minScore, maxScore]`.
  - The new editor + DB CHECK reject collapsed/inverted ranges — so any
    persisted rubric has `minScore < maxScore`.
- **Import zod already enforces both rules** (`src/import/schemas.ts:63`, `:60`);
  its other numerical refinements (`:39`–`:50`) exist only for import's optional
  fields and have no editor analog.
- **Editor zod enforces neither cross-field rule** (`src/questions/schemas.ts:31`,
  superRefine `:57` checks only id uniqueness).
- **DB has no range/ordering CHECK** on `numerical_rubric`
  (`20260513000000_init.ts:197-204`).
- **No caller depends on the removed throws.** `markRubric` callers
  (`submissionExport.ts:195`, `assessmentSummary.ts:23`,
  `rubricOverviewBuilder.ts:250`, `RubricGradeRow.tsx:35`) propagate the result;
  none catches or expects a throw. `rubric.test.ts` has no throw assertions
  today.

## Out of scope

- Import schema and interactive assessment-write-path changes (already correct).
- Removing/altering the DB `enforce_numerical_score_bounds` trigger (it is the
  guarantee that lets the marking function drop its out-of-range guards).

## Acceptance (Tier 1 Definition of Done)

- [x] `markNumericalRubric` throws only on `scoreRange === 0`; inverted ranges and
      out-of-range scores return finite values; inverted marks unchanged. Slices
      1–3 + the Step-0 net green.
- [x] `questionDefinitionSchema` rejects `minScore >= maxScore`
      (`rubrics.<i>.maxScore`) and `minMarks > maxMarks` (`rubrics.<i>.maxMarks`);
      flat-marks and valid cases accepted. Slice 4 green.
- [x] New migration adds both CHECK constraints with a working `down()`; slice 5
      integration tests green; migration applies cleanly.
- [x] `CONTEXT.md` gains the `Numerical Rubric Bounds` entry (decision 7).
- [x] Regression check (TDD discipline): temporarily revert each GREEN change and
      confirm its RED test fails, then restore.
- [x] `pnpm run check --fix`, `pnpm run check-types`, `pnpm test:unit rubric schemas`,
      `pnpm test src/db/` all green.
- [x] R-010 promoted to Verified in
      `plans/completed/2026-05-17-reliability-hardening.md`: rewrite Risk/Next Action
      (now: marking function made a pure computer guarding only zero-width ranges;
      both numerical bounds enforced at editor + DB — the prior "no behavior
      change expected" is false), link test files, refresh Section 3 dashboard
      (Tier 1: 0 open, 7 verified) and milestones (M4/M5), add a Change Log entry.
      PR body includes `Fixes #23`.
- [x] Move this plan to `plans/completed/` on merge.

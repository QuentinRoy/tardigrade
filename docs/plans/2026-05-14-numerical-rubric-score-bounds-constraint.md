# Numerical Rubric Score Bounds — DB Constraint

**Date:** 2026-05-14

## Goal

Add a database-level constraint so that `numerical_rubric_assessment.score` is always `>= min_score` and `<= max_score` from the corresponding `numerical_rubric`.

## Why a trigger (not a CHECK constraint)

A plain `CHECK` constraint cannot reference another table. The bounds live in `numerical_rubric`, but the score lives in `numerical_rubric_assessment`. The same pattern used for type-enforcement in the init migration (PL/pgSQL `BEFORE INSERT OR UPDATE` trigger) is the right approach here.

## Join chain

```
numerical_rubric_assessment.rubric_assessment_id
  → rubric_assessment.rubric_id
  → numerical_rubric.rubric_id  (min_score, max_score)
```

## Plan

1. Create a new migration file:
   `src/db/migrations/20260514000001_enforce_numerical_score_bounds.ts`

2. **`up`**: Add a PL/pgSQL trigger function `enforce_numerical_score_bounds()` and attach it as `trg_numerical_score_bounds` on `BEFORE INSERT OR UPDATE OF score, rubric_assessment_id` on `numerical_rubric_assessment`.

   The function will:
   - Resolve `rubric_id` via `rubric_assessment`
   - Look up `min_score` / `max_score` from `numerical_rubric`
   - `RAISE EXCEPTION` if `NEW.score < min_score OR NEW.score > max_score`

3. **`down`**: Drop the trigger and function.

## No application-layer changes

`saveAssessment` in `src/db/assessments.ts` already validates bounds at the app level. The DB constraint is additive — no existing code needs updating.

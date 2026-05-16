# Rubric Status Marker Save Confirmation Plan

## Goal
Keep the rubric status dot in the unassessed color until the save request succeeds.

## Root Cause
The status marker currently derives color from optimistic rubric state. On assess, optimistic state updates immediately before persistence completes, so the dot turns green too early.

## Proposed Changes
1. Extend assessment session output to expose both `savedRubrics` and `optimisticRubrics`.
2. Update rubric list rendering to pass saved status alongside optimistic rubric data.
3. Update `RubricGradeRow` status computation:
   - Use optimistic assessment for control values and marks display.
   - Use saved assessment status for marker color while `isPending` is true.
   - Use optimistic status when not pending.
4. Keep existing save animation behavior.

## Expected Behavior
- From unassessed -> assessed:
  - While save is pending: marker remains unassessed color and pulses.
  - After save success: marker turns assessed color.
- If save fails:
  - Marker remains unassessed color.
- For assessed rubrics being modified:
  - Marker stays assessed color while saving.

## Validation
- Manual check in question assessment UI:
  - Trigger an assessment on an unassessed rubric and observe marker color timing.
  - Confirm marker only turns green after successful save.
- Run formatting and type checks:
  - `pnpm run check --fix`
  - `pnpm run check-types`

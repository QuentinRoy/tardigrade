# Refactoring Audit: Type Safety & DRY Improvements

## Summary
Your refactor attempted to improve typing and reduce duplication by:
1. Moving marking logic to a centralized `markRubric()` function
2. Removing individual `markBooleanRubric`, `markOrdinalRubric`, `markNumericalRubric` imports from export module
3. Improving generic type handling in assessment attachment

However, several type mismatches broke compilation. Below are the 4 main issues with suggested fixes.

---

## Issue 1: Architectural mismatch—export module doesn't use `AssessedRubric`

**Location:** `src/export/submissionExportCsv.ts:176`

**Problem:**
```typescript
const rubricMarks = value != null ? markRubric(rubric) : undefined;
```

The export module has a **fundamentally different data model** from assessment modules:

- **Assessment modules** (SubmissionOverviewAssessmentClient, etc.):
  - Combine rubric + assessment into `AssessedRubric<TType>` 
  - Use `markRubric()` which expects `AssessedRubric<TType>`
  - Pattern: `{ ...rubric, assessment: ... }`

- **Export module**:
  - Keeps rubric metadata (`ExportRubricPlan`) and assessment data separate
  - Fetches values from a `Map<key, AssessmentRubricValue>`
  - Never creates `AssessedRubric` objects
  - Needs to mark independently: `markRubric(rubric, value)` style

Trying to use `markRubric()` in export breaks this contract because:
- `markRubric()` expects `{ rubric, assessment }` combined
- Export only has `rubric` (metadata) and retrieves `value` separately
- The two are never merged

### Fix Options

**Option A: Create export-specific marking that reuses individual mark functions** ✅ *Best fit*
```typescript
import {
  markBooleanRubric,
  markOrdinalRubric,
  markNumericalRubric,
} from "../rubrics/rubric";

function getExportRubricMarks(
  rubric: ExportRubricPlan,
  value: AssessmentRubricValue,
): number {
  if (value.type !== rubric.type) {
    throw new Error(
      `Type mismatch: rubric ${rubric.id} is ${rubric.type}, got ${value.type}`,
    );
  }
  switch (rubric.type) {
    case "boolean":
      return markBooleanRubric(rubric as any, value.passed);
    case "ordinal":
      return markOrdinalRubric(rubric as any, value.selectedLabel);
    case "numerical":
      return markNumericalRubric(rubric as any, value.score);
  }
}

// Then:
const rubricMarks = value != null ? getExportRubricMarks(rubric, value) : undefined;
```
- Reuses mark logic from rubric.ts (DRY achieved partially)
- Keeps export module's separate data model intact
- Type-safe with minimal casting
- Clear that export has its own pattern

**Option B: Refactor to use `markRubric()` throughout** ⚠️ *Larger refactor*
```typescript
// Attach assessments when building export plan:
const assessedRubrics = rubrics.map(r => 
  attachAssessment(r, valuesByKey.get(buildAssessmentKey(q.id, r.id)))
);

// Then can use markRubric():
const marks = assessedRubric.assessment != null 
  ? markRubric(assessedRubric) 
  : undefined;
```
- Unifies the data model across export and assessment
- Requires restructuring how export builds its question/rubric plans
- More invasive but cleaner long-term
- **Selected direction:** Choose this, but only behind a short refactor plan to reduce risk.

**Option C: Export `markRubric()` overload for separate rubric/value** ✅ *Universal DRY*
```typescript
// In rubric.ts, add overload:
export function markRubric(rubric: Rubric, value: AssessmentRubricValue): number;
export function markRubric(assessed: AssessedRubric): number;

export function markRubric(rubricOrAssessed: any, value?: any): number {
  if (value != null) {
    // Separate rubric + value pattern
    const { rubric, val } = { rubric: rubricOrAssessed, val: value };
    if (val.type !== rubric.type) {
      throw new Error(`Type mismatch for rubric ${rubric.id}`);
    }
    // ... reuse same logic
  } else {
    // AssessedRubric pattern
    const assessed = rubricOrAssessed;
    if (assessed.assessment == null) return 0;
    // ... same marking logic
  }
}

// Export can then call:
const rubricMarks = value != null ? markRubric(rubric, value) : undefined;
```
- True DRY: one mark function handles both patterns
- Requires careful implementation to avoid duplication
- Export and assessment modules can both use it
- More flexible but slightly more complex

---

## Issue 2: Missing `falseMarks` in `ExportBooleanRubricPlan`

**Location:** `src/export/submissionExportCsv.ts:24`

**Problem:**
```typescript
type ExportBooleanRubricPlan = ExportRubricLabel &
  Pick<RubricOfType<"boolean">, "id" | "type" | "marks">;
  // Missing: "falseMarks" is optional in Rubric, but required implicitly elsewhere
```

`falseMarks` is optional in `Rubric`, but if it's needed for `markBooleanRubric()`, it should be explicit.

**Missing context to verify before implementation:**
- If import already defaults and persists `falseMarks` for all boolean rubrics, export may treat it as effectively required at runtime.
- If import does not guarantee that invariant yet, Option B is safer as an immediate guard.

### Fix Options

**Option A: Add optional falseMarks to export type** ✅ *For export narrowing*
```typescript
type ExportBooleanRubricPlan = ExportRubricLabel &
  Pick<RubricOfType<"boolean">, "id" | "type" | "marks" | "falseMarks">;
```
- Includes the optional field explicitly
- Makes contract clearer

**Option B: Ensure marked value includes falseMarks default**
```typescript
// In getRubricMarks() or export marking:
const falseMarks = rubric.falseMarks ?? 0;
return markBooleanRubric(rubric as any, value.passed);
```
- Handle optional field inline
- Keep export type lean
- **Selected direction:** Choose this to keep export plan types minimal and handle defaults at the call site.

---

## Issue 3: Missing `reversed` field in `ExportNumericalRubricPlan`

**Location:** `src/export/submissionExportCsv.ts:30–37` and test data

**Problem:**
```typescript
type ExportNumericalRubricPlan = ExportRubricLabel &
  Pick<RubricOfType<"numerical">, "id" | "type" | "minScore" | "maxScore" | "minMarks" | "maxMarks" | "reversed">;
```

The Pick includes `reversed`, but `reversed` is optional (`?: boolean`) in Rubric. TypeScript makes it required in the Pick, so test data must include it.

**Missing context to verify before implementation:**
- If import already defaults and persists `reversed` for all numerical rubrics, tests and export should model it as always present.
- If that invariant is not yet guaranteed everywhere, Option B keeps behavior explicit in fixtures while avoiding production type assumptions.

**Test file expects:**
```typescript
{ id: "r3", type: "numerical", minScore: 0, maxScore: 10, minMarks: 0, maxMarks: 5 }
// Error: reversed is missing
```

### Fix Options

**Option A: Make reversed optional in export type** ✅ *Cleanest*
```typescript
type ExportNumericalRubricPlan = ExportRubricLabel &
  Pick<RubricOfType<"numerical">, "id" | "type" | "minScore" | "maxScore" | "minMarks" | "maxMarks"> & 
  { reversed?: boolean };
```
- Explicitly optional
- Clear intent

**Option B: Add reversed to all test data**
```typescript
{
  id: "r3",
  type: "numerical",
  minScore: 0,
  maxScore: 10,
  minMarks: 0,
  maxMarks: 5,
  reversed: false,  // Add this
}
```
- No type changes
- But verbose for test setup
- **Selected direction:** Choose this to keep production types unchanged and make test fixtures explicit.

**Option C: Use Partial spread helper**
```typescript
type ExportNumericalRubricPlan = ExportRubricLabel &
  Omit<RubricOfType<"numerical">, "description" | "label"> &
  Partial<Pick<RubricOfType<"numerical">, "reversed">>;
```
- More complex but reusable pattern

---

## Issue 4: Generic type narrowing in `attachAssessment()` (rubric.ts)

**Location:** `src/rubrics/rubric.ts:100–110`

**Problem:**
```typescript
export function attachAssessment<TType extends RubricType>(
  rubric: RubricForType<TType>,
  source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<TType> {
  switch (rubric.type) {
    case "boolean":
      return attachBooleanAssessment(rubric, source);  // ❌ TS can't prove rubric is "boolean"
    case "ordinal":
      return attachOrdinalAssessment(rubric, source);   // ❌ TS can't prove rubric is "ordinal"
    case "numerical":
      return attachNumericalAssessment(rubric, source); // ❌ TS can't prove rubric is "numerical"
  }
}
```

The switch narrows `rubric.type` to a literal, but `RubricForType<TType>` is still the entire union from the generic `TType`.

Also, `findAssessment()` signature expects `| null` but receives `| undefined`.

### Fix Options

**Option A: Use exhaustive switch with type assertions** ✅ *Minimal change*
```typescript
export function attachAssessment<TType extends RubricType>(
  rubric: RubricForType<TType>,
  source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<TType> {
  const assessment = findAssessment(rubric.id, source ?? null);
  switch (rubric.type) {
    case "boolean":
      return {
        ...rubric,
        assessment: assessment?.type === "boolean" 
          ? { passed: assessment.passed } 
          : null,
      } as AssessedRubric<TType>;
    case "ordinal":
      return {
        ...rubric,
        assessment: assessment?.type === "ordinal"
          ? { selectedLabel: assessment.selectedLabel }
          : null,
      } as AssessedRubric<TType>;
    case "numerical":
      return {
        ...rubric,
        assessment: assessment?.type === "numerical"
          ? { score: assessment.score }
          : null,
      } as AssessedRubric<TType>;
    default:
      assertNever(rubric);
  }
}
```
- Inline the attachment logic
- Use `as` cast at return only
- Fixes `undefined` → `null` conversion

**Option B: Create overloaded helper signatures**
```typescript
function attachAssessment<T extends "boolean">(
  rubric: RubricForType<"boolean">,
  source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<"boolean">;
function attachAssessment<T extends "ordinal">(
  rubric: RubricForType<"ordinal">,
  source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<"ordinal">;
function attachAssessment<T extends "numerical">(
  rubric: RubricForType<"numerical">,
  source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<"numerical">;
// Implementation
function attachAssessment<TType extends RubricType>(
  rubric: RubricForType<TType>,
  source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<TType> {
  // Inline logic without helper calls
  ...
}
```
- More boilerplate but fully type-safe
- TS doesn't use the helpers; it uses overloads for inference

**Option C: Refactor to discriminated handler map**
```typescript
const assessmentHandlers: Record<RubricType, (r: any, s: any) => any> = {
  boolean: (r, s) => ({ ...r, assessment: ... }),
  ordinal: (r, s) => ({ ...r, assessment: ... }),
  numerical: (r, s) => ({ ...r, assessment: ... }),
};

export function attachAssessment<TType extends RubricType>(
  rubric: RubricForType<TType>,
  source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<TType> {
  return assessmentHandlers[rubric.type](rubric, source ?? null);
}
```
- Avoids nested switch
- Requires `any` casts (less ideal)

**Option D: Keep switch + add typed assertion helper (no `any`, no inlining)** ✅ *Best fit for your constraint*
```typescript
function assertRubricType<T extends RubricType>(
  rubric: Rubric,
  expected: T,
): asserts rubric is RubricForType<T> {
  if (rubric.type !== expected) {
    throw new Error(`Expected rubric type ${expected}, got ${rubric.type}`);
  }
}

export function attachAssessment<TType extends RubricType>(
  rubric: RubricForType<TType>,
  source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<TType> {
  switch (rubric.type) {
    case "boolean":
      assertRubricType(rubric, "boolean");
      return attachBooleanAssessment(rubric, source) as AssessedRubric<TType>;
    case "ordinal":
      assertRubricType(rubric, "ordinal");
      return attachOrdinalAssessment(rubric, source) as AssessedRubric<TType>;
    case "numerical":
      assertRubricType(rubric, "numerical");
      return attachNumericalAssessment(rubric, source) as AssessedRubric<TType>;
    default:
      return assertNever(rubric);
  }
}
```
- Preserves the switch structure
- Avoids `any`
- Keeps helper functions (`attachBooleanAssessment`, etc.) without inlining branch logic
- Narrows in each branch via assertion function

**Option E: Just fix `findAssessment()` signature** ✅ *Smallest fix*
```typescript
function findAssessment(
  rubricId: string,
  source: AssessmentRubricValue | AssessmentRubricValue[] | null | undefined,
): AssessmentRubricValue | null {
  if (source == null) {
    return null;
  }
  // ...
}
```
- Only changes the function signature
- Keeps call sites unchanged
- Does not solve generic switch narrowing

---

## Recommended Fix Strategy

Given that **export and assessment modules have fundamentally different data models**:

1. **Priority 1 (approved choices):**
  - Use **Issue 1 Option B**, but execute it as a staged refactor plan:
    - Stage 1: Introduce a normalized export-side assessed shape (adapter only, no behavior change).
    - Stage 2: Switch export marking call sites to `markRubric()` through the adapter.
    - Stage 3: Remove legacy export-specific marking paths once snapshots/tests pass.
    - Stage 4: Cleanup types and dead helpers.
  - Use **Issue 2 Option B** (default `falseMarks` at mark-time).
  - Use **Issue 3 Option B** (add `reversed` in fixtures/tests).
  - Use **Issue 4 Option D** (typed assertion helper in switch; no `any`, no inlining).

2. **Validation gates per stage:**
  - After each stage, run type-check and tests before moving to the next stage.

3. **Run validation:**
   ```bash
   pnpm run check-types
   pnpm run check --fix
   ```

### Notes on Architectural Choices

- **Option A (status quo):** Export keeps its own logic, assessment modules use `AssessedRubric`. Separate concerns, slightly more code.
- **Option C (unified):** Both use one `markRubric()` function. More unified, but requires export to think about combined data model.

This selection now favors unification via a controlled migration plan (Issue 1B), while keeping type safety constraints explicit for `attachAssessment()`.

### Invariant Checkpoint (Added)

Before implementation, confirm these data invariants in import/save paths:
- Boolean rubrics persist `falseMarks` after import normalization.
- Numerical rubrics persist `reversed` after import normalization.

If both invariants are guaranteed, you can later tighten export types to require those fields without changing runtime behavior.

### Principle (Added)

Keep defaults in one place when possible:

```text
User Input (optional fields) -> Import normalization (apply defaults) -> Database (stable shape) -> Export/consumers
```

Current selected path (Issue 2B / 3B) is still valid as a low-risk immediate move; this principle is the follow-up hardening direction once invariants are confirmed.

---

## Summary Table

| Issue | File | Current | Recommended Fix | Complexity |
|-------|------|---------|-----------------|------------|
| 1. Architectural mismatch in export marking | submissionExportCsv.ts:176 | Separate export model vs `markRubric()` API | **Option B** with staged migration plan | Medium |
| 2. Missing `falseMarks` handling | submissionExportCsv.ts:24 | Optional field not normalized at use site | **Option B** default at mark-time | Low |
| 3. Missing `reversed` in fixtures | submissionExportCsv.ts:30 | Fixtures omit optional production field | **Option B** add explicit fixture value | Low |
| 4. Type narrowing in attach | rubric.ts:100 | Generic switch without branch narrowing | **Option D** assertion-based narrowing in switch | Medium |

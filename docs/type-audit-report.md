# Type System Audit (Overlap + Derivation Opportunities)

Date: 2026-05-13
Scope: `app/**`, `src/**` (focus on domain types, import/export boundaries, DB mapping, and UI-facing contracts)

## Executive Summary

The repository already has a solid foundation with:

- generated DB types from Kysely codegen (`src/db/generated/db.ts`)
- domain-level discriminated unions (`src/db/types.ts`)
- runtime validation with Zod for import payloads (`src/import/schemas.ts`)

The main type-safety gap is not missing types, but overlap and parallel shape definitions that can drift:

1. Similar discriminated unions are re-specified in several files (rubrics and rubric assessments).
2. Export/import boundary types duplicate existing domain types with small structural differences.
3. Several query row/result shapes are handwritten inline rather than derived from existing types or query outputs.
4. Some broad types (`Record<string, string>`) weaken guarantees where stronger inferred types are possible.

## Findings

## 1) Rubric/Assessment discriminant logic is duplicated across many modules

### Where

- `src/db/types.ts`
- `src/assessment/assessment.ts`
- `src/db/assessments.ts`
- `src/db/questions.ts`
- `src/db/submissionExport.ts`
- `src/export/submissionExportCsv.ts`
- `src/import/saveAssessments.ts`

### Overlap Pattern

The same `type` discriminant branches (`"boolean" | "ordinal" | "numerical"`) and field mapping are repeated with local reconstruction of objects.

### Risk

- behavioral drift when one branch changes and others are not updated
- impossible states accepted at compile-time in one path but rejected in another
- more `as const`/manual narrowing than needed

### Better Leverage

Define and reuse shared derivations in one place, for example:

- `RubricOf<T extends RubricType> = Extract<Rubric, { type: T }>`
- `AssessmentOf<T extends RubricType> = Extract<AssessmentRubricValue, { type: T }>`
- `AssessmentInputOf<T> = Omit<AssessmentOf<T>, "rubricId">`

Then use these aliases everywhere branching logic is implemented.

### Options

- Option A (low effort): add shared aliases only, no runtime logic change.
- Option B (medium): also extract reusable constructors/parsers for rubric-assessment values.
- Option C (high): centralize rubric-type dispatch through a typed visitor/helper to eliminate repeated `if (type === ...)` trees.

## 2) `ExportRubricPlan` and `ExportQuestionPlan` overlap strongly with domain `Rubric`/`Question`

### Where

- `src/export/submissionExportCsv.ts`
- `src/db/submissionExport.ts`
- `src/db/types.ts`

### Overlap Pattern

`ExportRubricPlan` mirrors `Rubric` variants with a small transformation (`ordinal` uses `marksByLabel` instead of `marks`).

### Risk

When domain rubric fields evolve, export plans can lag behind silently.

### Better Leverage

Use derivation from domain types first, then add only export-specific deltas. Example strategy:

- `BaseExportRubric = Pick<Rubric, "id" | "type"> & { label: string }`
- `ExportRubricPlan` variants derived from `Extract<Rubric, { type: ... }>`

For ordinal, use explicit mapped transform type instead of redefining all fields.

### Options

- Option A: derive only `id`/`type`/shared fields from `Rubric`.
- Option B: derive full per-variant plan types from `Extract<Rubric, ...>` and remap ordinal marks type.
- Option C: return domain `Rubric` from DB loader and perform an isolated projection function near CSV serialization.

## 3) Submission identity types are duplicated and could be derived

### Where

- `src/db/types.ts` (`Submission`)
- `src/export/submissionExportCsv.ts` (`SubmissionIdentity`)
- `src/db/submissionExport.ts` (stream local fields)

### Overlap Pattern

`SubmissionIdentity` repeats a subset of `SubmissionType`-based union semantics while adding nullable DB join fields.

### Risk

Invariants can diverge (team/student requirements, display id logic).

### Better Leverage

Derive `SubmissionIdentity` from `Submission` plus export-specific nullable fields:

- `type SubmissionIdentity = Pick<Submission, "id" | "type"> & { teamName?: string | null; studentId?: string | null }`

And move invariant checks to a shared type-guard/assert helper used by both export modules.

### Options

- Option A: shared `assertSubmissionIdentity` helper only.
- Option B: derive type + shared helper.
- Option C: introduce branded validated identity type returned only by the assertion function.

## 4) Import schema output and import domain types partially duplicate each other

### Where

- `src/import/schemas.ts`
- `src/import/types.ts`

### Overlap Pattern

`ImportedRubric`, `ImportedQuestion`, and `ImportedStudent` are mostly derived correctly from Zod outputs, but `ImportedSubmission` is handwritten and conceptually overlaps submission domain modeling.

### Risk

Import shapes and downstream expectations can drift if one side changes.

### Better Leverage

- Keep schema as source of truth where possible.
- Introduce explicit mapping layer types:
  - `Imported*` (raw validated external shape)
  - `Normalized*` (internal domain-ready shape)

If `ImportedSubmission` is not directly parsed from input, rename it to `NormalizedSubmissionImport` to make lifecycle explicit.

### Options

- Option A: naming clarification + comments.
- Option B: add dedicated normalized types and mapper functions.
- Option C: expand schema coverage so more types are inferred end-to-end.

## 5) `ImportedAssessmentRow = Record<string, string>` is too broad

### Where

- `src/import/types.ts`
- `src/import/parseAssessments.ts`
- `src/import/saveAssessments.ts`

### Overlap Pattern

Assessment CSV rows are unbounded maps, while downstream logic assumes required keys and known conventions.

### Risk

- misspelled/missing columns only fail late at runtime
- no compile-time guidance around required keys (`submission_type`, `submitter`)

### Better Leverage

Use a minimally structured intersection type:

- required known columns + dynamic rubric columns
- e.g. `{ submission_type: string; submitter: string; grand_total_marks?: string } & Record<string, string>`

Then parse/normalize once and operate on a stronger type.

### Options

- Option A: add a stricter type alias for post-validation rows.
- Option B: add a parser that returns a discriminated result (`ok`/`error`) with typed successful rows.
- Option C: model rubric columns explicitly via template-literal keys (e.g. `${questionId}:${rubricId}`) after header analysis.

## 6) Inline query row types are repeated and partially inferred manually

### Where

- `src/db/questions.ts` (`QuestionRow` and nested shapes)
- `src/db/submissionExport.ts` (streaming row local fields)
- `src/import/saveAssessments.ts` (`rubricsByKey` value shape)

### Overlap Pattern

Intermediate result shapes are manually defined next to query logic, often re-encoding domain relationships.

### Risk

- accidental mismatch between selected columns and local row types
- fragile maintenance when query columns evolve

### Better Leverage

Prefer derivation from query results when practical:

- `type Row = Awaited<ReturnType<typeof fn>>[number]` for helper loaders
- central helper return types for repeated loading patterns

### Options

- Option A: derive local types from helper return values.
- Option B: split complex query+mapping into typed helper modules with exported row/result aliases.
- Option C: use Kysely selection helpers/builders consistently to avoid manual row contracts.

## 7) UI-local `Question` type overlaps with domain naming

### Where

- `src/questions/QuestionList.tsx`
- `src/db/types.ts`

### Overlap Pattern

A UI navigation item is called `Question`, while domain `Question` has rubric payloads.

### Risk

Naming collision causes import ambiguity and cognitive load.

### Better Leverage

Rename UI type to purpose-specific alias (`QuestionListItem` or `QuestionNavItem`) and derive from props where possible.

### Options

- Option A: rename local type only.
- Option B: export reusable UI DTO from a dedicated view-model module.

## 8) Potential inconsistency in `Submission` union fields

### Where

- `src/db/types.ts`

### Overlap Pattern

`Submission` union includes:

- individual variant with `studentName`
- team variant with `teamName`
- team variant currently carries `studentId?: undefined` (which is unusual for this shape)

### Risk

This appears to be either a typo or dead field and may confuse consumers.

### Better Leverage

Cleanly separate display-oriented submission domain type from DB identity fields, or ensure variant-only optional fields are intentional and symmetric.

### Options

- Option A: remove unintended optional field.
- Option B: model two explicit types (`SubmissionIdentity`, `SubmissionDisplay`) and compose.

## Prioritized Refactor Plan

1. Create `src/types/rubric.ts` (or similar) with shared discriminant derivations:
   - `RubricOf<T>`
   - `AssessmentOf<T>`
   - helper mapped types for inputs/outputs
2. Refactor export plan types in `src/export/submissionExportCsv.ts` to derive from `Rubric` via `Extract` and `Pick`.
3. Tighten assessment import row typing after header validation in `src/import/saveAssessments.ts`.
4. Reduce manual row typing by deriving from helper return signatures in `src/db/questions.ts` and `src/db/submissionExport.ts`.
5. Rename UI-local `Question` in `src/questions/QuestionList.tsx`.
6. Confirm and clean `Submission` union field consistency in `src/db/types.ts`.

## Suggested Type Utilities (Reusable)

```ts
export type RubricOf<T extends RubricType> = Extract<Rubric, { type: T }>;
export type AssessmentOf<T extends RubricType> = Extract<
  AssessmentRubricValue,
  { type: T }
>;
export type AssessmentPayloadOf<T extends RubricType> = Omit<
  AssessmentOf<T>,
  "rubricId" | "type"
>;

export type WithRequired<T, K extends keyof T> = T & {
  [P in K]-?: Exclude<T[P], undefined | null>;
};
```

## Rationale Summary

Deriving types from a single source of truth reduces drift, improves discriminant narrowing reliability, and makes schema/domain/export boundaries explicit. In this codebase, the biggest gains will come from consolidating rubric-related variant logic and tightening CSV/import boundary contracts rather than introducing more new standalone types.

## Implementation Strategy Matrix

- Conservative (lowest risk): alias extraction + naming cleanup + stricter import row type after runtime validation.
- Balanced (recommended): conservative steps + refactor export plan to derived types + shared submission assertion helper.
- Aggressive (highest payoff): balanced steps + central typed rubric dispatch abstraction + broader query-row type derivation via helper layers.

# Type System Audit (Overlap + Derivation Opportunities)

Date: 2026-05-13
Scope: `app/**`, `src/**` (focus on domain types, import/export boundaries, DB mapping, and UI-facing contracts)
Related execution plan: `docs/type-system-migration-plan.md`

## Executive Summary

This audit has now been partially implemented through the migration plan (Phases 1–5 completed). The highest-priority boundary issues identified in the original report were addressed.

### What is now resolved

1. Export rubric planning is now derived from domain `Rubric` variants (`Extract` + `Pick`) instead of being fully handwritten.
2. Submission export identity is now domain-aligned using `SubmissionSubmitter` (including centralized narrowing/validation via `toSubmissionSubmitter(...)`).
3. Assessment CSV row parsing now uses Zod on the server, and importer normalization/parsing logic is extracted into focused helpers.
4. UI-local `Question` naming collision has been removed (`QuestionListItem`).
5. `Submission` team-branch inconsistency in `src/db/types.ts` was fixed and submission concerns were split into `Submission` (display/UI) and `SubmissionSubmitter` (ownership/export identity).

### What remains open

- Whether to keep `ExportRubricPlan` as a dedicated export DTO long-term or move closer to direct domain `Rubric` usage at serialization boundaries.
- Whether to add further shared helper aliases in Phase 6+ (only if clearly justified by reuse).

## Findings (Updated Status)

## 1) Export rubric duplication against domain `Rubric`

### Previous status

Export rubric variants were duplicated and manually maintained.

### Current status

**Resolved (for current scope).**

- `ExportRubricPlan` now derives fields from `Rubric` variants in `src/export/submissionExportCsv.ts`.
- Ordinal export planning now uses canonical `marks` (no `marksByLabel` fork).

### Residual note

A strategic design choice remains: keep `ExportRubricPlan` as a dedicated export type vs reducing it further toward direct domain usage.

---

## 2) Submission export identity duplication

### Previous status

`SubmissionIdentity` was a weaker standalone shape.

### Current status

**Resolved (for current scope).**

- Export helpers now consume `SubmissionSubmitter` directly.
- Streamed export rows are narrowed and validated once via `toSubmissionSubmitter(...)`.
- Invariant checks are centralized in one place before CSV row generation.

---

## 3) Broad assessment import row typing (`Record<string, string>`)

### Previous status

Importer relied on broad row typing with runtime assumptions.

### Current status

**Resolved (for current scope).**

- Added Zod-backed `assessmentRowSchema` / `assessmentRowsSchema`.
- `parseAssessmentsCsv(...)` now parses through Zod on the server.
- Import save path keeps DB-aware recognized-column validation and uses extracted normalization helpers:
  - `resolveSubmissionId(...)`
  - `parseAssessmentValue(...)`

---

## 4) UI-local `Question` naming collision

### Previous status

`src/questions/QuestionList.tsx` used a local type named `Question`.

### Current status

**Resolved.**

- Renamed to `QuestionListItem`.

---

## 5) `Submission` union field inconsistency

### Previous status

Team branch used `studentId?: undefined`, inconsistent with individual `studentName` branch semantics.

### Current status

**Resolved.**

- Corrected branch exclusion semantics.
- Introduced clearer split:
  - `Submission` for display/UI concerns
  - `SubmissionSubmitter` for ownership/export concerns

---

## 6) Manual query/result shaping in DB paths

### Previous status

Some DB/result paths used ad hoc manual row shapes and large branch blocks.

### Current status

**Improved, partially open.**

- `src/db/submissions.ts` now avoids manual cast-heavy row shaping and relies more on inferred query result typing.
- `src/db/assessments.ts` now uses focused per-variant helpers to improve readability and reduce branch sprawl.

Residual opportunity remains for broader helper extraction where real reuse appears.

---

## 7) Discriminant-handling consistency

### Previous status

Mixed branching style and duplicated conditional logic.

### Current status

**Improved.**

- High-value paths now use readable `switch` + `assertNever` patterns.
- No visitor framework introduced.

## Updated Prioritized Remaining Work

1. Decide long-term boundary strategy for `ExportRubricPlan` (keep dedicated vs move closer to direct domain `Rubric` usage).
2. Complete final consistency sweep (remove stale aliases and low-value overlap if any remain).
3. Add additional regression tests only where refactor risk justifies it (especially import/export edge cases).
4. Revisit shared helper aliases only if Phase 6 reveals concrete repeated patterns.

## Rationale Summary

The major risk-bearing issues identified in this audit were concentrated at import/export boundaries and submission identity modeling. Those are now significantly improved: domain types are clearer, export/import boundaries are stricter, and parsing/normalization responsibilities are better separated. Remaining work is mostly strategic cleanup and optional consolidation rather than foundational type-safety correction.

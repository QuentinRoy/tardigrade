# Type System Migration Plan

Date: 2026-05-13
Status: Active working plan
Related: `docs/type-audit-report.md`

## Status snapshot

| Field | Current value |
| --- | --- |
| Current phase | Phase 2 — DB and domain alignment |
| Overall status | Phase 1 completed |
| Current blocker | None |
| Open uncertainties | SubmissionSubmitter field/details during implementation |
| Last confirmed decisions | Domain-first architecture; submission concerns split; `SubmissionSubmitter` adopted in export path; domain `marks` canonical; `switch` + `assertNever`; strict import; helper extraction deferred to Phase 3/4 |
| Last updated | 2026-05-13 16:30 |




## Purpose


This document turns the current type audit into an execution plan.

It is intentionally written as a living migration plan that should be updated as work progresses. The goal is not only to fix isolated typing issues, but to reshape the code so that domain types are the source of truth and import/export boundaries derive from them in a readable, safe, maintainable way.

## Current decisions and constraints

These decisions are already agreed and should be treated as default guidance unless new investigation results prove they need revision.

### Canonical source-of-truth decisions

- `src/db/types.ts` is the canonical domain type layer.
- `Rubric` is the canonical source of truth for rubric variants.
- `AssessmentRubricValue` is the canonical source of truth for rubric assessment variants.
- `db/generated/*` is generated DB-facing material and should stay scoped to DB-related code.

### Refactor scope decisions

- The repo is self-contained and experimental.
- Cross-cutting renames and signature changes are acceptable.
- Large internal refactors are acceptable if they improve architecture.
- Behavior fixes are allowed when a real inconsistency is found, but they must be validated when encountered.
- DB schema changes are allowed if they improve alignment with the domain model, provided read/write safety is validated.

### Type design decisions

- Prefer readable `switch (value.type)` branching with `assertNever` exhaustiveness checking.
- Helper functions are welcome.
- Do not introduce visitor-pattern abstractions unless a concrete use case justifies them.
- Use derived/shared utility types when they clearly improve reuse.
- Avoid unnecessary type-level cleverness that hurts readability.
- Keep types close to usage unless shared reuse clearly justifies extraction.

### Import and data safety decisions

- Import should be strict, not permissive.
- Unknown columns should be rejected.
- Import work should move toward validated row types plus normalization helpers.
- Data integrity is the top priority, especially around DB persistence.
- Validation expectations include diagnostics, tests, and focused regression checks.

### Confirmed audit clarification

- In `Submission`, the team branch field `studentId?: undefined` is a typo.
- The intended exclusion there is the other branch's `studentName` field.
- Submission modeling still requires investigation before deciding whether one type or multiple purposeful types is the best long-term architecture.

## Audit summary translated into migration priorities

The current audit findings suggest these priorities:

1. Investigate and stabilize the domain model around `Submission` before broad propagation.
2. Refactor export planning to derive from domain rubric types instead of redefining them.
3. Refactor import assessment rows into validated and normalized stages.
4. Standardize readable discriminant handling and exhaustiveness checks.
5. Remove misleading local type names and residual duplicated boundary shapes.

## Migration strategy

This is an architecture-first migration.

That means we do not start by patching every boundary type in place. We first investigate unresolved domain questions, then stabilize domain architecture, then align import/export boundaries, then clean up residual drift.

## Uncertainty handling rule

New uncertainty discovered during execution should not be silently papered over with assumptions.

If implementation work reveals unclear semantics, conflicting usage patterns, or a domain/DB mismatch that was not previously identified, that uncertainty must be explicitly recorded in this document and discussed before proceeding with broad structural changes.

### Practical rule

- If uncertainty affects naming only and the intended meaning is still obvious, it can usually be resolved locally.
- If uncertainty affects domain modeling, persistence behavior, import/export contracts, or data integrity, stop and discuss before continuing.
- If uncertainty changes the assumptions of a current phase, update the decision log and checklist before further work.


## Phase overview

- Phase 0: Investigation and decisions
- Phase 1: Domain model stabilization
- Phase 2: DB/domain alignment
- Phase 3: Export boundary refactor
- Phase 4: Import boundary refactor
- Phase 5: Naming and local type cleanup
- Phase 6: Consistency pass and documentation refresh

---

## Phase 0 — Investigation and decision record

### Goal

Resolve open domain questions before changing core architecture.

### Checklist

#### 0.1 Submission model investigation

- [x] Find every usage of `Submission`.
- [x] Find every usage of `SubmissionType`.
- [x] Find every usage of `studentName`, `studentId`, and `teamName` in submission-related flows.
- [x] Identify whether current `Submission` is acting as domain type, display type, export type, DB projection, or a mix.
- [x] Determine whether canonical submission identity is owner-oriented, display-oriented, or needs to be split.
- [x] Decide whether to keep one main `Submission` type or split into purposeful domain-facing types.


**Findings so far**

- `Submission` from `src/db/types.ts` is consumed mainly by UI and assessment-session flows, not by DB write logic.
- `loadSubmissions()` in `src/db/submissions.ts` builds `Submission` as a display-oriented object with `displayLabel`, `memberNames`, and `searchKeys`.
- For individuals, the current domain shape carries `studentName`, which is presentation-oriented rather than a stable owner identifier.
- Export code does not use `Submission`; it uses a weaker `SubmissionIdentity` built from DB join output and keyed by `studentId`/`teamName`.
- DB persistence uses `submission.studentId` / `submission.teamId`, which are ownership fields not represented directly in the current domain `Submission` type.

**Current assessment**

`Submission` is currently a mixed display/domain projection rather than a pure canonical submission identity type. There is strong evidence that submission concerns should likely be split into purposeful types instead of continuing to overload one shape.


#### 0.2 Ordinal rubric representation investigation

- [x] Find every usage of `marksByLabel`.
- [x] Determine whether `marksByLabel` is only export-specific or has broader architectural value.
- [x] Compare export needs against domain `marks: Record<string, number>`.
- [ ] Decide whether ordinal export planning should adapt at the final edge or keep a distinct internal export shape.

**Findings so far**

- `marksByLabel` appears in the export plan type, the export DB loader, and export tests.
- No evidence has been found that `marksByLabel` has domain value outside export-specific row generation.
- The domain rubric type already models ordinal data as `marks: Record<string, number>`, which is semantically equivalent for current export needs.
- Current usage suggests `marksByLabel` is a local export convenience name rather than a distinct concept.

**Current assessment**

The current evidence suggests `marksByLabel` should probably not remain a separate architectural concept. The likely direction is to use domain `marks` consistently and adapt only where the CSV edge truly requires it.


#### 0.3 Import pipeline investigation

- [x] Trace assessment import from parse to validation to normalization to save.
- [x] Identify where broad CSV rows can become validated rows.
- [x] Identify where normalization helpers should exist.
- [x] Determine whether `ImportedSubmission` and related names still match actual lifecycle semantics.

**Findings so far**

- Assessment import currently flows as `parseAssessmentsCsv()` -> `saveAssessments()`.
- `parseAssessmentsCsv()` returns `Array<Record<string, string>>` with no dedicated assessment-specific validated type.
- `saveAssessments()` performs header recognition and required-column checks, which is the natural point to transition from broad parsed rows to validated rows.
- `saveAssessments()` also contains normalization and interpretation logic that could be split into helpers after row validation.
- `ImportedSubmission` is used by student import grouping/saving, not by assessment import. The name is tolerable but it represents normalized internal import staging data rather than raw external input.

**Current assessment**

Assessment import should move toward at least two stages: broad parsed rows and validated rows. A further normalized helper layer also looks justified. `ImportedSubmission` naming is not currently blocking, but it may deserve reconsideration when import types are cleaned up.


### Phase 0 deliverables

- [x] Add a short decision summary to this document for submission modeling.
- [x] Add a short decision summary to this document for ordinal rubric representation.
- [x] Add a short decision summary to this document for import staging.

### Phase 0 provisional decision summaries

#### Submission modeling

Provisional direction: split current mixed-purpose submission concerns.

Reasoning:

- current `Submission` is display-oriented in practice
- export needs a different owner-identity-oriented shape
- DB persistence uses ownership fields not represented in the current domain-facing shape

Confirmed decision:

- split submission concerns into purposeful types rather than keeping one overloaded `Submission` shape
- use the `SubmissionSubmitter` naming direction for the ownership/export-oriented submission identity type

Implementation note:

- exact field boundaries can still be refined during Phase 1, but the architectural direction and naming direction are now decided



#### Ordinal rubric representation

Provisional direction: treat domain `marks` as canonical and avoid keeping `marksByLabel` as a broader architectural concept unless later implementation reveals a concrete benefit.

Reasoning:

- `marksByLabel` currently appears export-local only
- domain `marks` already expresses the same semantic information

#### Import staging

Provisional direction: move assessment import toward parsed row -> validated row -> normalization helpers.

Reasoning:

- header validation already exists in `saveAssessments()`
- downstream logic can become less stringly-typed after that validation boundary
- this supports the agreed strict-import direction


### Phase 0 exit criteria

- [x] There is a clear decision on `Submission` architecture direction.
- [x] There is a clear decision on ordinal rubric representation strategy.
- [x] There is a clear decision on import row staging.



---

## Phase 1 — Domain model stabilization

### Goal

Make `src/db/types.ts` a clean and reliable source of truth for domain concepts.

### Candidate focus areas

- `Submission`
- `Rubric`
- `AssessmentRubricValue`
- small reusable domain derivation helpers if justified
- exhaustiveness patterns and `assertNever`

### Checklist

#### 1.1 Submission cleanup

- [x] Correct the asymmetric `Submission` branch typo as part of the chosen architecture.
- [x] If investigation supports it, split mixed-purpose submission concerns into clearer types.
- [x] Keep naming aligned with actual responsibility: domain identity, display, owner, export-ready view, etc.

**Phase 1 progress update**

- `src/db/types.ts` now separates UI/display-oriented `Submission` from ownership/export-oriented `SubmissionSubmitter`.
- The old team-branch typo excluding `studentId` has been replaced with the intended `studentName` exclusion on display-oriented `Submission`.
- `src/export/submissionExportCsv.ts` now adopts `SubmissionSubmitter` as the type behind export submission identity.
- `src/db/submissionExport.ts` now narrows streamed row state through `toSubmissionSubmitter(...)` before row serialization, so export row building receives a validated discriminated submitter shape.



**Phase 1 target shape (provisional, based on current usage)**

- Keep `Submission` as the UI/display-oriented submission type currently consumed by assessment and quick-jump flows.
- Introduce `SubmissionSubmitter` as the ownership/export-oriented submission identity type used by export and persistence-adjacent logic.
- Keep search/navigation fields (`displayLabel`, `memberNames`, `searchKeys`) out of `SubmissionSubmitter`.
- Keep stable ownership fields (`studentId`, later possibly `teamId` if useful) out of the UI/display-oriented `Submission` type unless a concrete UI need appears.


**Reasoning from current code**

- `src/db/submissions.ts` constructs a display/search-oriented shape.
- `src/submissions/getSubmissionLabel.ts` and quick-jump search use display concerns only.
- export logic in `src/export/submissionExportCsv.ts` uses owner identity semantics, not display semantics.
- keeping one type for both concerns would continue to blur domain boundaries.


#### 1.2 Domain derivation helpers

- [x] Evaluate whether `RubricOf<T>` is justified by actual reuse. (Decision: defer extraction to Phase 3/4 when export/import refactors can immediately consume it.)
- [x] Evaluate whether `AssessmentOf<T>` is justified by actual reuse. (Decision: defer extraction to Phase 3/4 when export/import refactors can immediately consume it.)
- [x] Add only the shared aliases that clearly improve multiple modules. (Decision: no new aliases in Phase 1.)
- [x] Keep helpers near the domain layer unless broader reuse proves necessary. (Decision: postponed with same rule.)

#### 1.3 Exhaustiveness strategy

- [x] Add or standardize `assertNever` utility if needed. (`assertNever` already existed in `src/utils/utils.ts` and is now used in updated discriminant branches.)
- [x] Prefer `switch`-based discriminant handling for rubric and assessment variants. (Applied in `src/rubrics/rubric.ts`, `src/assessment/assessment.ts`, and `src/export/submissionExportCsv.ts`.)
- [x] Avoid visitor-style abstractions unless a concrete case justifies them. (No visitor abstraction introduced.)

**Phase 1 exhaustiveness progress update**

- Replaced key discriminant `if` chains with `switch` + `assertNever` in high-value paths.
- Kept type readability high without introducing visitor patterns.
- Avoided `as never` shortcuts in exhaustiveness checks.

### Phase 1 exit criteria

- [x] Domain types read clearly and consistently.
- [x] Core discriminated unions are the obvious source of truth.
- [x] There is no unresolved ambiguity about what `Submission` means.

---

## Phase 2 — DB and domain alignment

### Goal

Ensure DB-facing code and persistence assumptions support the chosen domain model.

### Checklist

#### 2.1 Read/write alignment

- [ ] Review DB loaders and mappers that construct `Submission`, `Rubric`, and related domain values.
- [ ] Identify any mismatch between DB shape and intended domain shape.
- [ ] Decide whether mapping cleanup is enough or whether schema changes are justified.

#### 2.2 Safety validation

- [ ] Validate that save paths still persist the intended data correctly after any domain changes.
- [ ] Validate that load paths still reconstruct the intended domain values correctly.
- [ ] Add or update targeted tests for DB-integrity-sensitive flows.

#### 2.3 Optional DB migration work

- [ ] If a schema mismatch is discovered, document the reason before changing the DB.
- [ ] If a DB change is needed, define migration scope and rollback assumptions.
- [ ] Verify read/write safety before proceeding to broad boundary refactors.

### Phase 2 exit criteria

- [ ] Persistence logic matches the chosen domain architecture.
- [ ] Any DB changes are justified, validated, and documented.

---

## Phase 3 — Export boundary refactor

### Goal

Make export types derive from domain types wherever the concepts are the same.

### Candidate focus areas

- `src/export/submissionExportCsv.ts`
- `src/db/submissionExport.ts`

### Checklist

#### 3.1 Rubric export derivation

- [ ] Refactor `ExportRubricPlan` to derive as much as possible from domain `Rubric`.
- [ ] Revisit whether `marksByLabel` should remain an internal export planning shape.
- [ ] Keep export-specific transformation only where it adds real clarity.

#### 3.2 Submission export identity

- [ ] Replace or narrow `SubmissionIdentity` using domain-derived logic where practical.
- [ ] Add a shared assertion/helper for export-ready submission identity.
- [ ] Centralize submission export invariant checks.

#### 3.3 Export flow readability

- [ ] Simplify row generation around validated domain-aligned inputs.
- [ ] Use readable `switch` + `assertNever` handling for discriminant logic where needed.

### Phase 3 exit criteria

- [ ] Export types no longer duplicate domain variants without a good reason.
- [ ] Export identity rules are expressed once and reused.
- [ ] CSV behavior remains correct and tested.

---

## Phase 4 — Import boundary refactor

### Goal

Turn assessment import into a stricter, clearer, validated pipeline.

### Candidate focus areas

- `src/import/types.ts`
- `src/import/saveAssessments.ts`
- related import parsing/normalization helpers

### Checklist

#### 4.1 Row typing

- [ ] Separate broad parsed row shape from validated row shape.
- [ ] Add validated row types after header checks.
- [ ] Keep the importer strict about required columns and unknown columns.

#### 4.2 Normalization helpers

- [ ] Add helpers for extracting required columns from validated rows.
- [ ] Add helpers for converting row cells into domain-ready assessment inputs.
- [ ] Reduce direct string-key indexing in downstream logic.

#### 4.3 Naming cleanup in import types

- [ ] Reassess names like `ImportedSubmission` if they do not reflect actual lifecycle role.
- [ ] Keep names aligned with raw, validated, or normalized responsibilities.

### Phase 4 exit criteria

- [ ] Import row contracts are meaningfully stronger.
- [ ] Import logic is stricter and clearer.
- [ ] Errors remain understandable and useful.

---

## Phase 5 — Naming and local type cleanup

### Goal

Remove ambiguous local names and low-value overlap.

### Checklist

- [ ] Rename UI-local `Question` in `src/questions/QuestionList.tsx` to a purpose-specific name.
- [ ] Rename any other local DTO types whose names collide with domain concepts.
- [ ] Remove stale type aliases made obsolete by the migration.

### Phase 5 exit criteria

- [ ] Local UI and boundary types no longer create obvious naming confusion.

---

## Phase 6 — Consistency pass and docs refresh

### Goal

Finish the migration by removing residual drift and synchronizing docs.

### Checklist

- [ ] Replace remaining unjustified duplicated discriminant logic where worthwhile.
- [ ] Remove obsolete intermediate types.
- [ ] Update `docs/type-audit-report.md` to reflect what was actually changed.
- [ ] Update this migration plan with completed work and any scope changes.
- [ ] Document any deliberate non-goals or deferred items.

### Phase 6 exit criteria

- [ ] The codebase reflects the intended domain-first architecture.
- [ ] The audit and migration plan are aligned with reality.

---

## Validation checklist

This checklist applies throughout all phases.

### Diagnostics and correctness

- [ ] Run diagnostics after meaningful changes.
- [ ] Fix or consciously document new type errors.
- [ ] Use focused tests when changing import/export/domain behavior.

### DB safety

- [ ] Validate write behavior after domain or persistence changes.
- [ ] Validate read behavior after mapping changes.
- [ ] Treat DB-integrity-sensitive changes as hard checkpoints.

### Behavior and regression checks

- [ ] Keep export header and row behavior verified.
- [ ] Keep import accept/reject behavior verified.
- [ ] Reassess any behavior fix when a type refactor exposes inconsistencies.

## Working notes / decision log

This section should be updated iteratively during execution.

### Open decisions

- SubmissionSubmitter field/details during implementation: pending
- Ordinal export representation strategy implementation details: pending if export code reveals a concrete edge-only shape need
- Import staging naming details: pending
- Exact helper aliases to introduce in Phase 3/4 (if any): pending




### Confirmed decisions

- Domain-first architecture
- `Rubric` and `AssessmentRubricValue` are canonical unions
- Submission concerns should be split into purposeful types rather than kept in one overloaded `Submission` shape
- `SubmissionSubmitter` is the chosen naming direction for the ownership/export-oriented submission identity type
- `src/db/types.ts` now contains separate `Submission` and `SubmissionSubmitter` types as the Phase 1 domain split foundation
- Export flow now validates streamed submission identity via `toSubmissionSubmitter(...)` in `src/db/submissionExport.ts` before calling CSV row builders
- Domain helper alias extraction is deferred to Phase 3/4 to avoid speculative abstractions
- Domain ordinal `marks` should remain canonical unless implementation reveals a concrete export-only reason to keep a separate edge shape
- Assessment import should move toward parsed row -> validated row -> normalization helpers
- Prefer `switch` + `assertNever`
- Avoid `as` when possible; do not use `any`
- No visitor abstraction without a concrete need
- Strict import behavior
- Large refactors and renames are acceptable
- DB changes are allowed if validated safely


### Non-goals unless evidence justifies them

- Introducing a generalized visitor framework for discriminated unions
- Over-abstracting query result typing
- Extracting broad shared type utility modules without clear reuse

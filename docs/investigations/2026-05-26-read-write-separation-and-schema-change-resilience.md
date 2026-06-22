# Investigation: Read-Write Separation and Schema-Change Resilience

Status: Largely implemented; remaining scope tracked as R-008 in `plans/active/2026-05-17-reliability-hardening.md`
Date: 2026-05-18
Last reviewed: 2026-06-22 (R-007 closed by PR #153, assessment completion consolidation; only R-008 remains open)
Owner: Unassigned
Related: #115 (closed), #117 (closed), #51 (closed), `plans/active/2026-05-17-reliability-hardening.md`

## 0. Current Status and Ownership

This investigation's proposed direction was accepted and has been substantially implemented, mainly through ADR 0007 (`docs/adr/0007-db-primitives-take-a-handle-wrappers-own-transactions-and-cache.md`) and a series of completed extraction plans, rather than through a single dedicated design doc under this title.

Implemented:

- **Phase A (stable contracts)**: ADR 0007's `...FromDb`/`...InDb` primitive plus app-level-wrapper pattern is now the standard persistence/read contract, applied across `src/questions/`, `src/assessments/`, `src/submissions/`, `src/import/`, and `src/export/`.
- **Phase B (write-side extraction)**: `plans/completed/2026-05-29-split-questions-db-module.md`, `plans/completed/2026-06-01-split-assessments-db-module.md`, and `plans/completed/2026-06-10-import-parse-prepare-write-seams.md` extracted question/rubric, assessment, and import write paths into focused modules with explicit transaction boundaries.
- **Phase C, export (read projections)**: `plans/completed/2026-06-11-submission-export-internals.md` extracted the pure `src/export/submissionExportGrouping.ts` projection module and added `streamSubmissionExportRowsFromDb` / `assertSubmissionInvariantsFromDb` primitives plus a characterization integration test. R-006 in the reliability tracker is now Verified on this evidence.
- **Source reorganization**: `plans/completed/2026-06-02-source-reorganization.md` moved the original `src/db/questions.ts` and `src/db/assessments.ts` hotspots into `src/questions/` and `src/assessments/` (see §5 for current paths).
- The orchestrating roadmap issue #117, the source-structure umbrella #115, and the identifier-naming issue #51 are all closed.

Remaining (Phase C for overview reads, Phase D hardening):

- progress reads got their dedicated read-projection extraction in `plans/completed/2026-06-11-assessment-completion-consolidation.md`: `src/assessments/submissionProgress.ts` and `src/assessments/assessmentsProgress.ts` were replaced by `src/assessments/loadAssessmentCompletion.ts` (shared primitive plus loaders) and the pure `src/assessments/assessmentCompletion.ts` builder. R-007 is now Verified.
- `src/assessments/rubricOverview.ts` and `src/assessments/rubricOverviewBuilder.ts` have adopted the ADR 0007 primitive/wrapper shape but have not had a dedicated read-projection extraction or test-hardening pass.
- This remaining scope is tracked as **R-008** (rubric overview analytics) in `plans/active/2026-05-17-reliability-hardening.md`, which references this investigation for the proposed projection-module direction.

This document is retained as background and rationale for the accepted direction and for the remaining R-008 work. It no longer represents an undecided proposal.

Document ownership boundaries (historical, still accurate):

- #115 and `docs/investigations/2026-05-25-source-structure-and-tech-debt-audit.md` owned the broader source-structure and technical-debt audit (closed).
- #117 owned the DX sequencing roadmap (closed).
- #51 owned database identifier naming conventions (closed).
- `plans/active/2026-05-17-reliability-hardening.md` owns reliability risks, priority, and test evidence, including the remaining R-008 scope from this investigation.

## 1. Problem Statement

Recent key-migration work required touching many modules across write paths, read/aggregation paths, and export/reporting paths. The current coupling makes schema changes expensive and risky because table-level details leak into many layers.

Primary objective:

- Reduce blast radius of future schema changes by separating write models from read models and introducing stable domain-level boundaries.

Secondary objective:

- Align this refactor with existing reliability and DX work without broadening scope beyond manageable increments.

## 2. Desired Architecture Outcome

Target architecture boundaries:

1. Domain/Application boundary
   - Receives project-scoped business inputs, business IDs, user intent, and validation results.
   - Does not depend on storage key type details such as row IDs versus natural IDs.

2. Write-side command/repository boundary
   - Owns write-side key resolution and persistence details.
   - Exposes stable write operations for question/rubric/assessment workflows.
   - Keeps transaction boundaries explicit.
   - Keeps business ID to storage key translation inside write modules.

3. Read projection boundary
   - Owns query shaping for overview, progress, export, and rubric analytics.
   - Exposes stable read DTOs and aggregation outputs.
   - Avoids leaking table-specific joins to route/page/UI code.

4. Migration and schema adapter boundary
   - Owns schema transitions and backfills.
   - Keeps additive migration strategy and controlled switchover patterns.

This is lightweight read/write separation, not a full CQRS/event-sourcing architecture. Avoid command buses, handler registries, or deep folder hierarchies unless the codebase clearly needs them.

## 3. In Scope and Out of Scope

In scope:

- Introduce clear write-side boundaries for persistence operations.
- Introduce read projection modules for reporting, export, progress, and overview pages.
- Replace direct table-coupled joins in app-level code with domain/read DTO contracts.
- Add guardrail tests to lock behavior while internals evolve.
- Keep changes incremental and behavior-preserving unless a separate issue explicitly changes behavior.

Out of scope:

- UI redesign or interaction changes.
- Broad domain behavior changes not required for boundary extraction.
- Reopening already-completed key migration decisions unless a data-loss risk is identified.
- Deciding final terminology such as Project/Assignment, Assessment/Grading, or Rubric/Criterion.
- Final App Router caching/loading strategy; #59 should own that.

## 4. Overlap and Related Aspects

### 4.1 Overlap With Reliability Tracker

Reference: [`plans/active/2026-05-17-reliability-hardening.md`](../../plans/active/2026-05-17-reliability-hardening.md)

Direct overlap:

- R-003, questions/rubrics mutation safety: boundary extraction reduces write-path complexity and mutation side effects.
- R-005, project isolation: centralized project-scoped repositories reduce cross-project leakage risk.
- R-006, export correctness: read projections isolate stream/shape logic from write schemas.
- R-007, progress metric correctness: Verified — `loadAssessmentCompletion.ts`/`assessmentCompletion.ts` are the projection-only modules this overlap anticipated.
- R-011, question/rubric save semantics: write modules make save behavior explicit and testable.

Related but indirect:

- R-001, assessment import atomicity: already mitigated, but clearer write boundaries make transactional contracts easier to preserve.
- R-002, DB invariant enforcement: better layer separation simplifies invariant-focused integration testing.
- R-013 and R-015, UX/action error contracts: cleaner domain interfaces improve actionable error mapping.

Boundary:

- The reliability tracker owns risk priority, status, and test evidence.
- This investigation owns the proposed code-boundary extraction direction.

### 4.2 Relationship With Completed Key-Migration Work

Historical context:

- #34 replaced mutable text primary keys on question/rubric with surrogate integer keys.
- #46 fixed cross-project reuse of question/rubric ids.

The old unified key-migration plan referenced by earlier versions of this document is historical context, not an active owner.

Current implication:

- Key translation concerns should live in write-side modules, not scattered across import/export/progress code.
- Read modules should consume business IDs and derived DTOs rather than raw FK storage fields where possible.
- #51 should own any remaining database identifier naming decisions.

### 4.3 Overlap With Source-Structure Audit and DX Roadmap

Related:

- #115, source code structure umbrella.
- #117, DX roadmap.
- `docs/investigations/2026-05-25-source-structure-and-tech-debt-audit.md`.
- `docs/investigations/2026-05-25-investigation-overlap-audit.md`.

Boundary:

- #115/source audit owns broad source-structure findings, file-splitting candidates, UI/shared ownership, import/export organization, and follow-up issue candidates.
- #117 owns sequencing across documentation cleanup, route context, read/write separation, and reliability work.
- This investigation owns the narrower proposed direction for separating write operations from read projections.

## 5. Current Coupling Hotspots

Note: paths below reflect the post-reorganization layout (`plans/completed/2026-06-02-source-reorganization.md`); the original `src/db/questions.ts` and `src/db/assessments.ts` no longer exist.

Write-heavy hotspots (extracted, see §0):

- `src/import/saveQuestions.ts`
- `src/questions/questionDefinitionMutations.ts` (formerly `src/db/questions.ts`)
- `src/assessments/assessmentMutations.ts` (formerly part of `src/db/assessments.ts`)
- `src/import/saveAssessments.ts`

Read/projection-heavy hotspots:

- `src/export/submissionExport.ts`, `src/export/submissionExportGrouping.ts` (extracted, see §0)
- `src/assessments/loadAssessmentCompletion.ts` / `assessmentCompletion.ts` (formerly `src/db/submissionProgress.ts` / `src/db/assessmentsProgress.ts`) — extracted, R-007 Verified
- `src/assessments/rubricOverview.ts` / `rubricOverviewBuilder.ts` (formerly `src/db/rubricOverview.ts`) — remaining, R-008

Cross-cutting schema boundary:

- `src/db/generated/db.ts`

These overlap with the source-structure audit. The difference is that this investigation specifically prioritizes separating writes from read/projection code so future schema changes affect fewer modules.

## 6. Incremental Execution Direction

This section is a candidate execution direction, not an active implementation plan.

### Phase A: Define Stable Contracts

Deliverables:

- Write operation interfaces for question/rubric/assessment persistence.
- Read projection interfaces for export/progress/overview DTOs.
- Explicit project-scoping policy as one shared utility contract.
- A small note in #117 identifying the first concrete implementation issue.

Acceptance criteria:

- Application call sites depend on named use-case/read-model functions, not table-column assumptions.
- No behavior changes.
- Existing tests continue to pass.

### Phase B: Extract Write-Side Modules

Deliverables:

- Move persistence logic into focused write-side modules by domain area.
- Keep transaction boundaries explicit and centralized.
- Keep business ID to storage key translation inside write modules.
- Start with one path, preferably assessment save or question/rubric save, rather than extracting everything at once.

Acceptance criteria:

- Existing write-path tests pass unchanged.
- Project-isolation and mutation semantics stay identical.
- Any added tests assert behavior, not implementation structure.

### Phase C: Extract Read Projections

Deliverables:

- Create projection modules for export, progress, and rubric overview.
- Keep aggregation logic isolated from write-side modules.
- Return stable projection DTOs keyed by business identifiers where appropriate.

Acceptance criteria:

- Export and progress outputs remain identical.
- Existing tests for those outputs pass.
- Gaps are covered by targeted regression tests.

### Phase D: Test Hardening and Drift Protection

Deliverables:

- Add targeted behavior tests for write contracts and projection contracts.
- Add a change-detection checklist for schema updates.

Acceptance criteria:

- A schema field change in generated DB types should mostly break adapter/write/read projection tests first, not page or UI modules.

## 7. Test Strategy and Guardrails

1. Behavior lock tests before extraction
   - Snapshot key write behaviors and read outputs where existing tests are weak.

2. Contract tests after extraction
   - Write contracts: mutation semantics, project isolation, transaction guarantees.
   - Read contracts: export rows, progress totals, rubric overview consistency.

3. Integration checks
   - Keep integration suite green through each phase.
   - Avoid one-shot large rewrites.

4. Reliability tracker sync
   - Update `plans/active/2026-05-17-reliability-hardening.md` when a refactor reduces or changes a tracked risk.
   - Link concrete PRs and tests in the relevant reliability rows/issues.

## 8. Risks and Mitigations

Risk: accidental behavior drift during extraction.

- Mitigation: phase-by-phase behavior lock tests and small PR boundaries.

Risk: duplicate abstractions with little value.

- Mitigation: extract only repeated logic or schema-sensitive logic first. Keep WET-friendly duplication until the abstraction is obvious.

Risk: increased indirection hurts onboarding.

- Mitigation: keep module naming domain-first and add short architecture notes only where needed.

Risk: this investigation conflicts with terminology or product investigations.

- Mitigation: treat names as provisional and link to the relevant investigation or issue instead of deciding terminology here.

## 9. Sequencing Recommendation

Preferred sequence, aligned with #117:

1. Resolve documentation and agent-instruction ownership enough that future agents can find the right docs.
2. Reconcile this investigation with #115, #117, #51, and the reliability tracker.
3. Extract a focused project route-context issue because it cuts across IDs, slugs, and project-scoped loading.
4. Start with a small active plan for one write-side extraction, such as assessment save or question/rubric save.
5. Continue later with read projection extraction for export and progress.
6. Update reliability tracker entries with concrete test evidence and reduced risk scores when implementation lands.

## 10. What Would Make This Complete

This investigation can be considered resolved when one of the following happens:

- ✅ the approach is accepted and extracted into a design doc or ADR — done via ADR 0007;
- ✅ a smaller active implementation plan is created for the first concrete extraction — done via the completed plans listed in §0;
- the approach is rejected or superseded by another source-structure decision — n/a, accepted.

If implemented, the underlying refactor track would be complete when:

- ✅ write paths are isolated behind stable command/write functions or repository contracts (questions, assessments, import);
- ✅ read/reporting paths are isolated behind projection/read-model functions — done for export and for progress (R-007, via `buildAssessmentCompletion`/`loadAssessmentCompletion.ts`, PR #153); **not yet done** for rubric overview (R-008);
- ✅ app-level code no longer depends on storage key shape details in the targeted write areas;
- ⏳ reliability tracker issues that overlap this refactor have updated status/evidence — R-003, R-005, R-006, R-007, R-011 Verified; R-008 remains Open and still carries the projection-extraction direction from this investigation;
- not yet assessed: schema-change implementation effort in a subsequent migration.

This investigation remains open only for the R-008 scope; once it lands (or is explicitly deferred with rationale), this document can be archived or moved to `docs/design/` as a closed-out reference.

## 11. Follow-Up Tracking Updates Required When Execution Starts

Status of original follow-ups:

- ✅ #117 — closed; the roadmap explicitly tracked moving this investigation out of `plans/active/` and reconciling it with #115/#51.
- ✅ #115 — closed (source-structure umbrella).
- ✅ #51 — closed (identifier naming).
- ✅ `plans/active/2026-05-17-reliability-hardening.md` — R-006 promoted to Verified with evidence from the 2026-06-11 export internals refactor; R-003, R-005, R-011 already Verified; R-007 promoted to Verified 2026-06-22 after `plans/completed/2026-06-11-assessment-completion-consolidation.md` landed; R-008 still updated with current paths and a pointer back to this investigation for the remaining projection-extraction direction.

Remaining tracker actions (now owned by `plans/active/2026-05-17-reliability-hardening.md`, not this document):

- Create a smaller `plans/active/...` plan for the R-008 projection extraction when that work starts.
- Re-score R-008 after that extraction lands.

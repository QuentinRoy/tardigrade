# Investigation: Read-Write Separation and Schema-Change Resilience

Status: Current investigation, proposed direction
Date: 2026-05-18
Last reviewed: 2026-05-26
Owner: Unassigned
Related: #115, #117, #51, `plans/active/reliability-hardening.md`

## 0. Current Status and Ownership

This document remains useful, but it should be treated as an investigation and proposed direction rather than an active execution plan or final architecture decision.

It explores an implementation strategy for separating write-side command/persistence paths from read-side projection/reporting paths. It does not own the broader source-structure audit, terminology decisions, product workflow decisions, or final caching/loading strategy.

Document ownership boundaries:

- #115 and `docs/investigations/source-structure-and-tech-debt-audit.md` own the broader source-structure and technical-debt audit.
- #117 owns the DX sequencing roadmap.
- #51 owns database identifier naming conventions.
- `plans/active/reliability-hardening.md` owns reliability risks, priority, and test evidence.
- This investigation owns the proposed read/write separation direction and its schema-change-resilience rationale.

If this becomes the next implementation track, create a smaller active plan under `plans/active/`, for example:

```txt
plans/active/split-assessment-save-path.md
plans/active/extract-question-write-path.md
plans/active/extract-progress-read-projections.md
```

If the approach is accepted as architecture, extract the chosen parts into `docs/design/` or an ADR.

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

Reference: [`plans/active/reliability-hardening.md`](../../plans/active/reliability-hardening.md)

Direct overlap:

- R-003, questions/rubrics mutation safety: boundary extraction reduces write-path complexity and mutation side effects.
- R-005, project isolation: centralized project-scoped repositories reduce cross-project leakage risk.
- R-006, export correctness: read projections isolate stream/shape logic from write schemas.
- R-007, progress metric correctness: projection-only modules simplify aggregate correctness testing.
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
- `docs/investigations/source-structure-and-tech-debt-audit.md`.
- `docs/investigations/investigation-overlap-audit.md`.

Boundary:

- #115/source audit owns broad source-structure findings, file-splitting candidates, UI/shared ownership, import/export organization, and follow-up issue candidates.
- #117 owns sequencing across documentation cleanup, route context, read/write separation, and reliability work.
- This investigation owns the narrower proposed direction for separating write operations from read projections.

## 5. Current Coupling Hotspots

Write-heavy hotspots:

- `src/import/saveQuestions.ts`
- `src/db/questions.ts`
- `src/db/assessments.ts`
- `src/import/saveAssessments.ts`

Read/projection-heavy hotspots:

- `src/export/submissionExport.ts`
- `src/db/submissionProgress.ts`
- `src/db/assessmentsProgress.ts`
- `src/db/rubricOverview.ts`

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
   - Update `plans/active/reliability-hardening.md` when a refactor reduces or changes a tracked risk.
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

- the approach is accepted and extracted into a design doc or ADR;
- a smaller active implementation plan is created for the first concrete extraction;
- the approach is rejected or superseded by another source-structure decision.

If implemented, the underlying refactor track would be complete when:

- write paths are isolated behind stable command/write functions or repository contracts;
- read/reporting paths are isolated behind projection/read-model functions;
- app-level code no longer depends on storage key shape details in the targeted areas;
- reliability tracker issues that overlap this refactor have updated status/evidence;
- schema-change implementation effort measurably shrinks in a subsequent migration.

## 11. Follow-Up Tracking Updates Required When Execution Starts

Update:

- #117, to show this investigation has moved from proposed direction to execution.
- #115, if source-structure acceptance criteria are affected.
- #51, if identifier naming or row-id/business-id boundaries are affected.
- `plans/active/reliability-hardening.md`, when a tracked risk gets evidence or reduced risk.

Suggested tracker actions:

- Create a smaller `plans/active/...` file for the first concrete extraction.
- Mark overlap risks as In Progress with references to extraction PRs.
- Add test evidence links as each phase lands.
- Re-score R-003, R-005, R-006, R-007, and R-011 after relevant extraction work lands.

# Plan: Read-Write Separation and Schema-Change Resilience

Status: Proposed
Date: 2026-05-18
Owner: Unassigned

## 1. Problem Statement

Recent key-migration work required touching many modules across write paths, read/aggregation paths, and export/reporting paths. The current coupling makes schema changes expensive and risky because table-level details leak into many layers.

Primary objective:
- Reduce blast radius of future schema changes by separating write models from read models and introducing stable domain-level boundaries.

Secondary objective:
- Align this refactor with existing reliability work without broadening scope beyond manageable increments.

## 2. Desired Architecture Outcome

Target architecture layers:

1. Domain/Application layer
- Receives project-scoped business inputs (business IDs, user intent, validations).
- Does not depend on storage key type details (for example, row IDs versus natural IDs).

2. Write repository layer
- Owns all write-side key resolution and persistence details.
- Exposes stable write operations for question/rubric/assessment workflows.

3. Read projection layer
- Owns all query shaping for overview/progress/export/rubric analytics.
- Exposes stable read DTOs and aggregation outputs.

4. Migration and schema adapter layer
- Owns schema transitions and backfills.
- Keeps additive migration strategy and controlled switchover patterns.

## 3. In Scope and Out of Scope

In scope:
- Introduce clear repository boundaries for write operations.
- Introduce read projection modules for reporting/export/progress.
- Replace direct table-coupled joins in app-level code with domain DTO contracts.
- Add guardrail tests to lock behavior while internals evolve.

Out of scope:
- UI redesign or interaction changes.
- Broad domain behavior changes not required for boundary extraction.
- Reopening already-completed migration decisions unless a data-loss risk is identified.

## 4. Overlap and Related Aspects

### 4.1 Overlap With Reliability Tracker

Reference: [docs/plans/2026-05-18-reliability-hardening-tracker.md](docs/plans/2026-05-18-reliability-hardening-tracker.md)

Direct overlap:
- R-003 (questions/rubrics mutation safety): boundary extraction reduces write-path complexity and mutation side effects.
- R-005 (project isolation): centralized project-scoped repositories reduce cross-project leakage risk.
- R-006 (export correctness): read projections isolate stream/shape logic from write schemas.
- R-007 (progress metric correctness): projection-only modules simplify aggregate correctness testing.
- R-011 (question/rubric save semantics): write repositories make save behavior explicit and testable.

Related but indirect:
- R-001 (assessment import atomicity): already mitigated, but repository boundaries make transactional contracts easier to preserve.
- R-002 (DB invariant enforcement): better layer separation simplifies invariant-focused integration testing.
- R-013 and R-015 (UX error contracts): cleaner domain interfaces improve actionable error mapping.

### 4.2 Overlap With #46 and #34 Unified Migration Plan

Reference: [docs/plans/2026-05-18-issues-46-34-unified-key-migration.md](docs/plans/2026-05-18-issues-46-34-unified-key-migration.md)

Direct overlap:
- Key translation concerns now belong in write repositories, not scattered across import/export/progress modules.
- Read modules should consume business IDs and derived DTOs rather than raw FK storage fields.

Scope boundary recommendation:
- Do not blend this architectural refactor into one large migration PR.
- Sequence this as follow-up hardening with controlled increments and behavior-lock tests.

## 5. Current Coupling Hotspots (Refactor Targets)

Write-heavy hotspots:
- [src/import/saveQuestions.ts](src/import/saveQuestions.ts)
- [src/db/questions.ts](src/db/questions.ts)
- [src/db/assessments.ts](src/db/assessments.ts)
- [src/import/saveAssessments.ts](src/import/saveAssessments.ts)

Read/projection-heavy hotspots:
- [src/export/submissionExport.ts](src/export/submissionExport.ts)
- [src/db/submissionProgress.ts](src/db/submissionProgress.ts)
- [src/db/assessmentsProgress.ts](src/db/assessmentsProgress.ts)
- [src/db/rubricOverview.ts](src/db/rubricOverview.ts)

Cross-cutting schema boundary:
- [src/db/generated/db.ts](src/db/generated/db.ts)

## 6. Incremental Execution Plan

### Phase A: Define Stable Contracts

Deliverables:
- Write operation interfaces for question/rubric/assessment persistence.
- Read projection interfaces for export/progress/overview DTOs.
- Explicit project-scoping policy as one shared utility contract.

Acceptance criteria:
- Application call sites depend on interfaces, not table-column assumptions.
- No behavior changes.

### Phase B: Extract Write Repositories

Deliverables:
- Move persistence logic into focused repository modules by domain area.
- Keep transaction boundaries explicit and centralized.
- Keep business ID to storage key translation inside repositories.

Acceptance criteria:
- Existing write-path tests pass unchanged.
- Project-isolation and mutation semantics stay identical.

### Phase C: Extract Read Projections

Deliverables:
- Create projection modules for export, progress, and rubric overview.
- Keep aggregation logic isolated from write repositories.
- Return stable projection DTOs keyed by business identifiers.

Acceptance criteria:
- Export and progress outputs remain identical.
- Existing tests for those outputs pass; gaps are covered by added regression tests.

### Phase D: Test Hardening and Drift Protection

Deliverables:
- Add targeted behavior tests for repository contracts and projection contracts.
- Add a change-detection checklist for schema updates.

Acceptance criteria:
- A schema field change in generated DB types should mostly break adapter/repository tests first, not app-level modules.

## 7. Test Strategy and Guardrails

1. Behavior lock tests before extraction
- Snapshot key write behaviors and read outputs.

2. Contract tests after extraction
- Write contracts: mutation semantics, project isolation, transaction guarantees.
- Read contracts: export rows, progress totals, rubric overview consistency.

3. Integration checks
- Keep integration suite green through each phase, avoiding one-shot large rewrites.

## 8. Risks and Mitigations

Risk: accidental behavior drift during extraction.
- Mitigation: phase-by-phase behavior lock tests and small PR boundaries.

Risk: duplicate abstractions with little value.
- Mitigation: extract only repeated logic or schema-sensitive logic first.

Risk: increased indirection hurts onboarding.
- Mitigation: keep module naming domain-first and add short architecture notes per module.

## 9. Sequencing Recommendation

Preferred sequence:
1. Complete and stabilize migration-related work and reliability blockers.
2. Start with write repository extraction in question/rubric save flows.
3. Continue with read projection extraction for export and progress.
4. Update reliability tracker entries with concrete test evidence and reduced risk scores.

## 10. Definition of Done

This plan is complete when:
- Write paths are isolated behind repository contracts.
- Read/reporting paths are isolated behind projection contracts.
- App-level code no longer depends on storage key shape details.
- Reliability tracker issues that overlap this refactor have updated status/evidence.
- Schema-change implementation effort measurably shrinks in a subsequent migration.

## 11. Follow-Up Tracking Updates (Required)

When execution starts, update:
- [docs/plans/2026-05-18-reliability-hardening-tracker.md](docs/plans/2026-05-18-reliability-hardening-tracker.md)
- [docs/plans/2026-05-18-issues-46-34-unified-key-migration.md](docs/plans/2026-05-18-issues-46-34-unified-key-migration.md)

Suggested tracker actions:
- Mark overlap risks as In Progress with references to extraction PRs.
- Add test evidence links as each phase lands.
- Re-score R-003, R-005, R-006, R-007, R-011 after Phase C.

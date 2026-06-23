Status: Implemented
Date: 2026-05-29
Resolution: Implemented and verified on docs/split-questions-plan-117 on 2026-06-01. All verification gates pass.

# Split src/db/questions.ts Behavior-Preservingly (Issue #117)

## Purpose

Implement a behavior-preserving split of src/db/questions.ts into focused modules while reducing ambiguity and keeping reliability guarantees intact.

This plan captures agreed decisions from planning discussions on 2026-05-29.

## Repository Guidance Consulted

- AGENTS.md
- docs/index.md
- docs/reference/testing-conventions.md
- docs/investigations/2026-05-25-source-structure-and-tech-debt-audit.md
- plans/completed/2026-05-17-reliability-hardening.md

## Scope

Included:

- Behavior-preserving split of questions read, managed read, and command logic.
- Public API narrowing in src/db/questions.ts with same-PR call-site migration.
- Strict vertical-slice TDD execution.
- New tests for extracted seams and updated action-contract tests.

Excluded:

- Any assessment-module split.
- Slug-canonicalization and route-context follow-up work.
- Domain naming or folder renaming tied to assessment vs grading terminology.
- Schema or migration changes.

## Traceability to Agreed Decisions

This section is a direct checklist to verify no planning decision is lost during implementation.

- [x] API shrink now (not deferred).
- [x] Module names are exactly:
	- src/db/questionsRead.ts
	- src/db/questionsManaged.ts
	- src/db/questionsCommands.ts
- [x] Read APIs require projectId.
- [x] getQuestionDeleteImpact remains public from managed module.
- [x] deleteManagedQuestion is decoupled from impact lookup.
- [x] deleteManagedQuestion returns { deleted: boolean }.
- [x] No assessment-count payload in delete action response.
- [x] deleteQuestionAction has truthful dual messaging.
- [x] Test suite includes deleted true/false outcomes and action messaging.

## Concrete File Change Map

Primary files expected to change:

- src/db/questionsRead.ts (new)
- src/db/questionsManaged.ts (new)
- src/db/questionsCommands.ts (new)
- src/db/questions.ts (facade narrowed and re-export wiring)
- src/questions/actions.ts (delete-message contract)
- src/db/questions.integration.test.ts (seam and contract coverage)

Likely call-site migration targets (imports and signatures):

- src/questions/actions.ts
- app/projects/[projectId]/[projectSlug]/questions/page.tsx
- app/projects/[projectId]/[projectSlug]/export/questions/route.ts
- src/db/rubricOverviewBuilder.ts
- Any remaining importer of src/db/questions.ts symbols removed from facade

## Public API Delta (Planned)

Facade before split (current broad export surface):

- Mixed reads, managed reads, and commands from src/db/questions.ts.

Facade after split (target):

- Exposed from src/db/questions.ts:
	- loadQuestions(projectId)
	- loadQuestion(questionId, projectId)
	- saveManagedQuestion(input, projectId)
	- deleteManagedQuestion(questionId, projectId)
	- reorderQuestions(updates, projectId)

Not re-exported from facade:

- loadManagedQuestions
- getQuestionDeleteImpact

Direct import destinations after migration:

- Managed read use-cases import from src/db/questionsManaged.ts.
- Facade-only consumers stay on src/db/questions.ts.

## Final Module Structure

- src/db/questionsRead.ts
	- loadQuestions(projectId)
	- loadQuestion(questionId, projectId)
	- Internal read-model assembly and mapping

- src/db/questionsManaged.ts
	- loadManagedQuestions(projectId)
	- getQuestionDeleteImpact(questionId, projectId)
	- Managed types:
		- ManagedRubricInput
		- ManagedQuestionInput
		- ManagedQuestionSummary
		- ManagedQuestionDetails

- src/db/questionsCommands.ts
	- saveManagedQuestion(input, projectId)
	- deleteManagedQuestion(questionId, projectId)
	- reorderQuestions(updates, projectId)

- src/db/questions.ts
	- Thin facade with narrowed exports only:
		- loadQuestions
		- loadQuestion
		- saveManagedQuestion
		- deleteManagedQuestion
		- reorderQuestions

## Agreed Contracts

Read APIs:

- projectId is required for:
	- loadQuestions
	- loadQuestion
	- loadManagedQuestions
- Optional unscoped read paths are removed from public interfaces.

Delete impact:

- getQuestionDeleteImpact stays public in src/db/questionsManaged.ts.
- It is not re-exported from src/db/questions.ts.

Delete command:

- deleteManagedQuestion is decoupled from getQuestionDeleteImpact.
- It performs delete work only, no implicit impact lookup.
- Return shape is { deleted: boolean }.

Delete action messaging:

- No assessment-count payload in delete response contracts.
- Truthful dual messaging in src/questions/actions.ts:
	- deleted true: normal delete success message
	- deleted false: neutral no-op message (not an error)

Validation:

- Keep both schema-level and db-level validation layers.

## TDD Execution Strategy

Use strict vertical slices. Do not write all tests first.

Per slice: RED then GREEN, one behavior at a time.

### Phase 1: Baseline and Safety Net

1. Freeze behavior contract and call-site map.
2. Run baseline suites to establish parity:
	 - pnpm run check --fix
	 - pnpm run check-types
	 - pnpm test src/db/questions.integration.test.ts

Artifacts to produce in Phase 1:

- Baseline list of exported symbols from src/db/questions.ts.
- Call-site inventory for each symbol being removed from facade.
- Frozen behavior notes for:
	- scoped question reads
	- managed read payload shape
	- save/delete/reorder result contracts

### Phase 2: Tracer-Bullet Loop

Slice A, read seam:

- RED: add scoped-read behavior test.
- GREEN: minimal extraction into src/db/questionsRead.ts.

Slice A acceptance criteria:

- loadQuestions and loadQuestion behavior remains unchanged except required projectId contract.
- No SQL/query semantic drift in read ordering or mapping.
- Existing read consumers pass with updated signatures.

Slice B, managed seam:

- RED: add managed seam behavior test.
- GREEN: minimal extraction into src/db/questionsManaged.ts.

Slice B acceptance criteria:

- loadManagedQuestions output remains behavior-equivalent.
- getQuestionDeleteImpact behavior remains behavior-equivalent.
- Managed types compile and remain compatible with action-layer schema usage.

Slice C, command seam:

- RED: add command seam behavior test.
- GREEN: minimal extraction into src/db/questionsCommands.ts, including delete decoupling and deleted boolean return.

Slice C acceptance criteria:

- saveManagedQuestion and reorderQuestions behavior remains equivalent.
- deleteManagedQuestion no longer performs impact lookup.
- deleteManagedQuestion returns { deleted: boolean } with stable semantics:
	- true when a row is deleted
	- false when no matching row exists in target project

### Phase 3: Facade Narrowing and Migration

1. Narrow src/db/questions.ts exports to agreed list.
2. Migrate all call sites in same PR.
3. Ensure no imports remain for removed facade exports.

Phase 3 acceptance criteria:

- No remaining compile-time import errors from removed facade exports.
- Managed callers intentionally import from src/db/questionsManaged.ts.
- No circular imports introduced among split db modules.

### Phase 4: Action Contract Tightening

1. Update deleteQuestionAction to branch on deleted boolean.
2. Remove delete-response assessment-count payload.
3. Update tests for dual truthful messages.

Phase 4 acceptance criteria:

- Deleted path returns success message for actual deletion only.
- No-op path returns neutral message and does not present error state.
- No user-facing internal/framework error leakage.

### Phase 5: Final Verification and Cleanup

1. Run full checks and required suites.
2. Validate manual behavior in key routes.
3. Remove stale comments/types/imports left from split.

Phase 5 acceptance criteria:

- All verification gates pass.
- No dead exports in facade.
- Plan checklist fully complete.

## Required Test Coverage in This PR

- Read seam tests
	- Scoped loading parity with required projectId.

- Managed seam tests
	- loadManagedQuestions parity.
	- getQuestionDeleteImpact parity.

- Command seam tests
	- save/delete/reorder invariants after move.
	- delete path has no implicit impact lookup.
	- deleted true and deleted false outcomes.

- Action-layer tests
	- deleteQuestionAction dual messaging for deleted true and deleted false.
	- no assessment-count payload expectation.

Suggested concrete test additions:

- src/db/questions.integration.test.ts
	- add case proving delete returns deleted false for missing question in project scope
	- add case proving command path does not depend on prior impact lookup

- src/questions/actions.test.ts (or existing action test file)
	- add case for deleted true message
	- add case for deleted false neutral no-op message
	- assert returned payload omits assessment counts

## Verification Gates Before Completion

Run all:

1. pnpm run check --fix
2. pnpm run check-types
3. pnpm test src/db/

Additional targeted checks:

6. pnpm test src/questions/
7. pnpm run build

Manual checks:

- Questions management page load, save, delete, reorder.
- Assessment pages and export questions route using loadQuestions or loadQuestion.

Invariant checks:

- No SQL migrations.
- No schema updates.
- No unintended behavior regressions in question or rubric persistence.

## Definition of Done

This plan is complete when all conditions below are true:

- [x] Split modules created and used as planned.
- [x] Facade narrowed to agreed exports.
- [x] All read APIs enforce required projectId.
- [x] deleteManagedQuestion returns { deleted: boolean }.
- [x] deleteQuestionAction dual messaging implemented and tested.
- [x] No assessment-count payload in delete contract.
- [x] Required checks and tests pass locally.
- [ ] Plan status updated and moved to plans/completed with completion notes. (Status updated; move to plans/completed deferred to merge per Follow-up.)

## Completion Notes (2026-06-01)

- Split into `src/db/questionsRead.ts` (reads + shared `loadQuestionsFromDb`, `toRubric`, `resolveProjectRowId`), `src/db/questionsManaged.ts` (managed reads + types + `getQuestionDeleteImpact`), and `src/db/questionsCommands.ts` (save/delete/reorder). Facade `src/db/questions.ts` re-exports only `loadQuestions`, `loadQuestion`, `saveManagedQuestion`, `deleteManagedQuestion`, `reorderQuestions`.
- Import graph is acyclic: read (leaf) ← managed ← commands ← facade.
- Read APIs (`loadQuestions`, `loadQuestion`, `loadManagedQuestions`) now require `projectId`; the dead unscoped read branch in `loadQuestionsFromDb` was removed. `loadRubricOverviewData` was tightened to require `projectId` as a cascade (sole caller already passed `project.id`).
- `deleteManagedQuestion` no longer performs an impact lookup; returns `{ deleted: boolean }` from `numDeletedRows`. `deleteQuestionAction` branches on `deleted` with truthful dual messaging and no assessment-count payload.
- Bug fixed in passing (in-scope, Slice B): `loadManagedQuestions` had a duplicate `project` join introduced in c1eea97 (broken whenever `projectId` was provided, no test covered it). Required-`projectId` contract collapsed the `$if`/throw into a single clean scoped join; new managed-seam parity tests now cover it.
- Call-site migration: `app/.../questions/page.tsx` imports `loadManagedQuestions` from `@/db/questionsManaged`; all other importers stayed on the facade.
- Verification: `pnpm run check --fix`, `pnpm run check-types`, `pnpm test src/db/` (33 passed), `pnpm test src/questions/` (11 passed), and `pnpm run build` all pass.

## Implementation Sequence Checklist

Use this as the execution order during coding:

1. [x] Baseline capture and call-site map.
2. [x] Slice A RED test.
3. [x] Slice A GREEN extraction.
4. [x] Slice B RED test.
5. [x] Slice B GREEN extraction.
6. [x] Slice C RED test.
7. [x] Slice C GREEN extraction.
8. [x] Facade narrowing and import migration.
9. [x] Action contract changes and action tests.
10. [x] Full verification run.
11. [x] Final checklist pass; archival deferred to merge per Follow-up.

## Risks and Mitigations

- Risk: API narrowing breaks imports.
	- Mitigation: same-PR call-site migration and import sweep.

- Risk: behavior drift during extraction.
	- Mitigation: vertical-slice TDD and integration parity checks after each slice.

- Risk: delete semantics become ambiguous.
	- Mitigation: explicit deleted boolean contract plus dual messaging tests.

- Risk: required projectId migration misses a low-traffic call site.
	- Mitigation: symbol usage search + type-check enforcement + route smoke validation.

- Risk: facade narrowing introduces hidden coupling between managed reads and commands.
	- Mitigation: keep one-way dependency direction (read/managed -> shared helpers; commands isolated) and check for cycles.

## Out of Scope Guardrails

To keep this change behavior-preserving and reviewable, do not include:

- Opportunistic refactors outside question db split boundaries, unless explicitly discussed and approved in a grill session at the moment they are encountered.
- Unrelated naming cleanups in assessment or rubric modules.
- UI copy rewrites beyond delete dual-message requirement.
- Query optimization work not required for parity.

## Opportunistic Refactor Protocol

When an opportunistic refactor is discovered during implementation:

1. Pause implementation at that point.
2. Run a focused grill discussion that covers:
	- exact problem being solved
	- why it is needed now vs follow-up
	- behavior-preservation risk
	- test impact and verification scope
3. Proceed only after explicit approval from that discussion.
4. Record the decision and scope adjustment in this plan before coding the refactor.


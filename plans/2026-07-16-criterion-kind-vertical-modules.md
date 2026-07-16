# Criterion-kind vertical modules migration

- **Status:** Active
- **Created:** 2026-07-16
- **Origin:** [ADR 0013](../docs/adr/0013-criterion-kind-vertical-modules.md); [criterion-kind ownership investigation](../docs/investigations/2026-07-16-criterion-kind-ownership-and-persistence.md)
- **Tracked by:** #273

## Purpose

Execute [ADR 0013](../docs/adr/0013-criterion-kind-vertical-modules.md): make each criterion kind a vertical module under `src/criteria/{check,options,number}/`. Every step is **behavior-preserving** — file moves, seam extraction, and type collapse only; no product behavior changes, and `main` never goes red. Read ADR 0013 for the decision and the investigation for the rationale and rejected alternatives; this plan owns *how* and *in what order*.

## Strategy: pilot one kind, then replicate

Convert **one kind end-to-end first**, standing up the generic scaffolding it needs, and land it as one green PR. The other two kinds then follow the proven template, one PR each.

**Pilot: Check** — the simplest kind (true/false marks; no ranges, interpolation, or reconciliation). Piloting the simplest kind isolates the *structural machinery* risk (folder shape, coordinators, client/server split, dependency-cruiser interplay) from domain complexity. Then **Number** (stress-tests holding complexity; collapses the four-plus bounds-invariant copies), then **Options** last (its stale-mark reconciliation is the messiest persistence).

## Guidance consulted

- [ADR 0013](../docs/adr/0013-criterion-kind-vertical-modules.md) (the decision), [ADR 0010](../docs/adr/0010-organize-src-as-enforced-vertical-layers.md) (vertical layers; the rule-5 exception is recorded in 0013), [ADR 0002](../docs/adr/0002-db-is-infrastructure-features-own-persistence.md) (db is infra), [ADR 0007](../docs/adr/0007-db-primitives-take-a-handle-wrappers-own-transactions-and-cache.md) (primitive/wrapper), [ADR 0004](../docs/adr/0004-avoid-barrel-files.md) (no barrels).
- [`CONTEXT.md`](../CONTEXT.md) — Criterion vocabulary is settled and must not change; **Number Criterion Bounds**, **Options Marks Minimum**, **Criterion Subtype Invariant**, DB Primitive / App-Level Wrapper.
- [testing conventions](../docs/reference/testing-conventions.md) for test-command selection.
- [typescript-api-design](../.agents/skills/typescript-api-design/SKILL.md) for the coordinator/kind-adapter signatures pinned below.
- [tdd](../.agents/skills/tdd/SKILL.md) — scoped to the one genuinely new test, `checkPersistence.integration.test.ts` (PR1); the rest of test-seam migration is mechanical (existing tests follow their moved code), not new tests written test-first.

## Sequence

### PR1 — Generic scaffolding + Check pilot — **Landed in [#295](https://github.com/QuentinRoy/tardigrade/pull/295)**

**As-built deviations (all behavior-preserving):**

- `attachCheckGrade` stayed in `criteria/criterion.ts` as exhaustive dispatch above the folder, not in `criteria/check/`: moving it would create a `types.ts`↔`check/` cycle since `GradedCriterion` lives in `types.ts`. Only the grade **content** type (`CheckCriterionGradeContent`) moved down. This matches the ADR's "generic `attachGrade` unchanged".
- The coordinator dispatches the three kind adapters via `Promise.all` (independent subtype tables) rather than the callers' original sequential order — behavior-equivalent, satisfies the repo's parallelism guidance.
- Test-seam migration was done for the one **required** moved symbol (`markCheckCriterion` → `criteria/check/checkDomain.test.ts`) plus new focused seam tests (`checkDomain.test.ts`, `checkPersistence.integration.test.ts`). The Check-specific cases in `schemas.test.ts`, `parseRubrics.test.ts`, `rubrics.test.ts`, `resultsBuilder.test.ts`, and `rubricsExport.test.ts` were **left in place** — they stay green and now exercise the new seams indirectly. Fully relocating them is churn without a coverage change; folded into the PR4 test revision.
- Check YAML **encode** is an explicit per-kind projection (`encodeCheckCriterion`); `options`/`number` pass through the `encodeCriterion` dispatcher unchanged until their folders land. Test snapshots preserved; production check-criterion YAML key order is now normalized (semantically identical, untested).

Stand up the above-folder generic surface and migrate Check fully:

- Assemble `Criterion`/`CriterionGrade` unions from per-kind content; keep generic `markCriterion`/`attachGrade` (its `as` casts remain), add `getCriterionDetails` exhaustive dispatch (move `resultsBuilder.ts`'s existing `toCriterionDetails` — it already serves both consumers). **The static union-keyed kind map is deferred to PR4** — in PR1 only `criteria/check/` exists, so a union-keyed map would either be premature scaffolding or hold pointers into `rubric-management` (a vertical) it must not import. `CRITERION_KINDS` stays as-is until PR4, when all three folders exist.
- Move the criterion-definition persistence **coordinator** down to `criteria`, scoped to criterion row-id resolution, group-by-kind, and subtype-adapter dispatch. **It handles all three kinds from day one** so PR1 actually deletes the duplicated subtype code from both callers: Check's batched subtype upsert lands in `criteria/check/checkPersistence.ts`; Number's and Options' batched upserts (including the Options mark-reconciliation block) become **private, non-exported helpers inside the coordinator file**, relocated into their own kind folders in PR2/PR3 as pure moves. The criterion base-row insert/update/delete stays in each vertical (rename-by-`previousId` loop vs batch upsert — semantics differ by design); `rubric-management` and `imports` call the coordinator downward inside their own transactions/cache.
  - **Coordinator signature:** `saveCriterionSubtypesInDb(db, { criteria, gridRowId, rubricRowId? })`. It resolves `criterionRowIdById` itself (the `SELECT id, rowId FROM criterion WHERE gridRowId = ? [AND rubricId = ?]` duplicated in both callers today), groups by kind, dispatches. `rubricRowId` is optional: `rubric-management` passes it (preserves today's extra scoping); `imports` omits it (already spans multiple rubrics per call). Behavior-preserving for both.
  - **Kind adapter signature:** `(db, rows: Array<{ criterionRowId: number } & KindFields>) => Promise<void>`.
  - **Coordinator input type is derived, not hand-written:** the Check variant derives from the moved Check schema's `z.output` (`Pick<…, "id" | "kind" | "marks" | "falseMarks">` — honestly sources Check's optional `falseMarks`, which the domain `Criterion` type has as required); Number and Options derive from the domain union as `Omit<CriterionForKind<"number" | "options">, "description" | "label">` (their subtype fields match exactly; both callers' values are already assignable). The coordinator's transient dependence on the domain union for Number/Options disappears in PR2/PR3 when those variants swap to their own `z.output`.
- Dedupe **read hydration**: collapse the two `toCriterionGrade` copies (`grading/grades.ts`, `results/resultsBuilder.ts`) into one kind-aware hydrator in `criteria`; `rubrics/rubrics.ts`'s `toCriterion` stays the exhaustive dispatcher but delegates the Check row→config mapping to the kind folder.
- Create `criteria/check/`: domain (defaults, `markCheck`, marks bounds) + bounds/answer invariant; editor schema leaf + YAML decode schema leaf; YAML encode; `exportGradeValue` (CSV grade-value projection); definition + grade subtype persistence adapters (`server-only`) and row→config read mapping; `CheckEditorFields.tsx` (narrow self-owned error prop); the editor default factory (`createCheckCriterion` from `CriterionEditorPaper.tsx`); `describeCheck` for the details projection; grade control already present.
- Grade-persistence plumbing follows the pinned ordering (investigation, Persistence): coordinator resolves context → kind validate `(db, criterionRowId, gradeContent)` → parent `criterionGrade` upsert → kind write `(db, criterionGradeId, gradeContent)` → `clearOtherSubtypeValues`.
- Collapse `CriterionEditorValue`/`CriterionDefinitionInput` for Check to the editor schema's `z.output`.
- **Acceptance criterion:** per-kind refines moved into kind schemas keep relative issue paths (e.g. `path: ["maxValue"]`), so `criteria[i].field` zod paths and `zodErrorToRubricsValidationError` stay unchanged.
- **Test-seam migration.** Tests of a moved symbol follow it (mechanical, keeps `main` green): the `markCheckCriterion` cases split from `criterion.test.ts` into `criteria/check/`'s domain test (the `markNumberCriterion` block stays); Check editor-schema cases follow the schema leaf out of `rubric-management/schemas.test.ts` (Number/Options and rubric-level `superRefine` cases stay); Check YAML decode/encode, `toCriterion` Check-mapping, and `describeCheck` assertions follow their moved code out of `parseRubrics.test.ts`, `rubrics.test.ts`, `resultsBuilder.test.ts`, `rubricsExport.test.ts`. The exhaustive-dispatch wrappers stay tested above. The two **persistence integration tests** (`rubricDefinitionMutations.integration.test.ts`, `saveRubrics.integration.test.ts`) stay **intact** — they pass through the coordinator end-to-end and stay green under the behavior-preserving move — and PR1 adds one focused seam test, `criteria/check/checkPersistence.integration.test.ts`, for the batched Check upsert + coordinator dispatch. Revising/relocating the vertical persistence tests toward the seam is deferred to PR4 (see below).

### PR2 — Number

Replicate the template for Number; collapse the four-plus bounds-invariant copies into `criteria/number/`'s invariant consumed by editor schema, import schema, grade-save, and marking.

### PR3 — Options

Replicate for Options; move stale-mark reconciliation into `criteria/options/`; keep the coordinator's by-kind batching intact.

### PR4 — Sweep and tidy

Remove now-dead parallel shapes and confirm the enumerated remaining kind-aware loci match the investigation; verify no new `as`/`any` via `pnpm run check` and no new cycles/boundary violations via `pnpm run lint:boundaries`. Also, now that all three kind folders exist:

- Introduce the static union-keyed kind map (deferred from PR1) and replace hardcoded `CRITERION_KINDS`; apply the ADR 0013 guardrails (no cross-tier references bundled in one object — split client-facing vs server-facing or hold only pure metadata; labels stay in `getCriterionKindLabel`).
- Revise the two persistence integration tests (`rubricDefinitionMutations.integration.test.ts`, `saveRubrics.integration.test.ts`) left intact in PR1: relocate subtype-persistence assertions toward the per-kind seam tests where they now belong, thinning the vertical tests to base-row/orchestration coverage.

## Settled during grilling (2026-07-16)

The three points previously flagged here are now designed (recorded inline in PR1/PR4 above):

- **Definition-path coordinator ↔ kind-adapter signatures** — pinned: `saveCriterionSubtypesInDb(db, { criteria, gridRowId, rubricRowId? })` resolving row ids itself; adapters take `(db, rows: Array<{ criterionRowId } & KindFields>)`; input type derived (Check from schema `z.output`, Number/Options from the domain union via `Omit`). Coordinator handles all three kinds in PR1 so the dedupe is real immediately; Number/Options subtype writers live as private helpers in the coordinator file until PR2/PR3 move them into their folders.
- **Union-keyed kind map contents** — **deferred to PR4**, when all three folders exist; PR1 keeps `CRITERION_KINDS`. Guardrails (no cross-tier bundling; labels stay in the lexicon layer) apply then.
- **Test-seam migration order** — pinned for Check: moved-symbol tests follow their code; persistence integration tests stay intact in PR1 with one added seam test, and are revised toward the seam in PR4.

Previously open, now settled (recorded in the investigation): grade-persistence plumbing (pinned ordering + signatures); CSV export (kind owns the grade-value projection, `export` owns the kind-uniform column shape); error-mapper coupling (acceptance criterion in PR1 — relative refine paths keep zod issue paths unchanged); `getCriterionDetails` shape (move the existing `toCriterionDetails`).

## Checks

Per PR: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run lint:boundaries`, and the targeted unit/integration/Storybook tests matching the changed files. `main` stays green throughout; dependency-cruiser stays at `error` with an empty baseline.

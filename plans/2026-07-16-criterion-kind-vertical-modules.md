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

## Sequence

### PR1 — Generic scaffolding + Check pilot

Stand up the above-folder generic surface and migrate Check fully:

- Assemble `Criterion`/`CriterionGrade` unions from per-kind content; keep generic `markCriterion`/`attachGrade` (its `as` casts remain), add `getCriterionDetails` exhaustive dispatch (move `resultsBuilder.ts`'s existing `toCriterionDetails` — it already serves both consumers), and the static union-keyed kind map (client- and server-facing split as needed).
- Move the criterion-definition persistence **coordinator** down to `criteria`, scoped to criterion row-id resolution, group-by-kind, and subtype-adapter dispatch. The criterion base-row insert/update/delete stays in each vertical (rename-by-`previousId` loop vs batch upsert — semantics differ by design); `rubric-management` and `imports` call the coordinator downward inside their own transactions/cache.
- Dedupe **read hydration**: collapse the two `toCriterionGrade` copies (`grading/grades.ts`, `results/resultsBuilder.ts`) into one kind-aware hydrator in `criteria`; `rubrics/rubrics.ts`'s `toCriterion` stays the exhaustive dispatcher but delegates the Check row→config mapping to the kind folder.
- Create `criteria/check/`: domain (defaults, `markCheck`, marks bounds) + bounds/answer invariant; editor schema leaf + YAML decode schema leaf; YAML encode; `exportGradeValue` (CSV grade-value projection); definition + grade subtype persistence adapters (`server-only`) and row→config read mapping; `CheckEditorFields.tsx` (narrow self-owned error prop); the editor default factory (`createCheckCriterion` from `CriterionEditorPaper.tsx`); `describeCheck` for the details projection; grade control already present.
- Grade-persistence plumbing follows the pinned ordering (investigation, Persistence): coordinator resolves context → kind validate `(db, criterionRowId, gradeContent)` → parent `criterionGrade` upsert → kind write `(db, criterionGradeId, gradeContent)` → `clearOtherSubtypeValues`.
- Collapse `CriterionEditorValue`/`CriterionDefinitionInput` for Check to the editor schema's `z.output`.
- Replace hardcoded `CRITERION_KINDS` with the union-keyed map.
- **Acceptance criterion:** per-kind refines moved into kind schemas keep relative issue paths (e.g. `path: ["maxValue"]`), so `criteria[i].field` zod paths and `zodErrorToRubricsValidationError` stay unchanged.
- Migrate Check tests to the kind's domain/persistence/YAML/UI seams.

### PR2 — Number

Replicate the template for Number; collapse the four-plus bounds-invariant copies into `criteria/number/`'s invariant consumed by editor schema, import schema, grade-save, and marking.

### PR3 — Options

Replicate for Options; move stale-mark reconciliation into `criteria/options/`; keep the coordinator's by-kind batching intact.

### PR4 — Sweep and tidy

Remove now-dead parallel shapes and confirm the enumerated remaining kind-aware loci match the investigation; verify no new `as`/`any` via `pnpm run check` and no new cycles/boundary violations via `pnpm run lint:boundaries`.

## Needs more grilling before implementation

Design these before writing the code they govern:

- **Definition-path coordinator ↔ kind-adapter signatures** — what the coordinator hands each adapter (db handle, batched rows with resolved criterion row ids). The grade-path ordering and signatures are already pinned (see PR1).
- **Union-keyed kind map contents** — precisely what each entry holds, and the client-facing vs server-facing split that keeps `server-only` adapters out of client bundles.
- **Test-seam migration order** — which existing tests move/replace vs stay, sequenced per kind.

Previously open, now settled (recorded in the investigation): grade-persistence plumbing (pinned ordering + signatures); CSV export (kind owns the grade-value projection, `export` owns the kind-uniform column shape); error-mapper coupling (acceptance criterion in PR1 — relative refine paths keep zod issue paths unchanged); `getCriterionDetails` shape (move the existing `toCriterionDetails`).

## Checks

Per PR: `pnpm run check --fix`, `pnpm run check-types`, `pnpm run lint:boundaries`, and the targeted unit/integration/Storybook tests matching the changed files. `main` stays green throughout; dependency-cruiser stays at `error` with an empty baseline.

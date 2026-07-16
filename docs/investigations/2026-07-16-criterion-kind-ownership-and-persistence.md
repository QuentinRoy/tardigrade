# Investigation: Localising criterion-kind behavior and persistence

- **Status:** Completed
- **Created:** 2026-07-16
- **Related:** #273, [ADR 0013](../adr/0013-criterion-kind-vertical-modules.md), [ADR 0010](../adr/0010-organize-src-as-enforced-vertical-layers.md)
- **Resolution:** Adopt **Alternative B — criterion-kind vertical modules** (see [ADR 0013](../adr/0013-criterion-kind-vertical-modules.md)). Execution staged in [`plans/2026-07-16-criterion-kind-vertical-modules.md`](../../plans/2026-07-16-criterion-kind-vertical-modules.md).

## Question

Criterion-kind knowledge (Check, Options, Number) is spread across ~20 production files in unrelated-looking modules. Changing one kind's configuration, behavior, or vocabulary requires coordinated edits across domain types, editor state, write commands, persistence mappings, grading, results, import/export contracts, field-error shapes, fixtures, and tests. Some propagation is necessary (a genuine editor, DB, or public-contract change); much is accidental (parallel shapes, duplicated persistence mappings, generic callers reading kind internals).

Which source arrangement gives every criterion kind **meaningful ownership** and concentrates kind knowledge at **deliberate seams**, without weakening import direction, client/server separation, batching, transaction ownership, or explicit public contracts? Two directions were on the table:

- **Alternative A — horizontal capability modules:** extract kind-specific *pure domain* behavior only; keep persistence shared and workflow UI in its current vertical.
- **Alternative B — criterion-kind vertical modules:** each kind gets a stable source folder owning its domain logic, schemas, persistence adapters, leaf UI, tests, and stories; generic orchestration stays above.

## Executive summary

**Adopt Alternative B.** A criterion kind becomes a tier-spanning source module under `src/criteria/{check,options,number}/`, owning everything that is *only* about that kind; generic Criterion files above the kind folders own the discriminated unions, exhaustive dispatch, cross-kind batching, and transaction coordination. The useful metric is **the number of independent interfaces that must understand any criterion kind** — B collapses the genuinely-duplicated ones (criterion-definition subtype persistence, parallel editor/command shapes, grade-record read hydration) into single owners, while leaving the irreducible seams (a union, exhaustive dispatchers, DB/YAML/CSV contracts, one authoring picker) explicit.

B is legal today with **zero new import-direction tooling**: `.dependency-cruiser.js` enforces only layer direction, so a kind folder under shared-domain `criteria` is a downward-importable leaf, and client/server separation is guarded by the existing `import "server-only"` mechanism.

## Current inventory (classified)

Kind knowledge today, by classification (the AC-required inventory):

| Site | Classification |
| --- | --- |
| `criteria/types.ts` — `Criterion` / `CriterionGrade` hand-written unions | domain |
| `criteria/criterion.ts` — `mark*`, `getCriterion{Max,Min}Marks`, `attach*Grade`, generic `markCriterion`/`attachGrade` (with `as` casts) | domain (exhaustive dispatch) |
| `criteria/*GradeControl.tsx` — grade-time leaf UI (single consumer: `grading`) | UI presentation |
| `criteria/getCriterionKindLabel.ts` — union-keyed label map | UI/lexicon |
| `rubric-management/types.ts` — `CriterionEditorValue` hand-written union | **accidental** (parallels the schema) |
| `rubric-management/schemas.ts` — per-kind editor schemas + rubric-level `superRefine` | external contract (editor) + **duplicated invariant** |
| `rubric-management/rubricDefinitionMutations.ts` — per-kind subtype upserts + Options mark reconciliation | persistence |
| `rubric-management/{Check,Options,Number}EditorPaper.tsx`, `CriterionEditorPaper.tsx` (`switch`, hardcoded `CRITERION_KINDS`) | UI presentation + composition |
| `rubric-management/errors.ts` — `RubricCriterionFieldErrors` (kind-blind flat bag) | external contract (editor errors) |
| `imports/schemas.ts` — per-kind YAML decode schemas (defaults, strict keys) | external contract (YAML) + **duplicated invariant** |
| `imports/rubrics/saveRubrics.ts` — per-kind subtype persistence | **accidental** (duplicates rubric-management) |
| `export/rubricsExport.ts` — per-kind YAML encode | external contract (YAML) |
| `export/gradeTargetExport.ts` — per-kind grade-value projection (the CSV column *shape* is kind-uniform) | external contract (CSV) |
| `grade-persistence/gradeMutations.ts` — per-kind grade validation + subtype write + re-inlined bounds invariant | persistence + **duplicated invariant** |
| `rubrics/rubrics.ts` — `toCriterion` per-kind row→`Criterion` read hydration | persistence (read) |
| `grading/grades.ts` + `results/resultsBuilder.ts` — two copies of `toCriterionGrade` flat-record→`CriterionGrade` hydration | **accidental** (duplicated read hydration) |
| `results/resultsBuilder.ts`, `CriterionDetailsTooltip.tsx` — build their own per-kind projection from storage props | **accidental** (reads kind internals) |

The **Number bounds invariant** (`minValue < maxValue`, `minMarks <= maxMarks`) is hand-written **four-plus times**: editor `schemas.ts:107,115`, import `schemas.ts:85,88`, grade-save `gradeMutations.ts:263`, marking `criterion.ts:40`, plus a DB CHECK (CONTEXT.md **Number Criterion Bounds**). This is the sharpest accidental-duplication and drift risk.

## Options considered

### Alternative A — horizontal capability modules

Give each kind a pure domain owner; introduce one shared criterion-definition persistence module that privately groups by kind; keep editor/grading/results leaf UI in their verticals consuming kind-owned operations; keep the `criteria` layout flat.

- **Pros:** minimal structural movement; workflow UI stays colocated with its workflow.
- **Cons:** one kind's complete implementation stays spread across several verticals (domain in `criteria`, editor UI in `rubric-management`, YAML in `export`/`imports`); the deletion test fails — removing a kind leaves knowledge scattered across callers; navigation still requires whole-codebase search.

### Alternative B — criterion-kind vertical modules (chosen)

Each kind is a stable folder beneath shared-domain `criteria` owning its canonical config/grade-content types, defaults/marking/bounds/validation, editor and import schema leaves, both persistence adapters, kind-specific leaf UI, YAML encode/decode, and tests. Generic Criterion files above the folders own the unions, exhaustive dispatch, batching, and transaction coordination.

- **Pros:** deepest modules and best locality; passes the deletion test; uniform folder shape aids navigation and the future-kind path; kind-specific knowledge concentrated behind stable seams.
- **Cons:** more file movement; requires careful separation of kind-owned *leaf* UI from workflow-owned *composition*; makes `criteria` a client-and-server shared-domain module (accepted).

## Comparison against the required scenarios

- **Rename/reshape one property** (the Score→Value motivating case): B — edit inside one kind folder; the YAML decode/encode adapters and `getCriterionDetails` projection absorb the rename so `results`, `export`, and `imports` don't change. A — ripples across verticals.
- **Change one kind-specific invariant:** B — one owner (`criteria/{kind}/`), consumed by both schemas, grade-save, and marking; collapses the four-plus bounds copies.
- **Change one kind's grade representation:** B — per-kind grade content + `attach{Kind}Grade` in the folder; generic `attachGrade` unchanged (its `as` casts remain).
- **Add a leaf UI representation for one kind:** B — new leaf in the kind folder; workflow composition consumes it.
- **Change subtype persistence without changing vocabulary:** B — kind adapter file only; coordinator unchanged.
- **Add a hypothetical fourth kind:** see [Future-kind path](#future-kind-path); explicit central edits, no runtime machinery.
- **Client bundles cannot reach server persistence:** guaranteed by `import "server-only"` (build-time failure), not by folder location.
- **Management and import writes stay batched and transaction-safe:** the coordinator keeps by-kind batching and composes in the caller's transaction (see [Persistence](#persistence-ownership)).
- **No new assertions / `any` / registry / cycles:** none introduced; the only `as` casts are the pre-existing, unavoidable `attachGrade` dispatcher casts.
- **Deletion test:** B keeps a kind's complexity localised; A re-scatters it.

## Decisions

### Placement and layers

Kind folders live at `src/criteria/{check,options,number}/`, inheriting shared-domain constraints (may import only design-system, infra, and intra-shared-domain — never a vertical). This keeps them downward-importable leaves and lets persistence adapters import `#db` legally. `criteria` becomes a **client-and-server** shared-domain module (grade/editor leaf UI + `server-only` persistence in sibling files); accepted.

### Client/server separation

Guarded by the existing `import "server-only"` mechanism: kind persistence files declare `server-only`, kind UI declares `"use client"`, and **shared pure files stay import-clean** (a stated invariant — a pure file gaining a `#db`/server import would poison the client bundle). No bespoke dependency-cruiser rule; `server-only` is a stronger, build-time guard.

### Persistence ownership

**Criterion-definition persistence** decomposes where it is genuinely duplicated: the per-kind **subtype** upserts and the Options mark reconciliation, near-verbatim between `rubric-management/rubricDefinitionMutations.ts` and `imports/rubrics/saveRubrics.ts`. A generic server-only coordinator moves **down to `criteria`** (the only layer both verticals can import) owning criterion row-id resolution, group-by-kind, and dispatch to the kind adapters; each `criteria/{kind}/{kind}Persistence.ts` owns its **batched** subtype upsert (`upsert{Kind}SubtypeRowsInDb`), and Options additionally owns mark reconciliation. The criterion **base-row** insert/update/delete stays in each vertical — the semantics genuinely differ (management: `previousId`/source-id rename in a per-row loop with kind-change delete-recreate; import: batch `onConflict` upsert keyed on `(gridRowId, id)` with plan-driven recreation) and unifying them would force one contract onto two workflows or grow mode flags. Batching stays **by kind**; transaction and cache ownership stay with the vertical's App-Level Wrapper (CONTEXT.md DB Primitive / App-Level Wrapper). Kind adapters are thin (Check/Number ~15 lines); the deletion-test locality justifies the files.

**Grade persistence** also decomposes: a kind's grade validation (Options allowed-labels lookup, Number bounds check — the DB reads are already kind-specific) and its subtype write are kind knowledge, so localising them serves the blast-radius goal directly. Each `criteria/{kind}/` owns its grade subtype write adapter and kind-specific grade validation; `grade-persistence` keeps context resolution, the `kind === grade.kind` guard, the parent `criterionGrade` upsert, `clearOtherSubtypeValues` (inherently cross-kind), and dispatch. The plumbing is pinned: the coordinator owns the ordering — resolve context → kind validate → upsert parent `criterionGrade` → kind subtype write → clear other subtypes — with adapter signatures shaped as validate `(db, criterionRowId, gradeContent)` and write `(db, criterionGradeId, gradeContent)`. Because the coordinator resolves `criterionGradeId` before calling the write adapter, an adapter can never run before the parent row exists.

**Read hydration decomposes symmetrically** — without it the deletion test still fails on the read path. `rubrics/rubrics.ts`'s `toCriterion` stays an exhaustive dispatcher but delegates the per-kind row→config mapping to the kind folders; the duplicated `toCriterionGrade` (in `grading/grades.ts` and `results/resultsBuilder.ts`) collapses into a single kind-aware hydrator in `criteria`.

### Schemas, types, and the invariant

- **Collapse** `CriterionEditorValue` (hand-written union) and `CriterionDefinitionInput` (write command) into **`z.output` of the per-kind editor schema** (CONTEXT.md **Derived Input Type**). Removes the manual editor↔command sync.
- **Keep the import (YAML decode) schema distinct** — it is a legitimately different accepted value (optional-with-defaults fields, `.strict()` unknown-key rejection, no `previousId`). This is the "boundary-specific shape" that must not silently follow in-process type changes.
- **Do not share a cross-boundary schema base.** It re-couples the seam the investigation exists to decouple, the honestly-shared surface is tiny (and even `description` disagrees on empty strings), and `.refine()`/`.transform()` return `ZodEffects` that cannot `.extend()`. Share only **atomic field leaves** (`idSchema`, `nonEmptyString`, …) and a within-boundary base.
- **One per-kind domain invariant** (`criteria/{kind}/`) owns the bounds/selection rules; the editor schema, import schema, grade-save validation, and marking all consume it — collapsing the four-plus scattered copies.

### UI ownership (leaf vs composition)

The rule set by existing practice (grade controls already live in `criteria` despite a single consumer): **criterion-kind UI belongs with the kind by identity, not by ADR 0010 rule 5's consumer count.** ADR 0013 records this as a deliberate, scoped exception to rule 5.

- **Authoring (editing):** move a kind-owned **fields fragment** (`criteria/{kind}/{Kind}EditorFields.tsx`) holding only the kind-specific inputs. `rubric-management` keeps the `CriterionEditorPaper` chrome, the kind→fields dispatcher (an explicit `switch`), and the `RubricCriterionFieldErrors` cluster. The fragment declares a **narrow self-owned error prop** (e.g. `{ marks?: string; falseMarks?: string }`); the vertical's wider flat error type is **structurally assignable** to it, so no type moves and no adapter is written. `RubricCriterionFieldErrors` stays in `rubric-management` (kind-blind, part of the error cluster, unused by imports).
- **Read (displaying):** `results` consumes a kind-owned **semantic projection** — `getCriterionDetails(criterion)` (exhaustive dispatch in `criteria`, delegating to per-kind `describe{Kind}`) returns a neutral discriminated union of display facts. `resultsBuilder` and `CriterionDetailsTooltip` consume it; the kind-switch and storage-prop reads leave `results`. The projection returns facts, **not JSX** — tooltip layout stays in `results`.

### YAML contract seam

**Stable kind-owned adapter, both directions colocated** (not a hard cutover — the format is unchanged). Each `criteria/{kind}/` owns its YAML **decode** (import schema leaf) and **encode** (moved from `rubricsExport.ts`), deliberately decoupled from the in-process `Criterion` type. `export`/`imports` compose them downward. A format change becomes a visible edit to a file named for YAML; changing the in-process representation cannot silently move the format.

### CSV export seam

The CSV column *shape* (`rubric:criterion`, `:marks`, `:total` headers, totals) is kind-uniform and stays owned by `export`. The only kind-aware part is the grade-value projection (`passed`/`selectedLabel`/`value` in `gradeTargetExport.ts`) — that is criterion-kind responsibility and moves to a per-kind `exportGradeValue` in the kind folder, dispatched exhaustively from `criteria`.

### Kind discovery

The hardcoded `CRITERION_KINDS = ["check","options","number"]` array in `rubric-management` collapses into a **static, union-keyed map** owned by `criteria` (`… as const satisfies Record<CriterionKind, …>`). This is DRY-ing the existing `getCriterionKindLabel`/`subtypeTableByKind` pattern — the union stays the authority and the compiler forces every kind present; it is **not** a runtime registry (which is a non-goal). Guardrails: (1) the map must not bundle cross-tier references (no client component + `server-only` adapter in one object) — split client-facing and server-facing maps or hold only pure metadata; (2) labels stay in the lexicon layer (`getCriterionKindLabel`, i18n-ready), not frozen into the structural map.

## Future-kind path

Adding a fourth kind requires explicit, compiler-forced central edits: a new `criteria/{kind}/` folder + a new union member + filling each exhaustive dispatcher (forced by `assertNever` / `satisfies Record`) + DB enum, migration, and subtype tables + the kind-picker map + YAML encode/decode + CSV columns. **No runtime registration, discovery, class hierarchy, or generic repository.** Similar folder shape is an organisational convention, not a plug-and-play contract.

## Remaining kind-aware production loci (justified)

These stay kind-aware by design (the AC-required enumeration): the `Criterion`/`CriterionGrade` unions (the model); the exhaustive dispatchers `markCriterion`, `attachGrade` (+ its unavoidable `as` casts), `getCriterionDetails`, `getCriterion{Max,Min}Marks`, the read hydrators `toCriterion` and the shared grade-record hydrator, and the two persistence coordinators (callers genuinely span all kinds); the DB enum/tables/migrations and YAML/CSV contracts (external, authoritative); the `subtypeTableByKind` maps; the authoring kind-picker; and `getCriterionKindLabel` (vocabulary). Each is a deliberate seam, not accidental spread.

## Rejected approaches

- **Runtime registration / discovery / plug-and-play third-party kinds** — explicit non-goal; kinds are statically known; exhaustiveness must stay compiler-forced.
- **Class hierarchies / runtime Criterion classes** — values stay plain serializable discriminated unions.
- **Generic repository** — persistence stays as explicit DB Primitives with by-kind batching; no abstract data-access layer.
- **Metadata-driven / cross-boundary shared schema base** — re-couples the YAML contract to the editor representation; see [Schemas](#schemas-types-and-the-invariant).
- **Per-criterion (non-batched) persistence** — would regress the by-kind batch; forbidden.

## Testing seams

- Each kind's **domain interface** is the primary pure test seam (both Check answers + bounds/defaults/validation; Options invariants, repeated marks, selected-label validation, reconciliation; Number ranges, direction, interpolation, bounds).
- **Generic dispatch** tested once per kind through the generic interface, not re-tested at both levels.
- **Persistence** tested through an integration DB per kind: batched insert/update, subtype invariants, Options reconciliation, caller-owned transaction composition.
- **YAML contract** tests retained per kind (parse, strict stale-key rejection, defaults, validation, serialization round-trip).
- **Editor/grading interaction** tests retained where user-visible behavior depends on individual kind properties.
- Per-kind **fixture builders** for tests whose subject is unrelated to criterion configuration; explicit DB-row fixtures only where the DB contract itself is under test.

## Open questions

Deferred to design during execution (tracked in the plan):

- Exact definition-path coordinator ↔ kind-adapter signatures (what the coordinator hands each adapter: db handle + batched rows with resolved criterion row ids). The grade-path ordering and signatures are pinned above.
- The exact neutral shape of `getCriterionDetails` — largely settled: `resultsBuilder.ts`'s existing `toCriterionDetails` already serves both `resultsBuilder` and the tooltip; the work is moving it, with per-kind `describe{Kind}` leaves.
- The union-keyed kind map's contents and its client/server split.
- Test-seam migration order — which existing tests move/replace vs stay.

Resolved since first drafted: grade-persistence plumbing (pinned under [Persistence](#persistence-ownership)); CSV columns (see [CSV export seam](#csv-export-seam)); the error mapper (acceptance criterion — per-kind refines moved into kind schemas keep relative paths such as `path: ["maxValue"]`, so the `criteria[i].field` issue paths and `zodErrorToRubricsValidationError` stay unchanged).

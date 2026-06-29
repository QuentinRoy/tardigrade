# Source structure vertical-layers migration

- **Status:** Active
- **Created:** 2026-06-28
- **Origin:** [ADR 0010](../docs/adr/0010-organize-src-as-enforced-vertical-layers.md); [source-structure investigation](../docs/investigations/2026-06-28-source-structure-product-verticals.md)
- **Tracked by:** #201

## Purpose

Execute [ADR 0010](../docs/adr/0010-organize-src-as-enforced-vertical-layers.md): move `src/` to enforced vertical layers (`app → verticals → shared-domain → design-system → infrastructure`), with import direction machine-checked by dependency-cruiser. Every step is **behavior-preserving** — file moves, import rewrites, and lint config only; no product behavior changes, no big-bang rewrite, `main` never red.

The migration is a **2-step** strategy (ADR 0010 Consequences): first land enforcement on the *current* tree with a known-violations baseline, then physically slice verticals one at a time, each co-landing its isolation rule. The order matters because most layer rules can be enforced by *tagging current folders* with their target layer — the tree does not need renaming to start enforcing direction.

Read ADR 0010 for the decision and its rationale; this plan does not restate them. It owns *how* and *in what order*, plus the open decisions a future agent/owner must resolve before specific phase-2 PRs.

## Guidance Consulted

- [ADR 0010](../docs/adr/0010-organize-src-as-enforced-vertical-layers.md) (the decision), [ADR 0006](../docs/adr/0006-prefer-flat-module-structure.md) (superseded), [ADR 0004](../docs/adr/0004-avoid-barrel-files.md) (no barrels — boundaries stay path-based), [ADR 0002](../docs/adr/0002-db-is-infrastructure-features-own-persistence.md) (db is infra), [ADR 0003](../docs/adr/0003-node-subpath-imports-and-ts-extensions.md) (`#*` subpath imports — what dependency-cruiser keys off)
- [source-structure investigation](../docs/investigations/2026-06-28-source-structure-product-verticals.md) (audit + open decisions)
- `CONTEXT.md` (vertical names track **Assessment** / **Assessment Completion**; avoid "grading"/"progress")
- `docs/reference/testing-conventions.md`, `docs/guides/documentation-conventions.md`
- `AGENTS.md` code-style: keep changes narrowly scoped; behavior-preserving moves separate from responsibility splits and product changes

## Target layer model (from ADR 0010)

| Layer | Members (target) | May import |
| --- | --- | --- |
| app | `app/` | verticals, shared-domain, design-system, infra |
| verticals | `assessment-capture`, `assessment-completion`, `rubric-analytics`, `question-management`, `imports`, `export`, `app-shell` | shared-domain, design-system, infra — **not** another vertical's internals |
| shared-domain | `rubrics`, `submissions`, `projects` | design-system, infra |
| design-system | the `ui` presentational primitives + `SaveErrors*` | infra |
| infrastructure (leaf) | `db`, `utils`, `test` | (leaf) |

Current→target folder mapping for tagging (phase 0): `src/assessments` → vertical; `src/questions` → vertical (`question-management`); `src/import` → vertical (`imports`); `src/export` → vertical; `src/ui` → **split per file** (`AppShell*`, `CosmeticSlugReplacement` → app-shell vertical; the rest → design-system); `src/{rubrics,submissions,projects}` → shared-domain; `src/{db,utils,test}` → infra.

## Decisions (settled this session)

Folded into the phases below; the audit behind them is in [the investigation](../docs/investigations/2026-06-28-source-structure-product-verticals.md). Confirmed from the code: the three assessment sub-areas have **no** cross-imports today, so they are independent peer verticals.

1. **`assessments` → three peer verticals**, file assignment:
   - `assessment-capture`: `SubmissionAssessmentClient`, `SubmissionOverviewAssessmentClient`, `RubricGradeList`, `useAssessmentSession`, `saveAssessment`, `assessmentMutations`, `assessments.ts` (reads), `submissionNavigation`, `SubmissionQuickJumpDialog`, `useSubmissionQuickJump`, plus `quickJumpSearch` moved up from `submissions`.
   - `assessment-completion`: `assessmentCompletion`, `loadAssessmentCompletion`, `assessmentSummary`, `AssessmentProgressSummary`, `CompletionProgress`, `GlobalAssessmentSummary`, and the `AssessmentCompletionSummary` type (the remainder of `assessments/types.ts` once `AssessmentRubricValue` leaves in Phase 1).
   - `rubric-analytics`: `RubricAnalyticsTable`, `StudentMatrix`, `loadRubricOverview`, `rubricOverviewBuilder`, `QuestionDetailsTooltip`, `RubricDetailsTooltip`.
2. **Quick-jump** is flat inside `assessment-capture` (not its own vertical); `src/submissions/quickJumpSearch.ts` moves up with it, leaving `submissions` a pure entity leaf.
3. **`assessment-capture` stays flat** — no `submission-question`/`submission-overview` sub-areas.
4. **`imports` nests** into `imports/{assessments,questions,students}/` for per-flow files, with shared infra (`BaseImportForm`, `saveUtils`, `actionUtils`, `schemas`, `importErrors`, `importState`, `constants`, `types`) flat at `imports/` root; `src/import` → `src/imports` rename.
5. **`SaveErrors*` → design-system**, inverting `SaveErrorsDisplay`'s `projectPaths` import to a prop (one-file change; keeps design-system importing infra only). **`CosmeticSlugReplacement` → app-shell**.
6. **Vertical names** are assessment-rooted (`assessment-capture`, `assessment-completion`); settled, changeable.
7. **Carve order**: `ui` → (`design-system` + `app-shell`); then `assessments` → the three verticals; then `import` → `imports`; then confirm `question-management`/`export`.
8. **Intra-layer imports are allowed** except between verticals: `shared-domain → shared-domain` and `design-system → design-system` are fine; `vertical → vertical` is forbidden.

## Still open (resolve at the relevant PR)

- **`imports` → `assessment-capture` write edge.** `saveAssessments.ts` calls `saveAssessmentInDb` (an ADR 0007 primitive in `assessmentMutations.ts`). Every other `import`/`export` → `assessments` edge is type-only and dissolves in Phase 1; this write edge survives. Likely resolution: relocate the `saveAssessmentInDb` primitive to shared-domain so capture's wrapper and imports' bulk-save both reach it downward. Confirm at the assessments/imports carve.
- **`question-management` / `export` internal structure** — flat-default holds; review when slicing.
- **Optional `AssessmentRubricValue` rename** (e.g. `RubricAssessmentValue`) — after Phase 1, cosmetic.

## Implementation phases

### Phase 0 — Tooling + baseline (1 PR, no file moves)

1. Add `dependency-cruiser` as a dev dependency.
2. Add a config (`.dependency-cruiser.cjs`) encoding the target layers via path globs against **current** folders (mapping above), with rules:
   - `no-circular` (cycles) — `severity: error`;
   - layer-direction (no upward imports) for shared-domain and design-system — `severity: error`;
   - vertical→vertical isolation — included now but expected to have current violations (e.g. `src/import` imports `#assessments`), so captured by the baseline;
   - intra-layer imports are allowed: `shared-domain → shared-domain` and `design-system → design-system` are fine — only `vertical → vertical` is forbidden (Decision 8).
3. Generate the known-violations baseline (`depcruise … --output-type baseline > .dependency-cruiser-known-violations.json`) and run with `--ignore-known`, so existing violations don't fail CI but new ones do. Confirm exact baseline flags against the installed version.
4. Wire `depcruise` into `pnpm check` (or a `lint:boundaries` script called by `check`) and CI.
5. **Validation:** `pnpm check` green (baseline absorbs current violations). Commit the baseline file; its shrinking is the migration's progress meter.

### Phase 1 — Burn down structure-independent + layer-direction violations (1 PR, no reorg)

The single known upward edge is the `rubrics → assessments` cycle (`AssessmentRubricValue` imported by `src/rubrics/{rubric.ts,types.ts,RubricGradeRow.tsx}`).

1. Move `AssessmentRubricValue` from `src/assessments/types.ts` **down** into `src/rubrics/types.ts` (ADR 0010 rule 4). Keep the marking/glue (`markRubric`, `attachAssessment`, `AssessedRubric`) in `src/rubrics/rubric.ts` — it now imports the value type locally.
2. Update importers: `src/assessments/*`, `src/export/*`, `src/import/*` import `AssessmentRubricValue` from `#rubrics/types.ts` instead of `#assessments/types.ts`. This removes `export → assessments` entirely and reduces `import → assessments` to the single `saveAssessmentInDb` write edge (see Still open).
3. Re-baseline (it should shrink — the cycle and the three shared-domain→vertical edges disappear). Flip `no-circular` and the shared-domain/design-system layer-direction rules to hard `error` with no remaining known violations for them.
4. **Validation:** `pnpm check`, `pnpm run check-types`, `pnpm test:unit rubric`, plus any assessments/export/import suites touching the moved type. Behavior-preserving (type relocation only).

### Phase 2 — Vertical slicing, one vertical per PR

Carve order from Decision 7. Each PR is one behavior-preserving move: relocate files, rewrite imports, flip that boundary's rule to `error`, shrink the baseline.

- **`src/ui` → `design-system` + `app-shell`**: `AppShell*` + `CosmeticSlugReplacement` → `app-shell`; the primitives (`CodeSnippet`, `MuiNextLink`, `NumberField`, `shiki-setup`) + `SaveErrors*` → `design-system`, inverting `SaveErrorsDisplay`'s `projectPaths` import to a prop (the one non-move change here). Verified: nothing in `ui` imports a vertical.
- **`src/assessments` → three verticals** per the Decision 1 assignment; fold `src/submissions/quickJumpSearch.ts` up into `assessment-capture`. The three have no cross-imports, so they can land in one PR or three.
- **`src/import` → `imports`**: rename + nest into `{assessments,questions,students}` subfolders, shared infra at root; resolve the `saveAssessmentInDb` write edge (Still open) at this PR.
- **`question-management`, `export`** — confirm internal structure (flat-default likely); mostly isolation-rule enablement.

Each PR: simplify pass over moved code (`.agents/skills/simplify/SKILL.md`), then `pnpm run check`, `pnpm run check-types`, and the targeted suites for the touched files (`docs/reference/testing-conventions.md`). When the baseline reaches empty, delete the known-violations file and `--ignore-known` flag.

## Done / undone (handoff state)

**Done (in this branch, uncommitted):** ADR 0010 accepted; ADR 0006 marked superseded; the investigation doc; `docs/index.md` + `AGENTS.md` routing updated; this plan + its `plans/index.md` entry. Branch fast-forwarded to `origin/main` (includes #223 doc-convention normalization, #224 no-`as` Biome plugin, #225). No code or tooling changed yet; `pnpm check` (Biome) is green.

**Undone:** everything in Phases 0–2. Nothing is committed — the doc changes above are staged in the working tree only.

**Next action:** open Phase 0 (add dependency-cruiser + config + baseline) — no decisions block it, fully behavior-preserving. Phases 1 and 2 are now fully specified by [Decisions](#decisions-settled-this-session); the only residual is the `saveAssessmentInDb` write edge in [Still open](#still-open-resolve-at-the-relevant-pr), confirmed at the imports carve. No further owner input is required to begin.

## Out of scope

- Any product behavior change, or any responsibility split / file split beyond moving files between folders (ADR 0010 is structure + enforcement only; internal splits are separate work).
- A monorepo/package boundary or `exports`-based public surfaces (boundaries are path-based; ADR 0004 stands — no barrels).
- The `AssessmentRubricValue` rename (open decision 9) and any terminology changes to existing symbols.
- CONTEXT.md changes (none needed — names align to existing terms).

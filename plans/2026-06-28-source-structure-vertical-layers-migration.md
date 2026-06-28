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

## Open decisions (resolve before the relevant phase-2 PR)

These are **not** decided by ADR 0010. Flag to the owner; do not guess.

1. **`assessment-capture` file-by-file split** — which of `src/assessments`' 40 files go to `assessment-capture` vs `assessment-completion` vs `rubric-analytics` (esp. `RubricGradeList`, `assessmentSummary`, `submissionNavigation`).
2. **Quick-jump placement** — own vertical vs sub-area of `assessment-capture`; and moving `src/submissions/quickJumpSearch.ts` up to wherever quick-jump lands.
3. **`imports` shape** — per-flow subverticals (`imports/{assessments,questions,students}`) vs flat with shared infra at root; and the `src/import` → `src/imports` rename.
4. **Within-vertical nesting** — does `assessment-capture` need `submission-question`/`submission-overview` sub-areas, or stay flat?
5. **`question-management` / `export` internal structure** — left to review, not pre-decided.
6. **Cross-cutting `ui`** — `SaveErrors*` (tentative: design-system) and `CosmeticSlugReplacement` (tentative: app-shell) final homes.
7. **Vertical name `assessment-capture`** — tentative; `grading-session` or another assessment-rooted name is acceptable.
8. **Carve order** — likely `assessments` first (riding #197's grading-client work); confirm sequencing.
9. **`AssessmentRubricValue` rename** (e.g. `RubricAssessmentValue`) — deferred; keep out of behavior-preserving moves.

## Implementation phases

### Phase 0 — Tooling + baseline (1 PR, no file moves)

1. Add `dependency-cruiser` as a dev dependency.
2. Add a config (`.dependency-cruiser.cjs`) encoding the target layers via path globs against **current** folders (mapping above), with rules:
   - `no-circular` (cycles) — `severity: error`;
   - layer-direction (no upward imports) for shared-domain and design-system — `severity: error`;
   - vertical→vertical isolation — included now but expected to have current violations (e.g. `src/import` imports `#assessments`), so captured by the baseline.
3. Generate the known-violations baseline (`depcruise … --output-type baseline > .dependency-cruiser-known-violations.json`) and run with `--ignore-known`, so existing violations don't fail CI but new ones do. Confirm exact baseline flags against the installed version.
4. Wire `depcruise` into `pnpm check` (or a `lint:boundaries` script called by `check`) and CI.
5. **Validation:** `pnpm check` green (baseline absorbs current violations). Commit the baseline file; its shrinking is the migration's progress meter.

### Phase 1 — Burn down structure-independent + layer-direction violations (1 PR, no reorg)

The single known upward edge is the `rubrics → assessments` cycle (`AssessmentRubricValue` imported by `src/rubrics/{rubric.ts,types.ts,RubricGradeRow.tsx}`).

1. Move `AssessmentRubricValue` from `src/assessments/types.ts` **down** into `src/rubrics/types.ts` (ADR 0010 rule 4). Keep the marking/glue (`markRubric`, `attachAssessment`, `AssessedRubric`) in `src/rubrics/rubric.ts` — it now imports the value type locally.
2. Update importers: `src/assessments/*`, `src/export/*`, `src/import/*` import `AssessmentRubricValue` from `#rubrics/types.ts` instead of `#assessments/types.ts`.
3. Re-baseline (it should shrink — the cycle and the three shared-domain→vertical edges disappear). Flip `no-circular` and the shared-domain/design-system layer-direction rules to hard `error` with no remaining known violations for them.
4. **Validation:** `pnpm check`, `pnpm run check-types`, `pnpm test:unit rubric`, plus any assessments/export/import suites touching the moved type. Behavior-preserving (type relocation only).

### Phase 2 — Vertical slicing, one vertical per PR

For each vertical, in the agreed carve order (open decision 8): resolve that vertical's open decisions with the owner, then in one behavior-preserving PR — move files, rewrite imports, add/flip that vertical's isolation rule to `error`, shrink the baseline.

- **`src/ui` split** → `design-system` + `app-shell` (resolves open decision 6).
- **`src/assessments` split** → `assessment-capture` / `assessment-completion` / `rubric-analytics` (open decisions 1, 2, 4, 7); fold `src/submissions/quickJumpSearch.ts` up with quick-jump.
- **`src/import` → `imports`** (rename; open decision 3) — and resolve the current `imports → assessments` coupling (route through shared-domain or an explicit downward dependency, not vertical→vertical).
- **`question-management`, `export`** — confirm names/structure (open decision 5); likely just isolation-rule enablement if already coherent.

Each PR: simplify pass over moved code (`.agents/skills/simplify/SKILL.md`), then `pnpm run check`, `pnpm run check-types`, and the targeted suites for the touched files (`docs/reference/testing-conventions.md`). When the baseline reaches empty, delete the known-violations file and `--ignore-known` flag.

## Done / undone (handoff state)

**Done (in this branch, uncommitted):** ADR 0010 accepted; ADR 0006 marked superseded; the investigation doc; `docs/index.md` + `AGENTS.md` routing updated; this plan + its `plans/index.md` entry. Branch fast-forwarded to `origin/main` (includes #223 doc-convention normalization, #224 no-`as` Biome plugin, #225). No code or tooling changed yet; `pnpm check` (Biome) is green.

**Undone:** everything in Phases 0–2. Nothing is committed — the doc changes above are staged in the working tree only.

**Next action:** open Phase 0 (add dependency-cruiser + config + baseline). It has no open decisions blocking it and is fully behavior-preserving, so it can start immediately. Phase 1 is also unblocked. Phase 2 PRs each need their open decision(s) resolved with the owner first.

## Out of scope

- Any product behavior change, or any responsibility split / file split beyond moving files between folders (ADR 0010 is structure + enforcement only; internal splits are separate work).
- A monorepo/package boundary or `exports`-based public surfaces (boundaries are path-based; ADR 0004 stands — no barrels).
- The `AssessmentRubricValue` rename (open decision 9) and any terminology changes to existing symbols.
- CONTEXT.md changes (none needed — names align to existing terms).

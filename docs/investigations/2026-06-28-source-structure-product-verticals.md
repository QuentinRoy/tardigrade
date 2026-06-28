# Investigation: reassess source structure around product verticals

- **Status:** Completed
- **Created:** 2026-06-28
- **Related:** #201; [ADR 0010](../adr/0010-organize-src-as-enforced-vertical-layers.md); [ADR 0006](../adr/0006-prefer-flat-module-structure.md) (superseded); [ADR 0004](../adr/0004-avoid-barrel-files.md); [ADR 0002](../adr/0002-db-is-infrastructure-features-own-persistence.md); [ADR 0003](../adr/0003-node-subpath-imports-and-ts-extensions.md); [prior source-structure audit](2026-05-25-source-structure-and-tech-debt-audit.md); #115; #197; [The Vertical Codebase](https://tkdodo.eu/blog/the-vertical-codebase)
- **Resolution:** Direction accepted and captured in [ADR 0010](../adr/0010-organize-src-as-enforced-vertical-layers.md) (enforced vertical layers, superseding ADR 0006). The investigation's question is settled; what remains is staged execution, listed under [Remaining decisions](#remaining-decisions).
- **Follow-up:** Author a `plans/` plan (listed in `plans/index.md` while active) to resolve the [Remaining decisions](#remaining-decisions) and carry out the 2-step migration.

## Question

Should `src/` move from ADR 0006's flat-owner model toward a vertical-codebase model, and if so, how — concretely, what verticals, what layering, what import rules, and how to migrate without a big-bang rewrite?

## Framing

The real decision is not "verticals: yes/no" but *how far toward the vertical model to move ADR 0006, and how to reconcile it with ADR 0004 (no barrels)*. The driving constraint is that this codebase is largely edited by agents: ADR 0004 and ADR 0006 are both convention-only ("no lint rule currently enforces this; it is a convention agents and contributors apply by hand"), and those conventions are already breached in code. So the headline is **enforcement**, with vertical structure as the thing enforcement protects.

## Audit snapshot (2026-06-28)

Top-level `src/` file counts (flat / nested):

- `assessments` 40 / 0 — bundles four distinct workflows: grading clients, quick-jump, completion, rubric analytics.
- `import` 35 / 0 — three clean per-flow sub-areas (assessments/questions/students) over shared infra.
- `questions` 33 / 0 — mostly one coherent capability (question management) with a rubric-editor sub-area.
- `ui` 19 / 0 — mixes app-shell, presentational primitives, and cross-cutting providers.
- `rubrics` 12, `export` 10, `db` 8/12 (infra, tool-exempt), `submissions` 7, `test` 8, `projects` 5, `utils` 4.

Concrete boundary findings:

- **Quick-jump is already split across folders**: `quickJumpSearch.ts` in `submissions`, `useSubmissionQuickJump`/`SubmissionQuickJumpDialog` in `assessments`.
- **`rubrics` is not a clean leaf**: `rubric.ts`, `types.ts`, `RubricGradeRow.tsx` import `AssessmentRubricValue` from `#assessments`, while `assessments` imports values from `#rubrics` — a type-assisted **cycle**.
- The marking/glue (`markRubric`, `attachAssessment`, `AssessedRubric`) and the value shape `AssessmentRubricValue` are each consumed by **three verticals** (grading/`assessments`, `export`, `imports`), so they belong below the vertical layer, in shared-domain.
- **Nothing in `src/ui` imports a vertical**; its only cross-feature import is `#projects/projectPaths.ts` (shared-domain). `app-shell` is therefore a peer vertical, not a layer above verticals.
- Coupling: `#rubrics` (22 importers) and `#submissions` (20) are the most-depended-on, should-depend-on-least modules — the signature of a shared layer.
- Import mechanism is Node subpath `#* → src/*` (ADR 0003). Lint is Biome only; `noRestrictedImports` already restricts paths (precedent), but Biome cannot model a layer DAG or detect cycles.

## Accepted direction

Captured in [ADR 0010](../adr/0010-organize-src-as-enforced-vertical-layers.md). Summary:

- Five enforced layers, imports down-only, no cycles: **app → verticals → shared-domain → design-system → infrastructure (leaf)**.
- Verticals: `assessment-capture`, `assessment-completion`, `rubric-analytics`, `question-management`, `imports`, `export`, `app-shell`. shared-domain: `rubrics`, `submissions`, `projects`. design-system: the `ui` presentational primitives + save-error surface. infra: `db`, `utils`, `test`.
- Fix the cycle by moving `AssessmentRubricValue` (and the rubric marking/glue) down into `rubrics`; verticals import them downward.
- Boundaries are **path-based** (no public-entry barrel), so ADR 0004 stands.
- Enforced by **dependency-cruiser** alongside Biome (chosen over Biome-only, which cannot do layers/cycles, and over eslint-plugin-boundaries, which would add the ESLint toolchain).
- Migration is a **2-step**: (1) tag current folders into layers, enable rules report-only, baseline violations, ratchet to `error`; (2) physically slice verticals one at a time, co-landing each isolation rule.

### Options considered (and why rejected)

1. Keep ADR 0006 flat end state — convention-only, already eroded.
2. Split oversized owners into flat siblings, no nesting/tooling — sprawl, no within-capability colocation, still unenforced.
3. Tiered verticals, convention-only — same enforcement gap.
4. Tiered verticals + enforced boundaries — **chosen** (ADR 0010).

## Remaining decisions

Open items deferred to the migration plan; the accepted direction does not yet fix these:

- **File-by-file split of `src/assessments` (40 files)** into `assessment-capture`, `assessment-completion`, `rubric-analytics` — including where `RubricGradeList`, `assessmentSummary`, `submissionNavigation`, and the quick-jump pieces land.
- **Quick-jump placement** — its own vertical, or a sub-area of `assessment-capture`; and moving `submissions/quickJumpSearch.ts` up to wherever quick-jump lands.
- **`imports` internal shape** — per-flow subverticals (`imports/{assessments,questions,students}`) vs a flat `imports` with shared infra at the root.
- **Within-vertical nesting** — whether `assessment-capture` needs `submission-question` / `submission-overview` sub-areas, or stays flat.
- **`question-management` and `export` internal structure** — both are large; whether either warrants sub-areas (e.g. rubric editors) is left to review, not pre-decided.
- **Cross-cutting `ui` placement** — `SaveErrors*` (tentatively design-system) and `CosmeticSlugReplacement` (tentatively app-shell) homes are soft.
- **Vertical name `assessment-capture`** — tentative; `grading-session` or another assessment-rooted name is acceptable if preferred.
- **dependency-cruiser config + measured baseline** — exact layer path globs (including per-file `ui` tagging) and the *real* violation count (only `rubrics → assessments` is known by hand) are step-1 deliverables.
- **Carve order** — which vertical to extract first (likely `assessments`, riding #197's grading-client work) and the PR sequencing.
- **Optional `AssessmentRubricValue` rename** — e.g. `RubricAssessmentValue`; deferred, kept out of behavior-preserving moves.

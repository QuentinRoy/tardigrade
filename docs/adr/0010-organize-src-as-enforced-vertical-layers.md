# Organize `src/` as enforced vertical layers

- **Status:** Accepted
- **Created:** 2026-06-28
- **Supersedes:** [ADR 0006](0006-prefer-flat-module-structure.md)
- **Related:** [ADR 0002](0002-db-is-infrastructure-features-own-persistence.md), [ADR 0003](0003-node-subpath-imports-and-ts-extensions.md), [ADR 0004](0004-avoid-barrel-files.md), [source-structure investigation](../investigations/2026-06-28-source-structure-product-verticals.md), #201

Organize `src/` around product verticals stacked in explicit layers, with import direction enforced by tooling rather than convention. This supersedes ADR 0006's "flat is the intended end state": flatness remains the default *within* a module, but the source tree as a whole is a layered set of verticals, and the layer boundaries are machine-checked.

The layers, top to bottom, with imports pointing downward only and no cycles:

- **app** (`app/`): route composition. Framework-owned; unchanged.
- **verticals** (`src/<vertical>`): coherent product capabilities — `grading`, `grade-completion`, `results`, `rubric-management`, `imports`, `export`, `app-shell`. A vertical owns the UI, client behaviour, server boundaries, reads, mutations, local types, tests, and helpers for its capability. Verticals are peers: none may import another vertical's internals.
- **shared-domain** (`src/{criteria,grade-persistence,grade-targets,grids,rubrics}`): core domain entities and primitives many verticals reference. May import only design-system and infrastructure — never a vertical. `grade-persistence` holds `saveCriterionGrade`, the ADR 0007 write primitive `grading`'s save flow and `imports`' bulk grade import both compose downward — two real consumers, not speculative. `criteria` holds the `GradedCriterion`/`Criterion` types and grade controls, read by `grading`, `results`, `export`, `rubric-management`, and `imports`. `grade-targets` holds the Grade Target read model and label helper, read by `grading`, `export`, `imports`, and `results`. `grids` holds Grid path and error helpers, read across `app/`, `app-shell`, and `grading`. `rubrics` holds the `Rubric`/`RubricsById` read model, read by `grading`, `results`, `export`, `rubric-management`, and `imports` — each promoted per rule 5's multiple-real-consumers bar.
- **design-system** (`src/<presentational primitives>`): reusable, workflow-agnostic UI — `CodeSnippet`, `MuiNextLink`, `NumberField`, the shiki setup, and the save-error surface.
- **infrastructure (leaf)** (`src/{db,utils,test}`): `db` per ADR 0002; runtime helpers and test fixtures.

Vertical names follow the current **Grading** domain language of `CONTEXT.md` — `grading`, `grade-completion`, `results`, `rubric-management` — not the retired Assessment-era names (`assessment-capture`, `assessment-completion`, `rubric-analytics`, `question-management`), and avoid `CONTEXT.md`-discouraged terms such as "progress" or "assessment".

## Why

ADR 0006 made flatness the end state and treated nesting as a near-prohibited last resort. At the project's current size the largest owners (`assessments` ≈ 40 files, `import` ≈ 35, `questions` ≈ 33) have become broad buckets mixing several product workflows that change for different reasons — exactly the heterogeneity TkDodo's [The Vertical Codebase](https://tkdodo.eu/blog/the-vertical-codebase) argues against. Organizing by capability keeps code that changes together in one place.

The decisive driver is enforcement, not shape. ADR 0004 and ADR 0006 both end with "No lint rule currently enforces this; it is a convention agents and contributors apply by hand." Convention-only boundaries are the known failure mode under unsupervised (agent) contribution, and the codebase already shows the breach: `src/rubrics` (a should-be-leaf) imports `AssessmentRubricValue` back from `src/assessments`, forming a type-assisted cycle that no human review caught. Machine-checked layer boundaries turn invariants an agent would otherwise silently violate into a failing check.

## Rules

1. Imports point **down only** across layers; **no cycles**; **no vertical imports another vertical's internals**. Enforced by dependency-cruiser.
2. Within a vertical, stay flat by default (suffix conventions from ADR 0006 still apply). Nest only for stable workflow/domain sub-areas (e.g. a quick-jump sub-area), never for technical categories (`components/`, `hooks/`, `services/`, `repositories/`).
3. No barrels (ADR 0004 stands). A vertical's "public surface" is path-based — its top-level files versus its subfolders — enforced by path globs, **not** a public-entry file. This deliberately avoids reintroducing the auto-import hazard ADR 0004 bans.
4. shared-domain owns cross-vertical domain primitives. The atomic graded value (`GradedCriterion`) lives in `src/criteria`; the criterion-grade write primitive (`saveCriterionGrade`, `SaveCriterionGradeParams`) lives in `src/grade-persistence`; the **Rubric** read model (`Rubric`, `RubricsById`) lives in `src/rubrics`. `grading`, `results`, `export`, `rubric-management`, and `imports` import these downward as needed.
5. Promote code to shared-domain or design-system only on stable identity plus multiple real consumers. No generic `shared`/`utils` horizontal buckets beyond the existing infrastructure leaf.
6. `db` stays infrastructure (ADR 0002); enforcement keys off ADR 0003 subpath imports; Biome keeps its existing rules (`noRestrictedImports`, extension enforcement, no-type-assertion). dependency-cruiser adds only the layer/cycle/isolation rules Biome cannot express.
7. Test files (`*.test.ts(x)`, `*.integration.test.ts(x)`) are exempt from rule 1's vertical-isolation check. Only production code must respect the boundary; a test legitimately exercises more than one vertical to verify an integration scenario (e.g. `imports`' assessment-import integration test builds its fixture via `export`'s CSV writer to test the export → import round-trip). `no-circular` and the shared-domain/design-system direction rules still apply to tests.

## Considered Options

- **Flat end state (ADR 0006, status quo)**: rejected. Convention-only and already eroded; pushes growth onto an ever-widening set of flat siblings.
- **Split oversized owners into flat siblings, no nesting, no tooling**: rejected. Relieves the biggest buckets but yields top-level sprawl, no within-capability colocation, and leaves boundaries unenforced.
- **Tiered verticals, convention-only (no tooling)**: rejected. Better shape but the same enforcement gap; agents need machine checks, which is the whole point here.
- **Tiered verticals with enforced boundaries**: chosen.
- **Mechanism — Biome only**: rejected (cannot model layers or detect cycles). **eslint-plugin-boundaries**: rejected (drags the ESLint toolchain in alongside Biome). **dependency-cruiser**: chosen — folder→layer tagging, cycle detection, a known-violations baseline, and per-rule severity, without adopting ESLint.
- **Migration — big-bang rewrite**: rejected (explicit non-goal). **Pure co-land per move**: viable but leaves the high-value layer/invariant rules late. **Baseline-first 2-step**: chosen.

## Consequences

- Migration is staged and behavior-preserving. **Step 1**: tag current folders (and the individual `src/ui` files) into these layers, enable the layer-direction, no-cycle, and existing-invariant rules in dependency-cruiser **report-only**, baseline current violations, and ratchet to `error`. **Step 2**: physically slice verticals one at a time, co-landing each cross-vertical-isolation rule with its split. `main` never goes red.
- dependency-cruiser becomes a new dev dependency wired into `pnpm check`/CI. Its concrete config and the *measured* baseline are step-1 deliverables; only one upward edge (`rubrics → assessments`) is known by hand today, so the true violation surface must be measured before committing to fix-then-reorg.
- ADR 0006 is superseded; `AGENTS.md` routing and `docs/index.md` are updated to point here.
- `CONTEXT.md` is unchanged: folder names align to existing terms (**Assessment**, **Assessment Completion**) rather than coining new ones.
- Execution is planned in [the migration plan](../../plans/2026-06-28-source-structure-vertical-layers-migration.md), with the structural decisions (the `assessments` three-way split, `imports` nesting, `ui` split, carve order, intra-layer rules) settled there. The migration is complete: all rules are at `error` with an empty baseline.

## Changelog

- 2026-07-15: Vertical and shared-domain folder lists, the naming-rule sentence, and Rule 4's identifiers updated to match the terminology sweep (`assessment-capture`→`grading`, `assessment-completion`→`grade-completion`, `rubric-analytics`→`results`, `question-management`→`rubric-management`, per #263) and the Project→Grid rename. `.dependency-cruiser.js`'s `VERTICALS`/`SHARED_DOMAIN` regexes were updated to match, restoring boundary enforcement for the renamed folders. No structural decision changed; see #278.

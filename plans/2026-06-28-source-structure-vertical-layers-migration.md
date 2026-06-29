# Source structure vertical-layers migration

- **Status:** Completed
- **Created:** 2026-06-28
- **Origin:** [ADR 0010](../docs/adr/0010-organize-src-as-enforced-vertical-layers.md); [source-structure investigation](../docs/investigations/2026-06-28-source-structure-product-verticals.md)
- **Tracked by:** #201

## Purpose

Execute [ADR 0010](../docs/adr/0010-organize-src-as-enforced-vertical-layers.md): move `src/` to enforced vertical layers (`app → verticals → shared-domain → design-system → infrastructure`), with import direction machine-checked by dependency-cruiser. Every step is **behavior-preserving** — file moves, import-specifier rewrites, and lint config only; no product behavior changes, no big-bang rewrite, `main` never red.

The migration is a **2-step** strategy (ADR 0010 Consequences): first land enforcement on the *current* tree with a known-violations baseline, then physically slice verticals one at a time, each shrinking the baseline. Most layer rules can be enforced by *tagging current folders* with their target layer — the tree does not need renaming to start enforcing direction.

Read ADR 0010 for the decision and its rationale; this plan owns *how* and *in what order*.

## Guidance Consulted

- [ADR 0010](../docs/adr/0010-organize-src-as-enforced-vertical-layers.md) (the decision), [ADR 0006](../docs/adr/0006-prefer-flat-module-structure.md) (superseded), [ADR 0004](../docs/adr/0004-avoid-barrel-files.md) (no barrels — boundaries stay path-based), [ADR 0002](../docs/adr/0002-db-is-infrastructure-features-own-persistence.md) (db is infra), [ADR 0003](../docs/adr/0003-node-subpath-imports-and-ts-extensions.md) (`#*` subpath imports — what dependency-cruiser keys off), [ADR 0007](../docs/adr/0007-db-primitives-take-a-handle-wrappers-own-transactions-and-cache.md) (primitive/wrapper shape — relevant to PR4)
- [source-structure investigation](../docs/investigations/2026-06-28-source-structure-product-verticals.md) (audit)
- `CONTEXT.md` (vertical names track **Assessment** / **Assessment Completion**; avoid "grading"/"progress")
- `docs/reference/testing-conventions.md`, `docs/guides/documentation-conventions.md`
- `AGENTS.md` code-style: keep changes narrowly scoped; behavior-preserving moves separate from responsibility splits and product changes

## Target layer model (from ADR 0010)

| Layer | Members (target) | May import |
| --- | --- | --- |
| app | `app/` | verticals, shared-domain, design-system, infra |
| verticals | `assessment-capture`, `assessment-completion`, `rubric-analytics`, `question-management`, `imports`, `export`, `app-shell` | shared-domain, design-system, infra — **not** another vertical's internals |
| shared-domain | `rubrics`, `submissions`, `projects`, `assessment-persistence` (PR4), `questions` (PR5 — split from `question-management`) | design-system, infra, and other shared-domain (intra-layer ok) |
| design-system | `CodeSnippet`, `MuiNextLink`, `NumberField`, `shiki-setup`, `SaveErrors*` | infra only |
| infrastructure (leaf) | `db`, `utils`, `test` | (leaf) |

## Decisions (settled this session)

The audit behind them is in [the investigation](../docs/investigations/2026-06-28-source-structure-product-verticals.md). The investigation listed `AssessmentProgressSummary`, `CompletionProgress`, and `assessmentSummary` (`summarizeRubrics`) under `assessment-completion`, but during PR3 a grep of their actual consumers showed each is used by exactly **one** vertical, and **not** by `assessment-completion`: `AssessmentProgressSummary` and `assessmentSummary` only by `assessment-capture`, `CompletionProgress` only by `rubric-analytics`. They are not shared code — the "cross-vertical" edges were an artifact of mis-assigning single-consumer files to `assessment-completion`. The fix is lateral (each file goes to its sole consumer), not downward into a shared layer. With that correction the three verticals are cross-import-free and no shared layer absorbs single-consumer code.

1. **`assessments` → three peer verticals**, file assignment:
   - `assessment-capture`: `SubmissionAssessmentClient`, `SubmissionOverviewAssessmentClient`, `RubricGradeList`, `useAssessmentSession`, `saveAssessment`, `assessmentMutations`, `assessments.ts` (reads), `submissionNavigation`, `SubmissionQuickJumpDialog`, `useSubmissionQuickJump`, plus `quickJumpSearch` moved up from `submissions`, plus `AssessmentProgressSummary` and `assessmentSummary` (its sole consumers — see note above).
   - `assessment-completion`: `assessmentCompletion`, `loadAssessmentCompletion`, `GlobalAssessmentSummary`, and the `AssessmentCompletionSummary` type (the remainder of `assessments/types.ts` once `AssessmentRubricValue` leaves in PR1).
   - `rubric-analytics`: `RubricAnalyticsTable`, `StudentMatrix`, `loadRubricOverview`, `rubricOverviewBuilder`, `QuestionDetailsTooltip`, `RubricDetailsTooltip`, plus `CompletionProgress` (its sole consumer — see note above).
2. **Quick-jump** is flat inside `assessment-capture` (not its own vertical); `src/submissions/quickJumpSearch.ts` moves up with it, leaving `submissions` a pure entity leaf.
3. **`assessment-capture` stays flat** — no `submission-question`/`submission-overview` sub-areas.
4. **`imports` nests** into `imports/{assessments,questions,students}/` for per-flow files, with shared infra (`BaseImportForm`, `saveUtils`, `actionUtils`, `schemas`, `importErrors`, `importState`, `constants`, `types`) flat at `imports/` root; `src/import` → `src/imports` rename.
5. **`SaveErrors*` → design-system**, inverting `SaveErrorsDisplay`'s `projectPaths` import to a prop (see PR2). **`CosmeticSlugReplacement` → app-shell**.
6. **Vertical names** are assessment-rooted (`assessment-capture`, `assessment-completion`); settled, changeable.
7. **Carve order**: `ui` → (`design-system` + `app-shell`); then `assessments` → the three verticals; then `import` → `imports`; then confirm `question-management`/`export`.
8. **Intra-layer imports are allowed** except between verticals: `shared-domain → shared-domain` and `design-system → design-system` are fine; `vertical → vertical` is forbidden.

## One open design choice (PR4)

The only decision left mid-flight: `imports/saveAssessments.ts` calls `saveAssessmentInDb` (an ADR 0007 write primitive in `assessmentMutations.ts`). Every other `import`/`export` → `assessments` edge is type-only and dissolves in PR1; this write edge survives. **Default resolution (PR4):** extract the `saveAssessmentInDb` primitive into a new shared-domain assessment-persistence module so `assessment-capture`'s wrapper and `imports`' bulk-save both reach it downward. Confirm the exact surface at PR4 (does anything besides the write primitive need to move?) and record the new shared-domain member (a one-line note in ADR 0010, or a new ADR if it reads as a real new boundary). `question-management`/`export` internal structure turned out **not** to be a non-blocking deferral — see PR5, which found and fixed 3 real cross-vertical violations there. An optional later `AssessmentRubricValue` rename remains genuinely deferred (cosmetic).

## Execution: PR sequence

Each PR is behavior-preserving: file moves, import-specifier rewrites, lint config (PR2/PR4 each have exactly one small non-move change, called out). After each PR: simplify pass on moved code (`.agents/skills/simplify/SKILL.md`), run the PR's validation, shrink the baseline. Keep this plan `Status: Active` and its `plans/index.md` entry until PR5.

Repo commands (`package.json`): `pnpm check` (Biome), `pnpm run check-types` (`tsc --noEmit`), `pnpm test:unit [pattern]`, `pnpm test:integration [pattern]`, `pnpm test:storybook`, `pnpm test` (all three projects). No boundaries script exists yet — PR0 adds `lint:boundaries`.

### PR0 — dependency-cruiser + baseline (no file moves)

Add `dependency-cruiser` (dev dep) and `.dependency-cruiser.cjs`. Starting config below (written against dependency-cruiser v16; validate with `pnpm exec depcruise --validate src app` and adjust globs to the installed major version — **this config has not been run, treat it as a reviewed starting point**):

```js
/** @type {import('dependency-cruiser').IConfiguration} */
// All vertical folder names, current AND target, so the rule survives renames.
const VERTICALS =
  "assessments|questions|import|export|ui|" + // current
  "assessment-capture|assessment-completion|rubric-analytics|question-management|imports|app-shell"; // target
const NON_SHARED = `assessments|questions|import|export|ui|assessment-capture|assessment-completion|rubric-analytics|question-management|imports|app-shell`;

module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    {
      name: "shared-domain-no-up",
      comment: "rubrics/submissions/projects import only design-system + infra (+ intra shared-domain)",
      severity: "error",
      from: { path: "^src/(rubrics|submissions|projects)/" },
      to: { path: `^src/(${NON_SHARED})/` },
    },
    {
      name: "design-system-no-up",
      comment: "design-system imports infra only",
      severity: "error",
      from: { path: "^src/(ui|design-system)/(CodeSnippet|MuiNextLink|NumberField|shiki-setup|SaveErrors)" },
      to: { path: `^src/(rubrics|submissions|projects|${NON_SHARED})/`, pathNot: "^src/(ui|design-system)/" },
    },
    {
      name: "no-cross-vertical",
      comment: "a vertical must not import another vertical (self-excluded via $1)",
      severity: "error",
      from: { path: `^src/(${VERTICALS})/` },
      to: { path: `^src/(${VERTICALS})/`, pathNot: "^src/$1/" },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
  },
};
```

**Verify in PR0 (these are the failure modes that make the tool silently useless):**

- **`#*` subpath imports must resolve.** This repo imports via `#feature/...` (package.json `imports`, ADR 0003). Confirm depcruise actually resolves them — run `pnpm exec depcruise src --output-type err-long` and check `src/rubrics/rubric.ts → src/assessments/types.ts` appears as a real edge, not "unresolvable". If it's unresolved, configure `options.enhancedResolveOptions` to honour package `imports`/`tsConfig` paths. An unresolved import is a missed violation.
- **The `$1` back-reference** in `to.pathNot` is what excludes same-vertical imports; confirm the installed version supports it (it has since v5).

Then:

1. Generate the baseline: `pnpm exec depcruise src app --config .dependency-cruiser.cjs --output-type baseline > .dependency-cruiser-known-violations.json`.
2. Add script `"lint:boundaries": "depcruise src app --config .dependency-cruiser.cjs --ignore-known"`; call it from `check` (make `check` run `biome check … && depcruise … --ignore-known`) or add it as a separate CI step next to `pnpm check`.
3. **Done-when:** `pnpm lint:boundaries` exits 0 with the baseline present; the baseline lists at least the `rubrics → assessments` cycle (proof resolution works) and the `import → assessments` edges. **Validate:** `pnpm check`, `pnpm lint:boundaries`. Commit the config + baseline (the baseline shrinking is the migration's progress meter).

### PR1 — fix the rubrics↔assessments cycle (no reorg)

1. Move `AssessmentRubricValue` from `src/assessments/types.ts` into `src/rubrics/types.ts`. `src/rubrics/{rubric.ts,types.ts,RubricGradeRow.tsx}` then import it locally; `src/assessments/types.ts` keeps only `AssessmentCompletionSummary`.
2. Rewrite every importer to `#rubrics/types.ts`. Find them with `grep -rn 'AssessmentRubricValue' src app` — current set: `src/assessments/{assessmentMutations,assessments,RubricGradeList,rubricOverviewBuilder,SubmissionAssessmentClient,SubmissionOverviewAssessmentClient,useAssessmentSession,types}`, `src/export/{submissionExport,submissionExportGrouping}`, `src/import/prepareAssessmentImport`.
3. Regenerate the baseline. It must shrink: the cycle and all `rubrics → assessments` edges disappear; the remaining assessments edges are just `import/saveAssessments.ts → assessmentMutations` plus any current cross-vertical edges.
4. **Done-when:** `no-circular` reports zero; the baseline contains no `rubrics → *` edge. **Validate:** `pnpm check`, `pnpm run check-types`, `pnpm test:unit rubric assessment`, `pnpm test:integration assessment`. (Behavior-preserving — type relocation only.)

### PR2 — carve `src/ui` → `design-system` + `app-shell`

1. `src/app-shell/`: move `AppShell.tsx`, `AppShell.shared.ts`, `AppShellTopBar.tsx`, `AppShellDrawerContent.tsx`, `AppShellNavigationShell.tsx`, `AppShellLoadingShell.tsx`, `CosmeticSlugReplacement.tsx` (+ their `.stories.tsx`/`.test.ts`).
2. `src/design-system/`: move `CodeSnippet.tsx`, `MuiNextLink.tsx`, `NumberField.tsx`, `shiki-setup.ts`, `SaveErrorsProvider.tsx`, `SaveErrorsDisplay.tsx` (+ stories/tests).
3. **One non-move change — invert `SaveErrorsDisplay`'s path dep** so design-system imports infra only: remove the `#projects/projectPaths.ts` import; add a prop `buildErrorHref: (error: SaveError) => string`; render `href={buildErrorHref(error)}`. Its only mount, `app/layout.tsx`, passes `buildErrorHref={(e) => projectAssessmentSubmissionQuestionPath(e.projectId, e.projectSlug, e.submissionId, e.questionId)}` (app layer may import `projectPaths`). Two files touched: the component + `app/layout.tsx`.
4. Rewrite `#ui/...` specifiers → `#app-shell/...` / `#design-system/...` across `app/` + `src/` (`grep -rn 'from "#ui/'`). Delete the empty `src/ui/`. Update depcruise globs from `^src/ui/...` to the two new folders.
5. **Done-when:** no `src/ui/` left; baseline has no `ui/`-rooted entries; `design-system-no-up` is clean at `error`. **Validate:** `pnpm check`, `pnpm run check-types`, `pnpm test` (these folders carry stories — `test:storybook` is included in `test`).

### PR3 — carve `src/assessments` → three verticals

1. Create `src/assessment-capture/`, `src/assessment-completion/`, `src/rubric-analytics/`; move files per Decisions §1 (with each file's `.test.ts`/`.integration.test.ts`/`.stories.tsx`). Move `src/submissions/quickJumpSearch.ts` (+ `.test.ts`) into `assessment-capture`.
2. Split `src/assessments/types.ts`: `AssessmentCompletionSummary` → `assessment-completion/types.ts` (confirm its importers with grep).
3. Rewrite `#assessments/...` and `#submissions/quickJumpSearch` specifiers across `app/` + `src/`. Update depcruise globs to the three names. The three are independent (verified: no cross-imports), so `no-cross-vertical` stays clean among them.
4. **Done-when:** `src/assessments/` gone; `submissions` no longer holds quick-jump (and imports nothing above shared-domain — verify); baseline shrinks. **Validate:** `pnpm check`, `pnpm run check-types`, `pnpm test`.

### PR4 — carve `src/import` → `imports/` + resolve the write edge

1. **The one design choice (see "One open design choice"):** move the `saveAssessmentInDb` primitive out of `assessment-capture/assessmentMutations.ts` into a new shared-domain assessment-persistence module. `assessment-capture`'s `saveAssessment` wrapper and `imports`' bulk-save both import it downward. Preserve wrapper/transaction/cache behavior exactly (ADR 0007). Record the new shared-domain member (one-line note in ADR 0010 or a small new ADR).
2. Rename `src/import` → `src/imports`; nest per-flow files into `imports/{assessments,questions,students}/`, shared infra flat at `imports/` root (Decisions §4). Rewrite `#import/...` → `#imports/...` specifiers across `app/` + `src/`.
3. Flip `no-cross-vertical` for `imports` to clean `error` (the write edge now resolves downward).
4. **Done-when:** no `import → assessments` edge; `src/import` renamed and nested; baseline shrinks. **Validate:** `pnpm check`, `pnpm run check-types`, `pnpm test:integration import`, `pnpm test`.

### PR5 — finalize

`export` needed no internal change. `question-management` did, beyond what was anticipated: confirming it surfaced 3 real pre-existing cross-vertical violations that no earlier PR's file moves touched (`questions`/`rubric-analytics`/`export` reads, plus a backwards `questions -> imports` edge), not just an optional rename. Resolved as part of this PR rather than deferred:

1. Promoted `ImportState`/`initialImportState` (generic action-result shape, misplaced inside `imports`, reused by `questions/state.ts`) to `src/utils/actionState.ts` as `ActionState`/`initialActionState` (infra — domain-agnostic, no `imports` knowledge in its fields).
2. Split `src/questions`: the read model (`Question`, `Grid`, `questions.ts`'s load functions) stayed at `src/questions/` and became shared-domain (3 consumers — `export`, `rubric-analytics`, and `question-management` itself); everything else (editor types, mutations, management UI, actions, schemas, state) moved to a new vertical, `src/question-management/`. This is the rename Decisions originally flagged optional — doing it was the fix, not a side effect.
3. Added a `no-cross-vertical` exemption for test files (`*.test.ts(x)`, `*.integration.test.ts(x)`) in `.dependency-cruiser.js` — the one remaining violation was `imports/assessments/prepareAssessmentImport.integration.test.ts` legitimately building its fixture via `export`'s CSV writer to test the export → import round-trip; this is verification, not a production cross-vertical dependency. Recorded as ADR 0010 rule 7.
4. Verified the baseline reached zero with both fixes (and confirmed each was load-bearing by reverting it in isolation and re-running — 2 and 3 violations resurfaced respectively). Deleted `.dependency-cruiser-known-violations.json` and dropped `--ignore-known` from `lint:boundaries`.
5. Set this plan `Status: Completed` and removed its `plans/index.md` entry. **Done-when:** no baseline file; all rules at `error`; `pnpm check && pnpm run check-types && pnpm test && pnpm run build` green.

## State (handoff)

- **Merged:** ADR 0010 (+ ADR 0006 marked superseded), the investigation, this plan, and the `docs/index.md` / `AGENTS.md` / `plans/index.md` routing updates — [PR #227](https://github.com/QuentinRoy/grading/pull/227).
- **PR0 — Done — [PR #228](https://github.com/QuentinRoy/grading/pull/228):** `dependency-cruiser` + `.dependency-cruiser.js` (ESM, not `.cjs` — this repo is `"type": "module"`) with the four rules, generated baseline (22 known violations), `lint:boundaries` script, and a separate CI step. `options.parser: "tsc"` was required beyond the plan's starting config — the default parser silently drops `import type` edges, which would have hidden most of the real violations including the `rubrics <-> assessments` proof-of-resolution cycle.
- **PR1 — Done — [PR #229](https://github.com/QuentinRoy/grading/pull/229):** moved `AssessmentRubricValue` into `rubrics/types.ts`, rewrote all importers. Baseline shrank from 22 to 15 known violations; `no-circular` and all `rubrics -> *` edges are gone. Built on a fresh branch off `origin/main` (post-#228 merge) rather than continuing on the old PR0 branch.
- **PR2 — Done — [PR #230](https://github.com/QuentinRoy/grading/pull/230):** carved `src/ui` into `src/app-shell/` and `src/design-system/`; inverted `SaveErrorsDisplay`'s `projectPaths` import to a `buildErrorHref` prop. Baseline shrank from 15 to 10 known violations; `design-system-no-up` is clean and no `ui/`-rooted edges remain. Caught at `pnpm run build` time (not by `check`/`check-types`/tests): a Server Component (`app/layout.tsx`, which exports `metadata`) can't pass a function prop into a Client Component — fixed by moving `buildErrorHref` into a `"use client"` wrapper, `src/app-shell/SaveErrorsDisplayContainer.tsx` (app-shell, not `app/` — this repo's `app/` holds only Next.js route files).
- **PR3 — Done — [PR #232](https://github.com/QuentinRoy/grading/pull/232):** carved `src/assessments` into `assessment-capture`, `assessment-completion`, `rubric-analytics`. First pass mis-resolved the 3 not-actually-shared files (`AssessmentProgressSummary`, `CompletionProgress`, `assessmentSummary`) by pushing them down into `design-system`/`rubrics`; a follow-up commit corrected this to lateral moves into each file's sole consuming vertical (see updated Decisions §1). Baseline stayed at 10 known violations (no new cross-vertical edges among the three; the only remaining `assessment-capture` edge is the known `import -> assessmentMutations` write dependency PR4 resolves).
- **PR4 — Done — [PR #234](https://github.com/QuentinRoy/grading/pull/234):** carved `src/import` into `src/imports/{assessments,questions,students}` (+ flat shared infra at root); split `importParsers.test.ts` into per-flow test files. Resolved the mid-flight design choice: extracted `saveAssessmentInDb` (+ its types and `assessmentErrors`) into a new shared-domain module, `src/assessment-persistence/assessmentMutations.ts`, recorded in ADR 0010. Baseline shrank from 10 to 9 known violations; `no-cross-vertical` is clean for `imports`.
- **Not started:** PR5 above.
- **Next: PR5** — finalize: confirm `question-management`/`export` need no internal change, delete the baseline file once empty, mark this plan `Completed`.

## Out of scope

- Any product behaviour change, or any responsibility/file split beyond moving files between folders and the two named non-move changes (the `SaveErrorsDisplay` prop inversion in PR2, the `saveAssessmentInDb` relocation in PR4).
- A monorepo/package boundary or `exports`-based public surfaces (boundaries are path-based; ADR 0004 stands — no barrels).
- The optional `AssessmentRubricValue` rename and any other terminology changes to existing symbols.
- CONTEXT.md changes (none needed — names align to existing terms).

# MUI → Mantine migration

- **Status:** Active
- **Created:** 2026-06-30
- **Origin:** [ADR 0011](../docs/adr/0011-adopt-mantine-constrained-design-system.md)
- **Tracked by:** [#222](https://github.com/QuentinRoy/grading/issues/222)

## Purpose

Execute [ADR 0011](../docs/adr/0011-adopt-mantine-constrained-design-system.md): replace MUI with Mantine v9 plus a small app-owned semantic layer, and remove MUI and Emotion entirely. Read ADR 0011 for the decision and rationale; this plan owns *how* and *in what order*.

Delivered as **one PR to `main`**, but **progressive**: a bottom-up sequence of steps (commits) following the ADR 0010 layer order, with MUI and Mantine **coexisting** until a final cleanup step removes MUI. Every step builds on a green tree (`check`, `check-types`, targeted tests).

Scope is UI-only: no product-logic, data, schema, server-action, or cache changes. The only deliberate behavior changes are the UX swaps ADR 0011 names — grade controls become `SegmentedControl`, and the question/rubric editors gain live `@mantine/form` validation.

## Guidance consulted

- [ADR 0011](../docs/adr/0011-adopt-mantine-constrained-design-system.md) (the decision)
- [ADR 0010](../docs/adr/0010-organize-src-as-enforced-vertical-layers.md) (layer order + dependency-cruiser enforcement — drives step order and component placement), [ADR 0004](../docs/adr/0004-avoid-barrel-files.md) (no barrels)
- `.agents/skills/ui-styling/SKILL.md` (styling precedence + spacing direction — the house rule for every `sx` conversion), `.agents/skills/error-handling-ux/SKILL.md` (field-level errors), `.agents/skills/mantine-combobox`, `.agents/skills/mantine-form`, `.agents/skills/mantine-custom-components`
- `CONTEXT.md` (semantic names apply existing terms: **Submission**, **Assessment** — no new glossary terms)
- `docs/reference/testing-conventions.md`, `AGENTS.md` (Mantine house rules; simplify pass; check commands)

## Decisions (settled this session)

| Topic | Decision |
| --- | --- |
| Visual scope | Redesign + re-platform in the same PR, but as **tasteful Mantine defaults**: minimal theme (accent + density), lean on Mantine's built-in design, no bespoke branding. |
| Color scheme | **Light only.** Dark deferred (Mantine keeps it possible later). |
| Density | **Single global** compact-leaning density via theme defaults (component `size` defaults + tuned `spacing`/`fontSizes`). No runtime toggle. The submission marking view is the density benchmark. |
| Primary color | Mantine built-in **blue/indigo** (exact shade finalized in impl). |
| Icons | **`@tabler/icons-react`**; drop `@mui/icons-material`. |
| Tables | **Mantine `Table`, no TanStack.** Keep dnd-kit for `QuestionTable` reorder; `alpha()` heatmap tints → Mantine color functions. |
| Forms | **Hybrid.** Native `<form action>` + Server Actions stay the submit boundary everywhere; plain Mantine inputs for simple forms; `@mantine/form` only as the client-state engine for the question/rubric editors (live validation = domain invariants), serialized to the hidden payload on submit. |
| Semantic layer | **Curated + glossary-aligned.** New scaffolding in design-system: `AppPage`, `PageHeader`, `Panel`. Elevate+rename: `ScoreInput`, `AssessmentStatus`, `RubricCriterion`, `AssessmentSummary`, `SubmissionSelector`. `PrimaryAction` → a themed Button default (not a component). `AssessmentToolbar` → feature-local until reused. |
| Grade control | MUI `ToggleButtonGroup` → Mantine **`SegmentedControl`**; boolean green/red via Styles API. |
| Quick-jump | `SubmissionQuickJumpDialog` → Mantine `Modal` + `Combobox` (`mantine-combobox` skill). **Not** `@mantine/spotlight` (new package unjustified). |
| Sequencing | Bottom-up by ADR 0010 layer; MUI + Mantine coexist; MUI removed in the final step. |

### Component placement (ADR 0010)

- **design-system** (imports Mantine/infra only): `AppPage`, `PageHeader`, `Panel`, `ScoreInput` (evolved `NumberField`), the migrated link (`MuiNextLink` → a Mantine `Anchor`+Next `Link`), `CodeSnippet`, `SaveErrors*`.
- **shared-domain `src/rubrics`**: `RubricCriterion` (from `RubricGradeRow`), `AssessmentStatus` (from `RubricStatusMarker`), grade controls.
- **verticals (stay put unless rule-5 promotion is met)**: `AssessmentSummary` (from `GlobalAssessmentSummary`/`AssessmentProgressSummary`), `SubmissionSelector` (from `SubmissionQuickJumpDialog`).

## Dependencies

- **Add:** `@mantine/form`, `@tabler/icons-react`; dev: `postcss-preset-mantine`, `postcss-simple-vars`. (`@mantine/core` + `@mantine/hooks` already present.)
- **Remove (final step):** `@mui/material`, `@mui/icons-material`, `@mui/material-nextjs`, `@emotion/react`, `@emotion/styled`.

## Footprint (measured this session)

- 48 files import `@mui/*`; 1 imports `@emotion/react` (`RubricStatusMarker` `keyframes`).
- Two **config files** also reference MUI beyond those 48: `.storybook/preview.tsx` (the MUI decorator) and `vitest.config.ts` (the storybook project's `optimizeDeps.include` pre-bundles 5 `@mui/material/*` subpaths — `Chip`, `CircularProgress`, `Dialog`, `DialogContent`, `DialogTitle` — reached only by the SubmissionQuickJump story). `src/export` has **no** MUI (confirmed).
- `sx={{…}}`: **172 occurrences across 41 files** — the dominant mechanical effort; every one converts to style props / Styles API per `ui-styling`.
- No custom MUI theme exists today (app runs on MUI defaults; only Storybook has an empty `createTheme()`). The theme is greenfield.
- **No hard blockers found** — every MUI component in use has a Mantine equivalent.

## Execution: step sequence

Repo commands (`package.json`): `pnpm run check --fix` (Biome), `pnpm run check-types` (`tsc --noEmit`), `pnpm test:unit [pattern]`, `pnpm test:integration [pattern]`, `pnpm test:storybook`, `pnpm test` (all projects), `pnpm run build`. After each step: simplify pass on changed code (`.agents/skills/simplify/SKILL.md`), then the step's validation, then **a commit for that step** (one commit per numbered step below, following `docs/guides/commit-message-conventions.md`).

### Step 0 — Scaffolding + theme (coexist with MUI)

1. Add the dependencies above.
2. Add `postcss.config.mjs` (ESM, matching repo `"type": "module"` and Next.js's own `.mjs` convention) with `postcss-preset-mantine` + `postcss-simple-vars`.
3. Create the theme in design-system (`src/design-system/theme.ts`): light, `primaryColor` blue/indigo, single compact density via component `defaultProps` + tuned `spacing`/`fontSizes`.
4. `app/layout.tsx`: add `ColorSchemeScript` + `mantineHtmlProps` to `<html>`, wrap children in `MantineProvider theme={theme}`, import `@mantine/core/styles.css`. **Keep** `AppRouterCacheProvider` + MUI mounted (coexistence).
5. `.storybook/preview.tsx`: add a `MantineProvider` decorator + import Mantine styles; **keep** the MUI decorator.
6. `next.config.ts` has **no** MUI-specific config — nothing to drop there. (Optional, unrelated to MUI removal: if dev compile of icon imports is slow, consider `experimental.optimizePackageImports: ['@tabler/icons-react', '@mantine/core']`; verify it takes effect under Turbopack first.)
7. **Done-when:** app and Storybook render with both providers mounted. **Validate:** `pnpm run check --fix`, `pnpm run check-types`, `pnpm run build`.

### Step 1 — design-system primitives + semantic scaffolding

1. New components (+ stories): `AppPage`, `PageHeader`, `Panel`.
2. Migrate existing design-system off MUI: `NumberField` → `ScoreInput` (Mantine `NumberInput`, clamp/step/format); `MuiNextLink` → Mantine `Anchor` + Next `Link`; `CodeSnippet`; `SaveErrorsProvider`/`SaveErrorsDisplay(Container)` (MUI `Alert` → Mantine `Alert`).
3. **Update `.dependency-cruiser.js`**: switch the `design-system-no-up` rule from the filename list to folder-based `^src/design-system/` (excluding `TEST_FILE`), so the new files are covered and the renamed link file doesn't slip through.
4. Migrate each component's `.stories.tsx` + interaction tests in place (Mantine DOM selectors; same assertions).
5. **Done-when:** `src/design-system` imports no `@mui/*`; `pnpm lint:boundaries` clean. **Validate:** `pnpm run check --fix`, `pnpm run check-types`, `pnpm test:storybook`.

### Step 2 — shared-domain: `src/rubrics`

1. Grade controls: `BooleanGradeControl` + `OrdinalGradeControl` → `SegmentedControl` (boolean green/red via Styles API; **preserve existing keyboard shortcuts**); `NumericalGradeControl` → Mantine `NumberInput`/`TextInput` (preserve the Enter-key handling).
2. `RubricGradeRow` → `RubricCriterion`; `RubricStatusMarker` → `AssessmentStatus` (`@emotion/react` `keyframes` → CSS-module `@keyframes`); `RubricGradeList`.
3. Migrate `RubricGradeRow.stories.tsx` and any tests.
4. **Done-when:** `src/rubrics` imports no `@mui/*` or `@emotion/*`; marking controls keyboard-verified. **Validate:** `pnpm run check --fix`, `pnpm run check-types`, `pnpm test:unit rubric`, `pnpm test:storybook`.

### Step 3 — verticals (one commit each)

- **3a `app-shell`:** `AppShell`/`AppShellTopBar`/`AppShellDrawerContent`/`AppShellNavigationShell` → Mantine `AppShell` (header/navbar + `Burger`); MUI `AppBar`/`Drawer`/`Toolbar` gone; `layout.tsx` `Box` placement → Mantine.
- **3b `assessment-capture` (density benchmark):** `SubmissionAssessmentClient`, `SubmissionOverviewAssessmentClient`, `AssessmentProgressSummary`, `RubricGradeList`, and `SubmissionQuickJumpDialog` → `SubmissionSelector` (`Modal` + `Combobox`). **Tune the theme density here** against the real marking view. **Also update `vitest.config.ts`:** remove the 5 `@mui/material/*` entries from the storybook project's `optimizeDeps.include` (they exist only for this story); if the Storybook browser tests then fail with a mid-run Vite reload, add the Mantine modules the migrated story now reaches instead. Keep `immer` and `fuse.js`.
- **3c `assessment-completion` + `rubric-analytics`:** `GlobalAssessmentSummary` → `AssessmentSummary`; `CompletionProgress`; `RubricAnalyticsTable`, `SubmissionMatrix`, `QuestionDetailsTooltip`, `RubricDetailsTooltip` (Mantine `Table`; `alpha()` → Mantine color functions).
- **3d `question-management`:** `QuestionForm` → `@mantine/form` client state with live validation (Ordinal Marks Minimum, Numerical Rubric Bounds) → serialized to the hidden payload; rubric editor papers → `Panel`; `QuestionTable` (Mantine `Table` + dnd-kit retained); `QuestionList`; `DeleteQuestionDialog` → `Modal`; `SelectedQuestionPane`.
- **3e `imports`:** `BaseImportForm` + the three import forms → Mantine inputs (native `<form action>` kept). (`export` has no MUI — confirmed this session.)
- **Done-when (each):** the vertical imports no `@mui/*`; its tests green. **Validate (each):** `pnpm run check --fix`, `pnpm run check-types`, targeted `pnpm test:unit`/`test:integration`/`test:storybook` for the vertical, `pnpm lint:boundaries`.

### Step 4 — `app/` pages

1. Every `app/**/page.tsx` + `app/loading.tsx`: `Container`/`Typography`/`Breadcrumbs` → `AppPage`/`PageHeader`; MUI `Skeleton` → Mantine `Skeleton`.
2. **Done-when:** no `@mui/*` import remains under `app/`. **Validate:** `pnpm run check --fix`, `pnpm run check-types`, `pnpm run build`.

### Step 5 — cleanup (remove MUI + Emotion)

1. Remove `AppRouterCacheProvider` from `app/layout.tsx`; remove the MUI decorator from `.storybook/preview.tsx`; confirm `vitest.config.ts` `optimizeDeps.include` has no `@mui/*` left (handled in Step 3b).
2. Uninstall `@mui/material`, `@mui/icons-material`, `@mui/material-nextjs`, `@emotion/react`, `@emotion/styled`.
3. Guard (repo-wide, not just `src app`): `grep -rE "@mui/|@emotion/" --include="*.ts" --include="*.tsx" . | grep -v node_modules` returns nothing — this also catches `.storybook/preview.tsx` and `vitest.config.ts`.
4. Set this plan `Status: Completed` and remove its `plans/index.md` entry **in this PR**.
5. **Done-when:** no MUI/Emotion in deps or imports; **Validate:** `pnpm run check --fix`, `pnpm run check-types`, `pnpm test`, `pnpm run build`.

## Improvements unlocked (track, don't gold-plate)

- `ScoreInput` on Mantine `NumberInput` — built-in clamp/step/format simplifies the hand-rolled `NumberField`.
- `SubmissionSelector` on `Combobox` — should shrink the 257-line custom quick-jump dialog.
- `@mantine/form` editor validation — live, per-field, matching `CONTEXT.md` invariants (better than serialize-then-server-error).
- Mantine `AppShell` — a real responsive shell instead of hand-rolled `AppBar`/`Drawer`.
- `SegmentedControl` — denser, arrow-key-native marking input.

## Risks / watch-items

- **`sx` conversion volume (172×)** is where agent-style drift is most likely — apply `ui-styling` precedence rigorously; this is the bulk of review.
- **app-shell is a structural rewrite**, not a 1:1 swap (Mantine `AppShell` ≠ `AppBar`+`Drawer`) — highest-risk single step.
- **Interaction tests** assume MUI DOM/roles; selectors must be updated to Mantine without expanding assertions.
- **Server Component + function props**: as in the ADR 0010 migration, provider/prop wiring can pass `check`/`check-types` but fail at `pnpm run build` — build every step.
- **Coexistence**: both providers and both stylesheets load until Step 5 — watch for CSS reset/specificity clashes between MUI `CssBaseline` and Mantine styles; isolate per-component as migrated.

## State (handoff)

- **Step 0 done** (commit on `mantine-switch`): deps added (`@mantine/form`, `@tabler/icons-react`, dev `postcss-preset-mantine` + `postcss-simple-vars`); `postcss.config.mjs` added; `src/design-system/theme.ts` created (`primaryColor: "indigo"`, tuned `spacing`/`fontSizes`); `app/layout.tsx` and `.storybook/preview.tsx` mount Mantine alongside MUI. Validated: `check --fix`, `check-types`, `build`, `test:storybook` all green.
- **Step 1 done** (commit on `mantine-switch`): new `AppPage`, `PageHeader`, `Panel` primitives (+stories); `NumberField`→`ScoreInput` (Mantine `NumberInput`), `MuiNextLink`→`AppLink` (Mantine `Anchor`+Next `Link`), `CodeSnippet` (Mantine `Box` + CSS module for the nested `pre`/`code` styling) migrated off MUI; `src/app-shell/SaveErrorsDisplay.tsx` migrated to Mantine `Alert`/`Stack` (`SaveErrorsProvider` already had no MUI). `.dependency-cruiser.js`'s `design-system-no-up` rule switched to folder-based. Call sites updated: `NumericalRubricEditorPaper`/`BooleanRubricEditorPaper` (rename only, rest of those files is still MUI — Step 3d), the two breadcrumb `app/**/page.tsx` files (`AppLink`, dropped the MUI-only `color="inherit"` — visual polish lands in Step 4). Validated: `check --fix`, `check-types`, `lint:boundaries`, `build`, `test:storybook`, targeted `test:unit rubric`/`question` all green.
- **Branch:** `mantine-switch`. It already carries (from earlier commits) the Mantine skills and the `ui-styling` house rules.
- **Next action:** Step 2 — shared-domain `src/rubrics` (grade controls → `SegmentedControl`; `RubricGradeRow`→`RubricCriterion`; `RubricStatusMarker`→`AssessmentStatus`, dropping the `@emotion/react` `keyframes` for a CSS-module `@keyframes`).
- **Decisions deferred to implementation:** exact indigo-vs-blue shade (Step 0 picked `indigo`; revisit if it reads wrong against the rest of the theme); per-component `defaultProps` density tuning (deferred to the Step 3b benchmark); the SegmentedControl boolean green/red Styles API details; whether `AssessmentProgressSummary` + `GlobalAssessmentSummary` actually unify into one `AssessmentSummary` (only on the rule-5 reuse bar); whether `fuse.js` filtering stays or `Combobox`'s own filter replaces it in `SubmissionSelector`.
- **Review watch-items already folded in:** `vitest.config.ts` `optimizeDeps` (Step 3b) and the repo-wide cleanup guard (Step 5) — both reach beyond the 48 `src`/`app` files.

## Out of scope

- Dark mode; TanStack Table; `@mantine/spotlight`; bespoke branding beyond a tasteful default theme.
- Any product-logic, data, schema, server-action, or cache change.
- `CONTEXT.md` changes (none needed — names align to existing terms).
- Promoting `AssessmentSummary`/`SubmissionSelector` to shared-domain (only on the rule-5 bar).

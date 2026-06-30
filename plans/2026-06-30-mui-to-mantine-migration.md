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
- `sx={{…}}`: **172 occurrences across 41 files** — the dominant mechanical effort; every one converts to style props / Styles API per `ui-styling`.
- No custom MUI theme exists today (app runs on MUI defaults; only Storybook has an empty `createTheme()`). The theme is greenfield.
- **No hard blockers found** — every MUI component in use has a Mantine equivalent.

## Execution: step sequence

Repo commands (`package.json`): `pnpm run check --fix` (Biome), `pnpm run check-types` (`tsc --noEmit`), `pnpm test:unit [pattern]`, `pnpm test:integration [pattern]`, `pnpm test:storybook`, `pnpm test` (all projects), `pnpm run build`. After each step: simplify pass on changed code (`.agents/skills/simplify/SKILL.md`), then the step's validation.

### Step 0 — Scaffolding + theme (coexist with MUI)

1. Add the dependencies above.
2. Add `postcss.config.cjs` (repo is `"type": "module"`, so `.cjs`) with `postcss-preset-mantine` + `postcss-simple-vars`.
3. Create the theme in design-system (`src/design-system/theme.ts`): light, `primaryColor` blue/indigo, single compact density via component `defaultProps` + tuned `spacing`/`fontSizes`.
4. `app/layout.tsx`: add `ColorSchemeScript` + `mantineHtmlProps` to `<html>`, wrap children in `MantineProvider theme={theme}`, import `@mantine/core/styles.css`. **Keep** `AppRouterCacheProvider` + MUI mounted (coexistence).
5. `.storybook/preview.tsx`: add a `MantineProvider` decorator + import Mantine styles; **keep** the MUI decorator.
6. Review `next.config.ts` for MUI-specific config to drop later.
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
- **3b `assessment-capture` (density benchmark):** `SubmissionAssessmentClient`, `SubmissionOverviewAssessmentClient`, `AssessmentProgressSummary`, `RubricGradeList`, and `SubmissionQuickJumpDialog` → `SubmissionSelector` (`Modal` + `Combobox`). **Tune the theme density here** against the real marking view.
- **3c `assessment-completion` + `rubric-analytics`:** `GlobalAssessmentSummary` → `AssessmentSummary`; `CompletionProgress`; `RubricAnalyticsTable`, `SubmissionMatrix`, `QuestionDetailsTooltip`, `RubricDetailsTooltip` (Mantine `Table`; `alpha()` → Mantine color functions).
- **3d `question-management`:** `QuestionForm` → `@mantine/form` client state with live validation (Ordinal Marks Minimum, Numerical Rubric Bounds) → serialized to the hidden payload; rubric editor papers → `Panel`; `QuestionTable` (Mantine `Table` + dnd-kit retained); `QuestionList`; `DeleteQuestionDialog` → `Modal`; `SelectedQuestionPane`.
- **3e `imports`:** `BaseImportForm` + the three import forms → Mantine inputs (native `<form action>` kept). Confirm `export` has no MUI.
- **Done-when (each):** the vertical imports no `@mui/*`; its tests green. **Validate (each):** `pnpm run check --fix`, `pnpm run check-types`, targeted `pnpm test:unit`/`test:integration`/`test:storybook` for the vertical, `pnpm lint:boundaries`.

### Step 4 — `app/` pages

1. Every `app/**/page.tsx` + `app/loading.tsx`: `Container`/`Typography`/`Breadcrumbs` → `AppPage`/`PageHeader`; MUI `Skeleton` → Mantine `Skeleton`.
2. **Done-when:** no `@mui/*` import remains under `app/`. **Validate:** `pnpm run check --fix`, `pnpm run check-types`, `pnpm run build`.

### Step 5 — cleanup (remove MUI + Emotion)

1. Remove `AppRouterCacheProvider` from `app/layout.tsx`; remove the MUI decorator from `.storybook/preview.tsx`; drop any MUI-specific `next.config.ts` settings.
2. Uninstall `@mui/material`, `@mui/icons-material`, `@mui/material-nextjs`, `@emotion/react`, `@emotion/styled`.
3. Guard: `grep -rE "@mui/|@emotion/" src app` returns nothing.
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

## Out of scope

- Dark mode; TanStack Table; `@mantine/spotlight`; bespoke branding beyond a tasteful default theme.
- Any product-logic, data, schema, server-action, or cache change.
- `CONTEXT.md` changes (none needed — names align to existing terms).
- Promoting `AssessmentSummary`/`SubmissionSelector` to shared-domain (only on the rule-5 bar).

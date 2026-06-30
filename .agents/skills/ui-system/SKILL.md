---
name: ui-system
description: UI-system conventions for this repo. Use when adding or changing React/MUI UI beyond a small isolated control, especially pages, forms, tables, score-entry flows, layout hierarchy, reusable components, or component APIs. Use before proposing a new app UI component or adding local MUI styling.
---

# UI system

## Goal

Keep the grading application coherent, dense, keyboard-oriented, and maintainable as multiple contributors and agents change the UI.

The current implementation uses Material UI (MUI). Treat MUI as the primitive layer, not as the product design system.

```text
MUI primitives
      ↓
App theme and semantic components
      ↓
Feature UI
```

Do not introduce Mantine or another replacement library in feature work unless an issue explicitly evaluates or adopts it.

## Before editing

1. Inspect the nearest existing feature UI, the app theme, and relevant design-system components.
2. Reuse the existing component or pattern when it expresses the same product meaning.
3. State briefly which primitives and semantic components the change will use.
4. For a new recurring workflow or product concept, propose an app-owned semantic component instead of duplicating the composition in feature code.

## Layering rules

### Feature UI may compose

- App-owned semantic components.
- MUI layout and structural primitives such as `Box`, `Stack`, `Grid`, `Typography`, `Divider`, `Tooltip`, `Menu`, `Dialog`, and `Snackbar`.
- MUI controls where there is no established app-owned equivalent.

### Feature UI should not own

- New color roles, typography scales, spacing scales, radii, elevations, or breakpoints.
- Arbitrary component variants, ad hoc `sx` recipes, or duplicate card/panel/header patterns.
- Product-wide interaction semantics such as assessment status, score entry, grading progress, student selection, page framing, or primary actions.

Put those decisions in the theme or an app-owned component.

## Theme and styling

- Prefer the MUI theme, component defaults, and design tokens over local styling.
- Follow `.agents/skills/ui-styling/SKILL.md` for spacing, `sx`, and fixed-value decisions.
- Use `sx` for small local layout adjustments. Extract a semantic component or a focused style hook when styling becomes repeated, expressive, or domain-specific.
- Do not create a new `sx` convention, styling wrapper, or utility-class layer alongside the current approach.
- Avoid visual novelty for its own sake. The application is a working tool, not a marketing site.

## Dense marking workflows

Prioritize:

- clear scan hierarchy and compact, stable vertical rhythm;
- keyboard access and a visible focus indicator;
- predictable tab order and focus restoration after dialogs or menus;
- explicit labels and feedback for score changes, errors, saves, and status;
- layouts that remain practical at standard desktop widths.

Do not trade operational density or interaction predictability for decorative whitespace, animation, or bespoke controls.

## Semantic component test

Create or extend an app-owned component when all or most are true:

- the UI represents a stable product concept or recurring workflow;
- multiple features would benefit from a shared API;
- callers should not decide its visual structure or interaction details;
- central changes to styling, accessibility, or behavior should affect all uses.

Examples include `AppPage`, `PageHeader`, `Panel`, `PrimaryAction`, `ScoreInput`, `AssessmentStatus`, `GradeSummary`, `RubricCriterion`, `StudentSelector`, and `AssessmentToolbar`.

Do not extract a component merely to hide a one-off layout fragment.

## Replacement-library readiness

A future MUI replacement will not be a mechanical swap while feature code imports and styles MUI controls directly. Keep the replacement cost bounded by:

- centralizing visual decisions in the theme;
- using app-owned semantic components for domain workflows and repeated framing;
- keeping MUI-specific props and `sx` usage near the primitive layer;
- avoiding app-wide dependence on MUI-only patterns when a semantic API is appropriate.

Do not build premature compatibility wrappers around every MUI primitive. The objective is a thin, valuable semantic boundary, not complete UI-library abstraction.

## Before finishing

Review the change for:

- an existing component or pattern that should have been reused;
- arbitrary visual values that belong in the theme;
- a repeated composition that warrants a semantic component;
- keyboard/focus regressions and unclear error or save feedback;
- accidental visual drift from nearby screens.

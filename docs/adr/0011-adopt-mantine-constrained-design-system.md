# Adopt Mantine with a constrained, app-owned design system

- **Status:** Accepted
- **Created:** 2026-06-30
- **Tracked by:** [#222](https://github.com/QuentinRoy/grading/issues/222)
- **Implemented by:** [the migration plan](../../plans/2026-06-30-mui-to-mantine-migration.md)

Replace MUI with [Mantine](https://mantine.dev) v9 as the base component library, fronted by a small app-owned semantic layer, and remove MUI (and Emotion) entirely. The layering is:

```text
Mantine primitives  →  app theme + semantic components  →  feature UI
```

MUI's component model and visual language are not a good fit for the project's direction, and — because agents contribute UI code — a model that gives every call site arbitrary styling control makes design drift likely. Mantine gives strong, themeable defaults; the thin semantic layer plus house styling rules push contributions toward the system rather than one-off styling.

## What this commits to

- **Mantine for base components, theme, overlays, form controls, layout primitives.** Feature code freely composes low-level primitives (`Stack`, `Group`, `Text`, `Divider`, `Tooltip`, `Menu`, `Modal`).
- **Mantine defaults first.** Use Mantine's light theme and component defaults without app-level density or visual-token tuning for now. Introduce app-owned theme tokens only when a concrete, cross-cutting need emerges; Mantine keeps dark mode possible later.
- **A curated, glossary-aligned semantic layer**, not a speculative full set. Generic page scaffolding (`AppPage`, `PageHeader`, `Panel`) lives in `design-system`; domain components keep `CONTEXT.md` language (`SubmissionSelector`, not "StudentSelector"; `AssessmentSummary`, not "GradeSummary") and stay in their current ADR 0010 layer until the rule-5 promotion bar (stable identity + multiple real consumers) is met.
- **CSS Modules for exceptional styling**, via Mantine's Styles API (`classNames`/`styles`). No Tailwind-first / shadcn-style per-call-site styling as the primary approach. The styling precedence (style props + tokens → Styles API with CSS Modules → ad-hoc inline last) is the `ui-styling` skill's house rule.
- **No enterprise data grid.** The existing tables are presentational; Mantine `Table` covers them. TanStack Table is introduced later only if a real data-grid need (sorting/virtualization/pagination at scale) appears.
- **Tabler icons** (`@tabler/icons-react`) replace `@mui/icons-material`.

## Considered options

- **Keep MUI** — rejected. Its visual language and arbitrary-`sx` styling model are the problem this issue exists to fix; 172 `sx` call sites across 41 files are exactly the drift surface agents would keep widening.
- **Tailwind-first / shadcn-style** — rejected. Maximizes per-call-site styling freedom, which is the opposite of the constraint goal: it makes every feature a place where the design can drift.
- **Mantine + constrained app-owned semantic layer** — chosen. Strong defaults, a themeable token system, and a thin semantic layer give a coherent default look while keeping feature code from re-styling primitives.
- **Speculative full semantic layer (build all ~10 named components up front)** — rejected. Most candidates already exist as one feature-local component; wrapping single-use components is premature abstraction. Build scaffolding + elevate where reuse is real.

## Consequences

- Migration is staged inside a single PR (per [#222](https://github.com/QuentinRoy/grading/issues/222)), bottom-up by ADR 0010 layer, with MUI and Mantine **coexisting** until a final cleanup step removes MUI, Emotion, and `@mui/material-nextjs`. The how and order live in [the migration plan](../../plans/2026-06-30-mui-to-mantine-migration.md).
- Emotion leaves with MUI: the one `@emotion/react` `keyframes` use becomes a CSS-module animation, and the Emotion SSR cache provider (`AppRouterCacheProvider`) is replaced by Mantine's `ColorSchemeScript` + `MantineProvider`.
- The grade-capture controls move from MUI `ToggleButtonGroup` to Mantine `SegmentedControl` (densest, most keyboard-native for marking); the boolean green/red affordance is reproduced via the Styles API.
- `@mantine/form` is adopted only as the client-state engine for the question/rubric editors (live validation matching `CONTEXT.md` invariants), while Server Actions remain the submit boundary everywhere.
- New `design-system` files must be brought under the `design-system-no-up` dependency-cruiser rule (switch it from a filename list to folder-based `^src/design-system/`).
- `CONTEXT.md` is unchanged: the semantic component names apply existing terms (**Submission**, **Assessment**); they are implementation names, not new domain language.

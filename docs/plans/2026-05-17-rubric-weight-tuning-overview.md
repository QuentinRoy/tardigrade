# Rubric Weight Tuning Overview

## Goal
Add a rubric-first overview page that helps identify rubrics students struggle with so rubric weights can be adjusted confidently.

## Final Product Decisions
- Keep original rubric order from the authored assessment structure.
- Do not reorder rubrics by weakest score.
- Use progressive visual signals (color intensity), not binary pass/fail signals.
- Show rubric performance as numeric average in marks format (example: 3.5 / 5).
- Show percent near the average (positioned above or immediately adjacent for fast scan).
- Show completion as a compact Material UI progress bar (completion only, not score).
- Use rubric id as the visible label in the table/list.
- Show rubric details in an anchored popup near the rubric id on hover/focus.
- Keep unassessed state neutral gray.

## Information Architecture
1. Top summary section
- Class-level overview metrics (completion and overall relative score).

2. Primary rubric analytics section (default focus)
- One row per rubric, in original authored order.
- Each row shows:
  - rubric id label,
  - anchored hover details popup,
  - average marks (x / max),
  - average percent,
  - completion bar and completed/total count,
  - progressive color signal tied to relative performance.

3. Secondary student matrix section
- One row per student/submission, one compact cell per rubric.
- Supports drill-down only; not the main signal surface.

## Visual Signal Spec (Chosen)
### Signal model
- Unassessed: gray/neutral.
- Assessed: continuous severity color mapped to average relative score.
- Lower relative score -> stronger visual emphasis.
- Higher relative score -> calmer visual treatment.

### Row content (simple, scannable)
- Percent display (top or top-right in metric block).
- Average marks text: x / max (example: 3.5 / 5).
- Completion progress: Material UI LinearProgress for assessed count vs total.
- Label: rubric id.
- Hover surface: anchored popup near rubric id with rubric details.

### Hover popup spec (clarified)
- Trigger: pointer hover and keyboard focus on rubric id.
- Placement: anchored near rubric id (prefer right side, fallback to below when space is constrained).
- Content fields:
  - rubric label,
  - rubric description,
  - rubric type,
  - rubric properties.
- Type-specific properties examples:
  - boolean: true marks, false marks,
  - ordinal: available labels and marks mapping,
  - numerical: min score, max score, min marks, max marks, reversed.
- Accessibility: popup content must be reachable by keyboard focus (not hover-only).

### Important constraint
- Completion progress and performance score must stay visually distinct.
  - Completion uses progress bar.
  - Performance uses color + numeric score/percent.

## Scope
- Add new route at app/assessments/overview/page.tsx.
- Add a new server-side aggregation module to provide rubric-first overview data.
- Reuse existing rubric scoring utilities and submission/question loaders.
- Add lightweight navigation entry from assessments page.
- Add stories/tests for empty, partial, and fully assessed states.

## Planned Changes
1. Data aggregation
- Build overview data with:
  - rubric rows: average marks, average percent, max marks, assessed count, total count, completion ratio, severity signal input.
  - summary metrics.
  - student matrix data for secondary section.
- Preserve authored question/rubric order in output.

2. Route
- Implement app/assessments/overview/page.tsx as a server page.
- Fetch overview model and render rubric-first UI.

3. UI components
- Add rubric analytics component(s) under src/assessment/.
- Render row model with:
  - rubric id label,
  - anchored popup near rubric id,
  - popup details: label, description, type, properties,
  - percent,
  - x / max,
  - completion bar,
  - progressive color signal.
- Keep student matrix as secondary section.

4. Navigation
- Add an Overview entry point from app/assessments/page.tsx.

5. Validation
- Run pnpm run check --fix.
- Run pnpm run check-types.

## Implementation Detail Addendum (DX + Maintainability)

### Architecture and module boundaries
- Keep data shaping and UI rendering separate.
- Add one dedicated server data module for this page (example: src/db/rubricOverview.ts) that returns a typed overview view model.
- Keep reusable scoring logic in existing rubric utilities; do not duplicate scoring formulas in UI components.
- Keep page route thin: page file should fetch data and compose sections, not own transformation logic.

### Type design
- Introduce explicit view-model types for:
  - rubric analytics row,
  - popup details payload,
  - summary metrics,
  - student matrix row/cell.
- Use discriminated unions for type-specific rubric properties so popup rendering remains type-safe and readable.
- Avoid any and avoid broad casts; prefer narrow helpers that transform DB records into UI-safe types.

### Data flow and clarity
- Use a two-step flow in the overview data module:
  1. normalize raw DB rows into an intermediate map by rubric id,
  2. project normalized data into the final view model in authored order.
- Keep ordering explicit and centralized (question position then rubric position).
- Keep severity computation as a small pure function with clear inputs/outputs.

### Caching and invalidation
- Follow existing caching patterns in db loaders:
  - tag questions, submissions, and assessments consistently,
  - keep cache life explicit,
  - avoid introducing new tags unless needed.
- Keep cache-tag behavior documented inline where non-obvious.

### UI component decomposition
- Prefer small focused components under src/assessment/:
  - RubricOverviewSummary
  - RubricAnalyticsTable (or list)
  - RubricAnalyticsRow
  - RubricDetailsPopup
  - StudentRubricMatrix (secondary section)
- Keep RubricAnalyticsRow presentational; pass precomputed values (percent, x/max, completion ratio, severity token).
- Keep popup content rendering isolated so field changes do not affect row layout logic.

### Accessibility and interaction behavior
- Rubric id trigger must support hover and keyboard focus.
- Popup must be anchored to trigger and have predictable close behavior (blur/escape/mouse leave policy defined in component).
- Ensure keyboard users can reach and read popup content.
- Ensure row metrics remain understandable without color alone.

### Testing strategy
- Unit tests:
  - severity computation,
  - authored-order preservation,
  - average and completion computations,
  - popup property mapping per rubric type.
- Integration tests (DB-backed where useful):
  - mixed rubric types,
  - partial assessments,
  - zero-rubric question edge case,
  - reversed numerical rubric behavior.
- Storybook scenarios:
  - empty dataset,
  - partially assessed dataset,
  - low-performing rubric highlighted,
  - fully assessed dataset,
  - long description popup content.

### DX standards for this change
- Keep filenames and exported symbols aligned to feature language (rubric overview, analytics row, popup details).
- Keep helper functions pure and colocated with the module that owns the transformation.
- Prefer explicit naming over short generic names in aggregation code.
- Add concise comments only where transformation steps are non-obvious.
- Run formatting and type checks before review.

## Acceptance Criteria
- Rubrics appear in original authored order.
- Rubric label shown is id.
- Hovering or focusing rubric id reveals an anchored popup near the id.
- Popup shows rubric label, description, type, and type-specific properties.
- Performance is displayed as both percent and x / max.
- Completion is displayed with Material UI progress bar and count.
- Unassessed state is gray.
- Performance signal is progressive (not binary).
- Weak rubrics are easy to identify without changing list order.

## Out of Scope (First Iteration)
- Inline editing on overview page.
- Export/report generation from overview page.
- Advanced filtering and custom threshold configuration.
- Reordering rubrics based on score.

## Risks and Mitigations
- Risk: users may confuse completion bar with performance.
  - Mitigation: separate placement and labels for completion vs score.
- Risk: progressive color may be ambiguous without numbers.
  - Mitigation: always pair color with percent and x / max text.
- Risk: hover-only details reduce discoverability on touch devices.
  - Mitigation: ensure tooltip/popover has accessible trigger/focus behavior; add fallback affordance if needed in follow-up.

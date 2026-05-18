# Issue #39 - Assessment Navigation Refactor (No Legacy)

## Goal

Fix broken assessment navigation after project-scoped route migration by removing legacy assessment path construction and centralizing active assessment URL generation through canonical route helpers.

## Scope

- Canonicalize assessment route builders in `src/projects/routes.ts`.
- Refactor active assessment navigation usage in:
  - `src/assessment/SubmissionAssessmentClient.tsx`
  - `src/assessment/SubmissionOverviewAssessmentClient.tsx`
  - `src/shared/SaveErrorsDisplay.tsx`
  - `app/projects/[projectId]/[projectSlug]/assessments/page.tsx`
- Thread project context into assessment clients from page-level composition.
- Extend save-error payload with project context for project-scoped recovery links.
- Add focused unit tests for assessment route helper output.

## Explicit Non-Goals

- No compatibility support for legacy top-level `/assessments/...` routes.
- No changes in generated/build outputs (for example `storybook-static`).

## Implementation Plan

1. Add canonical helper functions for submission overview/question assessment paths in `src/projects/routes.ts`.
2. Replace inline/hardcoded assessment links in active app/src code with helper-based links.
3. Update assessment clients and callers to carry `projectId` and `projectSlug`.
4. Update `SaveError` model and `SaveErrorsDisplay` link generation to use project-scoped helper paths.
5. Add unit tests in `src/projects/routes.test.ts` for all relevant assessment helper outputs.

## Verification

1. `pnpm run check --fix`
2. `pnpm run check-types`
3. Targeted unit tests for route helpers (`pnpm run test:unit` with focused selection if needed).
4. Playwright MCP flow validation for:
   - overview lookup navigation
   - question lookup navigation
   - previous/next navigation in overview and question views
   - save-error toast recovery link
5. Route audit:
   - `rg "/assessments/submissions/" app src`

## Acceptance Mapping

- Lookup from overview and question views stays in current project scope.
- Previous/next navigation works without 404.
- Question context is preserved in question-specific navigation.
- Save-error recovery links are project-scoped.
- No stale active navigation path uses top-level legacy `/assessments/...`.

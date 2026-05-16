# Global Navigation Shell

## Goal
Introduce a consistent app-level navigation shell with a top bar and side drawer, then remove page-level back/data/export shortcuts that become redundant.

## Scope
- Add an always-visible top menu bar with a persistent Home link.
- Add a ubiquitous side drawer with links/actions for Assessments, Manage Questions, Import, and Export.
- Remove local Back to home/Back to overview links and Data/Export page buttons.
- Move the Open assessments button to below the global assessment progress card on the home page.

## Plan
1. Create a shared app shell component (top app bar + side drawer) and wire it in root layout.
2. Move import/export/manage/assessments actions into the drawer as navigation items.
3. Update home page to keep summary first and place Open assessments below progress.
4. Remove page-level back-home/back-overview links from questions/import/assessments pages.
5. Run formatting and type checks.

## Verification
1. pnpm run check --fix
2. pnpm run check-types
3. Manual checks:
	- Home link is visible from any page.
	- Drawer is reachable from any page and includes Manage/Import/Export/Assessments links.
	- Questions/import/assessments pages no longer show Back to home buttons.
	- Home page shows Open assessments below assessment progress.

## Risks
- Layout spacing/overflow regressions on small screens due to the new shell container.
- Navigation duplication risk if any old action button is missed.

## Rollback
- Revert shell integration in root layout and restore removed page-level navigation buttons.

## Progress
- [x] Plan drafted
- [x] Plan validated with user
- [x] Shell component added
- [x] Page-level buttons removed
- [x] Formatting/type checks passed
- [ ] Manual navigation verified

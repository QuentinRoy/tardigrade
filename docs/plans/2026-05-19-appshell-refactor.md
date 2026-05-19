# AppShell Refactor — Completed ✅

## Goal
Refactor `src/shared/AppShell.tsx` into smaller reusable pieces so the navigation shell is easier to maintain and the touch drawer behavior has a clear source of truth. Fixes #60 (drawer button unreliable on iPadOS).

## What Was Done

### Component Decomposition
- ✅ Extracted `AppShellTopBar.tsx` — reusable AppBar/Toolbar with centered title and leading action slot
- ✅ Extracted `AppShellNavigationShell.tsx` — interactive shell with drawer state and toggle logic
- ✅ Extracted `AppShellLoadingShell.tsx` — non-interactive Suspense fallback
- ✅ Extracted `AppShellDrawerContent.tsx` — drawer content (navigation zones, export controls)
- ✅ Created `AppShell.shared.ts` — shared utilities (types, constants, route helpers)

### Drawer Interaction Fixes
- ✅ **Toggle button in AppBar** — single button that switches between hamburger (closed) and close (open) icons
- ✅ **Z-index layering** — AppBar at `z-index: drawer + 1` ensures it sits above swipe areas
- ✅ **iOS gesture safety** — `disableSwipeToOpen={iOS}` prevents swipe conflicts with button tap
- ✅ **Accessibility wiring** — proper `aria-expanded`, `aria-controls`, `useId()` relationships

### Toolbar Spacing Consolidation
- ✅ Removed `topSpace` prop coupling
- ✅ `<Toolbar />` spacer in main content area (AppShell.tsx) for fixed AppBar offset
- ✅ `<Toolbar />` spacer inside drawer paper (AppShellNavigationShell.tsx) for drawer top padding

### Test Improvements
- ✅ **Removed duplication** — AppShell stories now light wiring smoke-test; full open+close in AppShellNavigationShell stories
- ✅ **Fixed fragile selectors** — replaced `findByText("Project")` with `findByRole("dialog")`
- ✅ **Working close behavior** — tests now correctly use `queryByRole("dialog")` to validate drawer close with `keepMounted: true`

## Verification
- ✅ 55/55 Storybook tests passing
- ✅ No TypeScript errors
- ✅ Code formatted with Biome
- ✅ PR #62 created and ready for review

## Files Modified
- `src/shared/AppShell.tsx` — simplified to state owner only
- `src/shared/AppShellNavigationShell.tsx` — new interactive shell
- `src/shared/AppShellTopBar.tsx` — new reusable header
- `src/shared/AppShellLoadingShell.tsx` — new loading fallback
- `src/shared/AppShellDrawerContent.tsx` — refactored drawer content
- `src/shared/AppShell.shared.ts` — new shared utilities
- `src/shared/AppShell.stories.tsx` — updated tests
- `src/shared/AppShellNavigationShell.stories.tsx` — new comprehensive tests

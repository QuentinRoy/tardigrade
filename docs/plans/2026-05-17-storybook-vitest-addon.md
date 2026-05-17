# Storybook Vitest Addon Plan

## Goal
Set up the Storybook Vitest addon so Storybook stories can be executed as Vitest component tests in this repo.

## Scope
- Add `@storybook/addon-vitest` to the project.
- Wire the Vitest plugin into the Storybook/Vitest config using the repo's existing `.storybook` folder.
- Keep the current Storybook setup working with the existing Next.js + Webpack aliases.
- Add or update scripts so Storybook tests can be run from the CLI.
- Update the README with the new test command if needed.

## Proposed Steps
1. Inspect the current Storybook and Vitest config surface and choose the smallest compatible integration path.
2. Add the addon dependency and any required test tooling dependencies.
3. Configure Vitest for the Storybook project, including the addon Vitest plugin and browser-mode defaults.
4. Verify Storybook still builds with the existing aliases and decorators.
5. Run type-check and targeted checks, then document the new workflow.

## Validation
- `pnpm check-types`
- `pnpm check --fix`
- `pnpm test` or a narrowed Storybook test command if one is added
- `pnpm storybook:build` if the config changes materially

## Status
- Installed `@storybook/nextjs-vite`, `@storybook/addon-vitest`, and browser-mode support.
- Migrated Storybook config and story imports to the Vite framework.
- Added `pnpm test-storybook` for the Storybook Vitest project.
- Updated the default `pnpm test` command to run both unit and Storybook projects together.
- Removed Storybook auto-start from the Vitest plugin so combined test runs stay headless and do not open a browser window.

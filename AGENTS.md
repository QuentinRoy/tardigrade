# Instructions for Agents

## Repository workflow conventions

- Treat `README.md` as the canonical source for GitHub issue, pull request, label, and repository workflow conventions.
- Before creating or modifying GitHub issues, labels, issue templates, or pull requests, consult the relevant README conventions instead of duplicating taxonomy or checklist rules here.

## Documentation conventions

- Use `docs/investigations/` for audits, comparisons, and open-ended technical exploration.
- Use `docs/adr/` for durable architectural decisions.
- Use `docs/design/` for chosen implementation designs.
- Use `docs/reference/` for durable facts about the current system.
- Use `plans/active/` for temporary execution plans.
- Keep agent instructions short and navigational. Prefer linking to focused docs over copying long guidance here.

## Styling

- Use vertical spacing in one direction only: prefer bottom spacing over top spacing.
  - In Material UI, use `mb` rather than `mt` or `my`, including in `sx` props.
  - When spacing multiple sibling elements, prefer `gap` on the parent container over margins on children.
- Refrain from setting up CSS directly. Prefer using Material UI's theme.

## Code style

- Use Biome for formatting and linting.
- Run repository checks after changes:
  - `pnpm run check --fix`
  - `pnpm run check-types`
- Treat lint and type errors as real issues to resolve rather than obstacles to bypass.
- Do not disable Biome rules, suppress lint errors, or weaken TypeScript checks without first investigating alternatives and consulting the user.
  - Examples: `biome-ignore`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, changing TypeScript strictness, introducing `any`, or weakening types to silence errors.
- Prefer improving types, restructuring code, extracting helpers, or adjusting interfaces before suppressing tooling feedback.
- Do not use React as a namespace. Import functions and types directly from `"react"`.
  - Good: `import { useState, type ReactElement } from "react"`.

- Keep page-level composition in `app/` route files. Avoid `src/` components that are full pages; `src/` components should stay focused and independently reusable/testable.

## Error handling UX

- User-facing error messages must be meaningful and actionable.
- Never surface framework/internal control-flow errors, for example `NEXT_REDIRECT`, to users.
- Every user-visible error should include a clear recovery path, for example "edit the input and retry", "reload and retry", or "contact support if the problem persists".

## Architecture

- For elements that require DOM IDs, such as `aria-controls` / target `id` pairs or form inputs / labels, prefer React `useId()` over hard-coded global IDs to avoid collisions.
- Derived IDs are acceptable when multiple related IDs are needed, for example `${id}-name` and `${id}-email`.
- Do not use `useId()` for React list keys, database IDs, persisted identifiers, or IDs that must remain stable across sessions.
- Always use Context7 when library/API documentation, code generation, setup, or configuration steps are needed.

## Performance

- Avoid successive asynchronous operations that can be run in parallel.
- For example, if data must be fetched from multiple APIs, use `Promise.all` instead of awaiting each request sequentially.

## Database migrations

- Do not rewrite committed migrations. Add a new migration instead.
- The only exception is a migration still being actively developed on a local branch and not yet applied to any shared environment.
- Do not execute schema or data migrations without an explicit reviewed plan.
- For migration conventions, see `docs/reference/database-migrations.md`.

## Env variables and scripting

- The project uses dotenvx to manage environment variables, for example database connection settings.
- Prefer `package.json` scripts over standalone commands. They usually include the required dotenvx setup.
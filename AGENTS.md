# Instructions for Agents

## Styling

- Use vertical spacing in one direction only: prefer bottom spacing over top spacing.
  - In Material UI, use `mb` rather than `mt` or `my` (including in `sx` props).
  - When spacing multiple sibling elements, prefer `gap` on the parent container over margins on children.
- Refrain from setting up css directly. Prefer using Material UI's theme.

## Code Style

- Use biome for code formatting. Run `pnpm run check --fix` to format all files once you've made all your edits.
- Do not use React as a namespace. Import functions and types directly from "react". For example, use `import { useState, type ReactElement } from "react"`.
- Always check typescript types for any code you write: `pnpm run check-types`.
- Avoid `as` when possible. Don't use `any`.
- Keep page-level composition in `app/` route files. Avoid `src/` components that are full pages; `src/` components should stay focused and independently reusable/testable.

## Error Handling UX

- User-facing error messages must be meaningful and actionable.
- Never surface framework/internal control-flow errors (for example `NEXT_REDIRECT`) to users.
- Every user-visible error should include a clear recovery path (for example "edit the input and retry", "reload and retry", or "contact support if the problem persists").

## Architecture

- For elements that require DOM IDs, such as `aria-controls` / target `id` pairs or form inputs / labels, prefer React `useId()` over hard-coded global IDs to avoid collisions. Derived IDs are acceptable when multiple related IDs are needed, for example `${id}-name` and `${id}-email`. However, do **not** use `useId()` for React list keys, database IDs, persisted identifiers, or IDs that must remain stable across sessions.

## Performance

- Avoid successive asynchronous operations that can be run in parallel. For example, if you need to fetch data from multiple APIs, use `Promise.all` to fetch them concurrently instead of awaiting each one sequentially.

## Database Migrations

**Never modify existing migration files.** Migrations are immutable once committed — they represent a historical record of schema changes applied to real databases. Modifying an existing migration would cause a divergence between the recorded history and the actual database state on any environment that has already run it.

The only exception is the migration currently being actively developed and not yet applied to any shared environment (i.e., not yet merged to the main branch and not yet run in staging/production).

To change the database schema, always create a new migration file.

See `src/db/migrations/README.md` for migration conventions and best practices.

## Env variables and scripting

- Project use dotenvx to manage env variables (e.g. for database connection).
- Most of the time, `package.json` scripts should be preferred over standalone scripts. They usually include the dotenvx setup.

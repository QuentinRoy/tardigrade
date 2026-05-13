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

## Performance

- Avoid successive asynchronous operations that can be run in parallel. For example, if you need to fetch data from multiple APIs, use `Promise.all` to fetch them concurrently instead of awaiting each one sequentially.

## Env variables and scripting

- Project use dotenvx to manage env variables (e.g. for database connection).
- Most of the time, `package.json` scripts should be preferred over standalone scripts. They usually include the dotenvx setup.

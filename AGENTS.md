# Instructions for Agents

## Styling

- Use vertical spacing in one direction only: prefer bottom spacing over top spacing.
  - In Material UI, use `mb` rather than `mt` or `my` (including in `sx` props).
  - When spacing multiple sibling elements, prefer `gap` on the parent container over margins on children.

## Code Style

- Use biome for code formatting. Run `pnpm run format --write` to format all files after making changes.

# Instructions for Agents

## Repository workflow conventions

- Treat `docs/guides/issue-and-pr-conventions.md` as the canonical source for GitHub issue, pull request, label, and repository workflow conventions.
- Before creating or modifying GitHub issues, labels, issue templates, or pull requests, consult the documented conventions instead of duplicating taxonomy or checklist rules here.
- Use existing issue and pull request templates in most cases.
- If a template section is not applicable or the information is unknown, state that explicitly. Do not invent information solely to satisfy the template.
- Do not create unsupported relationships between issues, pull requests, milestones, or roadmap items.
- Do not assign milestones, reorganize project boards, or assign priorities unless explicitly requested. It is fine to suggest these actions when relevant.

## Skills

- Load relevant local skills from `.agents/skills/*` when the task touches that domain. Do not load every skill by default.

## Instruction precedence

When guidance conflicts, use this order:

1. User request or issue-specific instructions.
2. `AGENTS.md`.
3. Relevant local skills from `.agents/skills/*`.
4. Accepted ADRs.
5. `docs/design/` and `docs/reference/`.
6. `docs/guides/` and `README.md`.
7. `docs/investigations/`.
8. `plans/active/`.
9. Existing implementation.

Investigations and active plans can guide work, but they do not override higher-priority decisions.

## Documentation conventions

- Use `docs/index.md` as the canonical map for repository documentation.
- Use `docs/investigations/` for audits, comparisons, and open-ended technical exploration.
- Use `docs/adr/` for durable architectural decisions.
- Use `docs/design/` for chosen implementation designs.
- Use `docs/reference/` for durable facts about the current system.
- Use `plans/active/` for temporary execution plans and `plans/completed/` for archived plans. See `docs/index.md` for the canonical doc map.
- Keep agent instructions short and navigational. Prefer linking to focused docs over copying long guidance here.

## Styling

- Use vertical spacing in one direction only: prefer bottom spacing over top spacing.
  - In Material UI, use `mb` rather than `mt` or `my`, including in `sx` props.
  - When spacing multiple sibling elements, prefer `gap` on the parent container over margins on children.

- Prefer Material UI theme mechanisms and design-system tokens over custom styling where practical.

- Prefer Material UI spacing and design tokens over hard-coded pixel values.
  - Prefer `p`, `px`, `py`, `m`, `mb`, `gap`, and `theme.spacing()` instead of arbitrary pixel values.
  - Prefer theme typography, palette, breakpoints, and sizing tokens when available.
  - Avoid exact pixel dimensions unless they represent a real fixed constraint (for example image dimensions, touch targets, canvas sizes, or third-party integration requirements).
  - Avoid arbitrary values such as `marginTop: "13px"` or `width: "237px"` when a theme-derived value would work.

## Code style

- Use Biome for formatting and linting.

- Run repository checks after changes:
  - `pnpm run check --fix`
  - `pnpm run check-types`

- Treat lint and type errors as issues to resolve rather than obstacles to bypass.

- Do not disable Biome rules, suppress lint errors, or weaken TypeScript checks without first investigating alternatives and consulting the user.
  - Examples:
    - `biome-ignore`
    - `@ts-ignore`
    - `@ts-expect-error`
    - changing TypeScript strictness
    - introducing `any`
    - weakening types only to silence errors

- Prefer improving types, restructuring code, extracting helpers, or adjusting interfaces before suppressing tooling feedback.

- Do not use React as a namespace. Import functions and types directly from `"react"`.

- Keep page-level composition in `app/` route files.
- Avoid `src/` components that are full pages; `src/` components should stay focused and independently reusable/testable.

## Error handling UX

- User-facing error messages must be meaningful and actionable.
- Never surface framework/internal control-flow errors, for example `NEXT_REDIRECT`, to users.
- Every user-visible error should include a clear recovery path.

## Architecture

- For elements that require DOM IDs, such as `aria-controls` / target `id` pairs or form inputs / labels, prefer React `useId()` over hard-coded global IDs to avoid collisions.
- Derived IDs are acceptable when multiple related IDs are needed, for example `${id}-name` and `${id}-email`.
- Do not use `useId()` for:
  - React list keys
  - database IDs
  - persisted identifiers
  - IDs that must remain stable across sessions

- Use Context7 when library/API documentation, setup, configuration, or code generation assistance is needed.

## Performance

- Avoid successive asynchronous operations that can run in parallel.
- Prefer `Promise.all()` when multiple independent operations can be executed concurrently.

## Database migrations

- Do not rewrite committed migrations. Add a new migration instead.
- The only exception is a migration still being actively developed on a local branch and not yet applied to any shared environment.
- Do not execute schema or data migrations without an explicit reviewed plan.
- See `docs/reference/database-migrations.md` for migration conventions.

## Environment variables and scripting

- The project uses dotenvx to manage environment variables.
- Prefer `package.json` scripts over standalone commands because they usually include required environment setup.
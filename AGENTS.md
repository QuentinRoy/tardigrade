# Instructions for Agents

## Repository workflow conventions

- Treat `docs/guides/issue-and-pr-conventions.md` as the canonical source for GitHub issue, pull request, label, and repository workflow conventions.
- Before creating or modifying GitHub issues, labels, issue templates, or pull requests, consult the documented conventions instead of duplicating taxonomy or checklist rules here.
- Use `docs/guides/commit-message-conventions.md` for commit titles and squash merge titles. Prefer `<area>: <imperative summary>`; do not invent new commit styles or use full Conventional Commits unless explicitly requested.
- Use existing issue and pull request templates in most cases.
- If a template section is not applicable or the information is unknown, state that explicitly. Do not invent information solely to satisfy the template.
- Do not create unsupported relationships between issues, pull requests, milestones, or roadmap items.
- Do not assign milestones, reorganize project boards, or assign priorities unless explicitly requested. It is fine to suggest these actions when relevant.

## Repository context

- Read `CONTEXT.md` before changing domain terminology, public/API contracts, database boundaries, import/export formats, or code involving project identifiers.
- Treat `CONTEXT.md` as the canonical glossary for repository-wide domain language. Prefer its terms exactly, especially `Project ID` for public identifiers and `Project Row ID` for internal database keys.

## Agent operating protocol

Before editing:

1. Read this file.
2. Use `docs/index.md` to locate task-relevant repository guidance.
3. Read only the focused docs needed for the requested task. Do not load every doc by default.
4. If no focused guidance applies, state that briefly before proceeding.

When planning, explicitly list the repository guidance consulted and the conventions that apply. Keep plans short and task-specific. If the task is small enough to skip a formal plan, still mention any relevant guidance in the final summary.

Before finishing, review the changed files against the consulted guidance. For code changes, run a simplify pass using `.agents/skills/simplify/SKILL.md` on recently modified code only, then run the relevant checks. Mention checks run, checks not run, and any relevant convention intentionally not followed and why.

## Guidance routing

Use this table to find the canonical guidance instead of copying rules into this file:

- Domain terminology, project identifiers, public/API contracts, database boundaries, import/export formats → `CONTEXT.md`.
- Documentation placement and lifecycle → `docs/index.md`.
- GitHub issues, pull requests, labels, templates, and collaboration workflow → `docs/guides/issue-and-pr-conventions.md`.
- Commit titles and squash merge titles → `docs/guides/commit-message-conventions.md`.
- TypeScript public/helper APIs and function parameter design → `docs/guides/typescript-api-design.md`.
- Avoiding barrel/re-export facade files; import from the owning module → `docs/adr/0004-avoid-barrel-files.md`.
- Keeping feature folders and `src/ui` flat; no technical category subfolders → `docs/adr/0006-prefer-flat-module-structure.md`.
- Cache tag helpers, lifetimes, invalidation primitives, and the mutation-to-tag map → `docs/adr/0008-cache-tags-lifetimes-and-invalidation.md`, `src/db/cacheTags.ts`, `src/db/cacheInvalidation.ts`, `docs/reference/cache-invalidation-map.md`.
- Server-side logging (when to log, what not to log, scoped loggers) → `docs/adr/0009-server-side-logging-with-pino.md`, `src/utils/logger.ts`.
- Database migration conventions → `docs/reference/database-migrations.md`.
- Testing conventions and test-command selection → `docs/reference/testing-conventions.md`.
- Accepted architecture decisions → `docs/adr/`.
- Chosen implementation designs → `docs/design/`.
- Open-ended audits, comparisons, and option analysis → `docs/investigations/`.
- Temporary execution plans → `plans/active/`.

## Skills

- Load `.agents/skills/caveman/SKILL.md` at session start and use `lite` mode by default for terse, token-efficient communication.
- Temporarily drop caveman mode when clarity, safety, irreversible actions, or public-facing writing require normal prose.
- Use `.agents/skills/simplify/SKILL.md` after code edits as a focused cleanup pass over recently modified code. Preserve behavior exactly while improving clarity, consistency, naming, control flow, and maintainability.
- Load other local skills from `.agents/skills/*` only when the task touches that domain. Do not load every skill by default.

## Instruction precedence

When guidance conflicts, use this order:

1. User request or issue-specific instructions.
2. `AGENTS.md`.
3. `CONTEXT.md`.
4. Relevant local skills from `.agents/skills/*`.
5. Accepted ADRs.
6. `docs/design/` and `docs/reference/`.
7. `docs/guides/` and `README.md`.
8. `docs/investigations/`.
9. `plans/active/`.
10. Existing implementation.

Investigations and active plans can guide work, but they do not override higher-priority decisions.

## Documentation conventions

- Use `docs/index.md` as the canonical map for repository documentation.
- Use `docs/investigations/` for audits, comparisons, and open-ended technical exploration.
- Use `docs/adr/` for durable architectural decisions.
- Use `docs/design/` for chosen implementation designs.
- Use `docs/reference/` for durable facts about current system behavior, formats, and contracts.
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

- Keep changes narrowly scoped to the requested task. Avoid opportunistic rewrites, broad renames, file moves, or architectural reshaping unless they are necessary for the task or explicitly requested.

- Prefer readable, boring code over clever code:
  - make control flow easy to follow;
  - use names that explain domain intent;
  - keep functions focused and extract helpers only when they improve readability at call sites;
  - avoid unnecessary abstraction, genericity, indirection, wrappers, and compatibility layers;
  - avoid nested ternaries and dense one-liners when explicit control flow is clearer;
  - delete dead code rather than preserving unused paths.

- Prefer clear symbol names over terse abbreviations. Common technical acronyms and established domain terms are fine, for example `id`, `url`, `api`, `ui`, `db`, `props`, `projectId`, and `projectRowId`. Avoid unclear abbreviations such as `opts`, `cfg`, `ctx`, `svc`, `repo`, `res`, `req`, or `val` when `options`, `config`, `context`, `service`, `repository`, `response`, `request`, or `value` would be clearer. Do not rename existing symbols solely to expand abbreviations unless the abbreviation causes confusion or the code is already being changed.

- After implementing a code change, perform a simplify pass using `.agents/skills/simplify/SKILL.md` over recently modified code:
  - preserve functionality exactly;
  - improve clarity, consistency, naming, control flow, and maintainability;
  - remove unnecessary complexity, nesting, duplication, and indirection;
  - keep useful abstractions that improve organization;
  - avoid broad refactors unrelated to the requested task.

- Use repository tooling for formatting, linting, and type checking. After the implementation and simplify pass, always run `pnpm run check --fix` and `pnpm run check-types`; also run the targeted unit, integration, and Storybook tests that match the files changed. Use `docs/reference/testing-conventions.md` for test-command selection.

- In tests, prefer disposable fixtures with `using` or `await using` when setup and teardown should stay together. Consider adding a small disposable fixture when repeated paired setup and teardown would otherwise require hooks. Do not use `using` for resources that must stay alive across multiple `it` cases; use `beforeAll`/`afterAll` instead. See `docs/reference/testing-conventions.md`.

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

- Prefer call-site readability over brevity for TypeScript function parameters. Use named-object parameters for domain actions, mutations, booleans, optional values, multiple same-type values, or exported/reused helpers where positional order is not obvious from variable-based call sites. See `docs/guides/typescript-api-design.md`.

- Avoid using `as` for type assertions. Prefer type guards, generics, `satisfies`, or narrowing to satisfy the compiler. Any use of `as` must be accompanied by a comment explaining why the alternatives would introduce undue complexity.

- Do not use React as a namespace. Import functions and types directly from `"react"`.

- Use JavaScript private fields and methods (for example `#myPrivateField`, `#myMethod()`) instead of TypeScript `private` modifiers. TypeScript `private` is compile-time only and does not enforce privacy at runtime.

- Keep page-level composition in `app/` route files.
- Avoid `src/` components that are full pages; `src/` components should stay focused and independently reusable and testable.

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

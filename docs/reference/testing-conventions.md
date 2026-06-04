# Testing conventions

Status: Current reference

This document records project-specific testing conventions that should remain stable across individual test files.

## Test command selection

After code changes, run repository checks and the targeted tests that match the files changed.

Always run these checks:

- `pnpm run check --fix`
- `pnpm run check-types`

For changed source files, run the focused unit test whose path stem matches the changed file:

```bash
pnpm test:unit <changed-file-stem>
```

Vitest matches by path stem. For example, `src/projects/projectPaths` runs `projectPaths.test.ts`.

For changes under `src/db/`, run:

```bash
pnpm test src/db/
```

`src/db/` tests are not mirrored per source file. Integration tests spin up Docker.

For changed Storybook stories, run:

```bash
pnpm test:storybook <changed-stories-stem>
```

Vitest runs Storybook in headless mode via Playwright, so no separate Storybook server is needed.

## Disposable fixtures

Prefer `using` or `await using` for resources that need setup with matching teardown, such as spies, mocks, temporary databases, projects, or fixtures. This keeps setup and cleanup together at the call site, makes ownership explicit, and ensures cleanup happens when the enclosing scope exits, including on failure.

When a test resource currently requires paired setup and teardown calls, consider introducing a small disposable fixture that implements `Symbol.dispose` or `Symbol.asyncDispose`, especially if the pattern is reused or would otherwise require `beforeEach`/`afterEach`.

Prefer re-declaring a disposable resource inside each `it` over wiring shared mutable state through `beforeEach`/`afterEach` when each test can own its own resource.

Do not use `using` when a single resource must stay alive across multiple `it` cases. A `using` declaration is disposed when its enclosing scope ends, and a `using` declaration in a `describe` body is disposed during test collection, before the tests run. Use `beforeAll`/`afterAll` for shared resources that intentionally span several tests.

See `src/import/saveStudents.integration.test.ts` for `await using` with disposable database/project fixtures, and `src/ui/CosmeticSlugReplacement.stories.tsx` for `using` with a spy.

## User-facing error assertions

When tests cover user-visible errors, prefer plain-language assertions that include a clear recovery step, for example:

- reload and retry
- edit the input and retry
- report the issue if it persists

For critical save flows, keep integration coverage for these messages so regressions are caught when query scoping or validation rules change.

For future i18n support, avoid scattering one-off message strings across unrelated modules. Keep message ownership centralized per feature area so migration to translation keys is straightforward.

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

## End-to-end tier

`e2e/grading-workflow.spec.ts` is a single, narrow Playwright smoke test for the
happy-path grading workflow (create project → import questions/students/assessments
→ dashboard completion → reload → export). It is separate from the Storybook
Vitest browser project and from `test:unit`/`test:integration`: it drives a real
browser against a production `next build` + `next start` server and a real
Postgres, so it is the only tier that exercises browser UI, server actions/routes,
persistence, and production cache invalidation together. Edge cases stay in unit
and integration tests; this tier is not a UI regression suite.

Run it locally with:

```bash
pnpm build
pnpm test:e2e
```

A build must exist first; `playwright.config.ts`'s `webServer` runs `pnpm start`
(no rebuild) and reuses an already-running server locally (`reuseExistingServer`).

The database contract is an empty, migrated Postgres — never a developer's
database. `e2e/globalSetup.ts` uses `TEST_DATABASE_URL` if set (CI's `e2e` job
runs its own service container and migrates it via `globalSetup.ts`; see
`.github/workflows/ci.yml`), otherwise it provisions and tears down an ephemeral
Docker Postgres, the same pattern as `src/test/integrationGlobalSetup.ts`. All
test data is created through the UI; the only fixtures are the import payloads
under `e2e/fixtures/`.

In CI, the `build` job uploads its `.next` output as an artifact; the `e2e` job
downloads it and runs `pnpm test:e2e` against it, so the production build never
runs twice.

Selectors are accessible-first (`getByRole` / `getByLabel`); treat a missing
accessible name as a real accessibility gap to fix on the component, not a reason
to reach for `data-testid`.

## Module aliases in tests

The node test projects (`unit` and `integration`) alias `server-only` to an empty
module (`src/test/serverOnlyStub.ts`), configured in `vitest.config.ts`. `server-only`
is a build-time guard against importing server modules into a client bundle; it has no
purpose under Vitest's node environment, so tests do not need to mock it. Import server
modules directly — do not add `vi.mock("server-only", () => ({}))`.

Other test doubles (for example `next/cache`) stay explicit per file, so each test
states the runtime behavior it is standing in for. Only neutralize a dependency globally
when, like `server-only`, it has no behavior worth asserting and stubbing it every time is
pure boilerplate.

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

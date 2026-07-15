# Testing conventions

This document records project-specific testing conventions that should remain stable across individual test files.

## Test file placement

- Unit and integration test cases are **co-located** with the module they test,
  next to the source file (for example
  `src/grade-completion/gradeCompletion.test.ts`). The Vitest unit
  project discovers them via the `src/**/*.{test,spec}.{ts,tsx,js,jsx}` and
  `app/**/*.{test,spec}.{ts,tsx}` globs in `vitest.config.ts`.
- Integration test cases use the `<name>.integration.test.ts` suffix and are
  co-located like unit tests. The suffix — not the folder — routes them to the
  Vitest `integration` project, which runs against a real Postgres provisioned
  once in global setup (`src/test/integrationGlobalSetup.ts`).
- Tests may be co-located under `app/` only when they test route-specific files
  such as `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, or route-local
  helpers. Domain logic stays under `src/` in its owning feature folder (ADR
  0002) and is tested there — extracting a helper purely to make it testable is
  not a reason to keep its test under `app/`.
- Shared test tooling — global setup, database helpers, fixture builders — lives
  in `src/test/`. That directory holds tooling, not test cases.
- The end-to-end tier lives in the root `e2e/` directory, not under `src/`. It is
  a separate test tier with its own runner (`@playwright/test`, configured by the
  root `playwright.config.ts`), and the smoke test spans the whole app rather than
  any single module, so it has no module to co-locate with. Keeping it out of
  `src/` also keeps the two runners partitioned by directory: Vitest owns
  `src/**` and `app/**`, Playwright owns `e2e/**`. A `.spec.ts` placed under
  `src/` would be picked up by the Vitest unit project and fail under the wrong
  runner.

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

For a changed integration test (`*.integration.test.ts`), run the focused
integration test whose stem matches it:

```bash
pnpm test:integration <changed-file-stem>
```

Schema, constraint, and migration changes have no single co-located stem to
match. Run the whole `src/db/` integration path instead:

```bash
pnpm test:integration src/db/
```

For changed Storybook stories, run:

```bash
pnpm test:storybook <changed-stories-stem>
```

Vitest runs Storybook in headless mode via Playwright, so no separate Storybook server is needed.

## End-to-end tier

`e2e/grading-workflow.spec.ts` is a single, narrow Playwright smoke test for the
happy-path grading workflow (create grid → import rubrics/students/grades →
overview completion → reload → results → export). It is separate from the Storybook
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
database. `playwright.config.ts` itself never provisions or tears down a
database; it only requires `TEST_DATABASE_URL` to already be set and migrates
it (top-level `await`, not a `globalSetup` file — Playwright starts `webServer`
before running `globalSetup`, which would otherwise let the production server
boot against a developer's real database before the override took effect), then
passes it through `webServer.env`.

`TEST_DATABASE_URL` itself is set by whichever process invokes Playwright:

- In CI, the `e2e` job points it at its own Postgres service container (see
  `.github/workflows/ci.yml`), which outlives the job.
- Locally, `pnpm test:e2e` runs `e2e/runE2e.ts`, which provisions an ephemeral
  Docker Postgres (via its own Docker Compose helper in
  `e2e/ephemeralPostgres.ts`), sets `TEST_DATABASE_URL`, and runs Playwright as a
  child process. The
  ephemeral database is provisioned and torn down in this wrapper — a process
  that outlives `webServer` — rather than inside `playwright.config.ts` or a
  `globalTeardown` file, so the database is only ever torn down *after*
  Playwright has stopped the production server. Tearing it down while the
  server still holds open connections previously made Postgres kill those
  connections out from under the running server, which surfaced as a burst of
  `terminating connection due to administrator command` errors logged by the
  server right as the suite finished — harmless to the (already-passed) test
  run, but noisy. `runE2e.ts` also tears down on `SIGINT`/`SIGTERM`, so an
  interrupted run does not leak the container.

All test data is created through the UI; the only fixtures are the import
payloads under `e2e/fixtures/`.

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

See `src/imports/students/saveStudents.integration.test.ts` for `await using` with disposable database/project fixtures, and `src/app-shell/CosmeticSlugReplacement.stories.tsx` for `using` with a spy.

## User-facing error assertions

When tests cover user-visible errors, prefer plain-language assertions that include a clear recovery step, for example:

- reload and retry
- edit the input and retry
- report the issue if it persists

For critical save flows, keep integration coverage for these messages so regressions are caught when query scoping or validation rules change.

For future i18n support, avoid scattering one-off message strings across unrelated modules. Keep message ownership centralized per feature area so migration to translation keys is straightforward.

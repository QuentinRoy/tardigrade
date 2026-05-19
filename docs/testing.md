# Testing Architecture

## Integration Tests

Integration tests use a single database contract in all environments: `TEST_DATABASE_URL`.

### Local workflow

Run:

```bash
pnpm run test:integration
```

This runs `vitest --project=integration` directly. The integration project global setup automatically:

1. starts an isolated Docker Compose Postgres service,
2. waits for the database to be reachable,
3. runs integration tests,
4. tears down containers, networks, and volumes.

This keeps local runs reproducible with near-zero runtime footprint after completion.

### CI workflow

CI runs the same integration suite while providing `TEST_DATABASE_URL` from a Postgres service container.

If you already have a running database for debugging:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres \
pnpm run test:integration
```

When `TEST_DATABASE_URL` is set, global setup skips Docker Compose and uses that database.

## User-Facing Error Assertions

When tests cover user-visible errors, prefer plain-language assertions that include a clear recovery step (for example: reload and retry, edit the input and retry, or report the issue if it persists).

For critical save flows, keep integration coverage for these messages so regressions are caught when query scoping or validation rules change.

For future i18n support, avoid scattering one-off message strings across unrelated modules. Keep message ownership centralized per feature area so migration to translation keys is straightforward.

# Running integration tests

Status: Current guide

Integration tests provision their own Postgres with
[Testcontainers](https://node.testcontainers.org/), the same way locally and in
CI. Docker must be available in both environments.

## Local workflow

Run:

```bash
pnpm run test:integration
```

This runs `vitest --project=integration`. For each test, `createTestDb()` in
`src/test/dbIntegration.ts`:

1. starts a throwaway `postgres:17-alpine` container via Testcontainers,
2. migrates it to the latest schema,
3. hands the test an isolated database, then stops the container when the
   test's scope exits.

Tests run in parallel across workers, and each test is isolated by its own
container. The containers are ephemeral and removed as the tests finish.

## CI workflow

CI runs the exact same path. The `test-integration` job runs on a standard
`ubuntu-latest` runner, and Testcontainers uses that runner's Docker daemon to
start the container — there is no Postgres service container.

## Requirements

Docker must be running. If the Docker daemon is unavailable, integration tests
fail during global setup while Testcontainers tries to start the container.

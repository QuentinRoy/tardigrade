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

This runs `vitest --project=integration`. The integration project's global setup
(`src/test/integrationGlobalSetup.ts`):

1. starts a single throwaway `postgres:17-alpine` container via Testcontainers,
2. builds a migrated template database once,
3. runs the integration tests in parallel — each test clones the template into
   its own database, so the tests stay isolated,
4. drops the template and stops the container when the run finishes.

The container is ephemeral and removed after the run.

## CI workflow

CI runs the exact same path. The `test-integration` job runs on a standard
`ubuntu-latest` runner, and Testcontainers uses that runner's Docker daemon to
start the container — there is no Postgres service container.

## Requirements

Docker must be running. If the Docker daemon is unavailable, integration tests
fail during global setup while Testcontainers tries to start the container.

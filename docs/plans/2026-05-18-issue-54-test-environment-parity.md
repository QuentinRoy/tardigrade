# Issue 54: Integration Test Environment Parity

Status: Implemented
Date: 2026-05-18
GitHub Issue: https://github.com/QuentinRoy/grading/issues/54

## Goal

Unify integration tests on a single external Postgres contract and remove local/CI backend divergence.

## Decisions

- Remove Testcontainers from integration test bootstrap.
- Keep one contract everywhere: integration tests connect through `TEST_DATABASE_URL`.
- Make local runs seamless via automatic Docker Compose lifecycle management.
- Keep CI on GitHub Actions Postgres service, but using the same env contract.

## Scope

1. Simplify integration DB bootstrap to external Postgres only.
2. Add a zero-touch integration test runner that:
   - starts Docker Compose Postgres when `TEST_DATABASE_URL` is not preset,
   - waits until DB is reachable,
   - runs integration tests,
   - always tears down containers and volumes.
3. Align CI config to remove backend-switching env.
4. Update README/testing docs.
5. Remove Testcontainers dependencies.
6. Update reliability hardening tracker changelog.

## Validation

1. `pnpm run test:integration` locally with Docker available and no manual DB setup.
2. `TEST_DATABASE_URL=... pnpm run test:integration` continues to work (CI-style).
3. `pnpm run check --fix`
4. `pnpm run check-types`

## Risks

- Compose lifecycle command must not leak containers/volumes on failure.
- Port selection should avoid conflicts with local services.
- Cleanup must run even when tests fail.

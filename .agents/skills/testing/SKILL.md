---
name: testing
description: Disposable test fixture conventions for this repository - prefer `using`/`await using` for paired setup and teardown. Use whenever writing or reviewing test setup/teardown, spies, mocks, or fixtures. Pairs with docs/reference/testing-conventions.md.
---

# Testing

In tests, prefer disposable fixtures with `using` or `await using` when setup and teardown should stay together. Consider adding a small disposable fixture when repeated paired setup and teardown would otherwise require hooks. Do not use `using` for resources that must stay alive across multiple `it` cases; use `beforeAll`/`afterAll` instead.

See `docs/reference/testing-conventions.md` for the full disposable-fixture guidance, test file placement, and test-command selection.

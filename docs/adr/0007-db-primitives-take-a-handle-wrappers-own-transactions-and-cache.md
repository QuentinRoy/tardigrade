# DB primitives take a required handle; app wrappers own transactions and cache

Status: accepted

A feature's persistence splits into two layers. A **DB Primitive** performs database work only and accepts a required `Kysely<DB>` handle — either the global client or a caller-supplied transaction. An **App-Level Wrapper** owns the global `db`, the transaction boundary, and cache invalidation, delegating the database work to one or more primitives. The wrapper that owns a transaction invalidates cache tags after it commits; a primitive never opens a transaction and never invalidates cache.

## Why

Most read/write functions previously closed over the global `db` from `src/db/kysely.ts`. That made them hard to test (callers had to module-mock `src/db/kysely.ts` — brittle when files or imports move, as in the old `loadQuestionsRead` test seam) and impossible to compose inside a caller-owned transaction without accidentally escaping it. A function that closes over the global `db` cannot participate in a larger transaction, and mixing cache invalidation into persistence means invalidation can run inside an open transaction, which must never happen.

The shipped assessment code already gestured at this with an optional `opts.db` handle, but an optional handle leaves two call shapes alive and lets a caller forget to pass the transaction. A required handle on the primitive removes the ambiguity: the only way to run a primitive is to hand it an executor, and the wrapper is the one place that decides whether that executor is the global client or a transaction.

## Rules

1. A **DB Primitive** takes the executor as its first positional parameter, named `db` and typed `Kysely<DB>`. No custom union: `Transaction<DB>` already extends `Kysely<DB>`, so `Kysely<DB>` accepts both. Because the bare name `db` can read as "only the global client", each primitive carries a short comment noting that `db` may be the global client or a caller-supplied transaction. Domain arguments follow as a named object, per `docs/guides/typescript-api-design.md`; a single obvious argument may stay positional.
2. Primitives are named with a suffix: `…FromDb` for reads, `…InDb` for writes. The bare name is reserved for the **App-Level Wrapper**.
3. A primitive performs database work only — including any reads it needs for validation or key resolution, run on the same handle. It never opens a transaction and never invalidates cache.
4. An **App-Level Wrapper** owns the global `db`, opens the transaction, and invalidates cache. The function that owns a transaction invalidates after the transaction commits — never inside it. Multi-step callers (imports, batch edits) compose primitives inside their own transaction and own the post-commit invalidation themselves.
5. Composition is directional. A wrapper may compose other wrappers and/or primitives (for example to reuse a cached sub-read). A primitive composes only other primitives, threading its handle, and must never call a wrapper — doing so would run the sub-read on the global `db` and escape the caller's transaction. Keep primitives close to leaf.

## Considered Options

- **Keep the optional `opts.db` handle (status quo on the assessment path)** — rejected: an optional handle keeps two call shapes and lets a caller silently skip the transaction; a required handle makes composition explicit.
- **Introduce a `DbClient` / `DbHandle` union type** (`Kysely<DB> | Transaction<DB>`) — rejected as redundant: `Transaction<DB>` already extends `Kysely<DB>`, so the union equals `Kysely<DB>` and reads as a mistake. Kysely's own docs recommend the parent `Kysely<DB>` for parameters that accept either.
- **Invalidate cache at the server-action/route boundary instead of in the transaction owner** — rejected as a second rule: it splits "who invalidates" between wrappers (internal) and orchestrators (delegated). One rule — the transaction owner invalidates after commit — covers both interactive and bulk paths.

## Consequences

- Primitives become directly testable with a test database or transaction, with no `src/db/kysely.ts` module mocking.
- This complements [ADR 0002](./0002-db-is-infrastructure-features-own-persistence.md): primitives and wrappers both live in the owning feature folder; `src/db` stays infrastructure and exposes only the `Kysely<DB>` client and generated types.
- `CONTEXT.md` gains **DB Primitive** and **App-Level Wrapper**.
- Migration is incremental. The questions read/write modules and the assessment write path adopt the pattern first; other modules migrate when nearby code is touched, not in one mechanical pass.

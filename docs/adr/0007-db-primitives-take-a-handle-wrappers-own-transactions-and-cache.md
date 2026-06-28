# DB primitives take a required handle; app wrappers own transactions and cache

- **Status:** Accepted
- **Created:** 2026-06-05

A feature's persistence is split into two layers. A **DB Primitive** performs database work only and accepts a required `Kysely<DB>` handle, either the global client or a caller-supplied transaction. An **App-Level Wrapper** owns the global `db`, the transaction boundary, and cache invalidation, delegating database work to one or more primitives. The wrapper that owns a transaction invalidates cache tags after it commits. A primitive never opens a transaction and never invalidates cache.

## Why

Many read/write functions previously closed over the global `db` from `src/db/kysely.ts`. That made them hard to test: callers had to module-mock `src/db/kysely.ts`, which is brittle when files or imports move, as in the old `loadQuestionsRead` test seam. It also made these functions impossible to compose inside a caller-owned transaction without accidentally escaping it. A function that closes over the global `db` cannot participate in a larger transaction.

Mixing cache invalidation into low-level persistence is also unsafe. Invalidation can run inside an open transaction, which can expose cache state that does not match the committed database state if the transaction later rolls back. Cache invalidation must happen after commit, at the level that owns the transaction.

The shipped assessment code already gestured at this with an optional `options.db` handle. However, an optional handle on a low-level primitive leaves two call shapes alive and lets a caller forget to pass the transaction. A required handle removes that ambiguity: the only way to run a primitive is to hand it an executor. The wrapper is the one place that decides whether that executor is the global client or a transaction.

## Rules

1. A **DB Primitive** takes the executor as its first positional parameter, named `db` and typed `Kysely<DB>`. No custom union is used: `Transaction<DB>` already extends `Kysely<DB>`, so `Kysely<DB>` accepts both. Because the bare name `db` can read as "only the global client", each primitive carries a short comment noting that `db` may be the global client or a caller-supplied transaction.

2. Domain arguments follow the executor. Use a named object for domain arguments, per `.agents/skills/typescript-api-design/SKILL.md`. A single obvious domain argument may stay positional.

3. Primitives are named with a suffix: `...FromDb` for reads and `...InDb` for writes. The bare name is reserved for the **App-Level Wrapper**.

4. A primitive performs database work only. This includes any reads it needs for validation, key resolution, or consistency checks, all run on the same handle. A primitive never opens a transaction and never invalidates cache.

5. Primitives may compose other primitives, threading the same handle through the call chain. A primitive must never call a wrapper, because doing so would run the sub-operation through the wrapper's handle policy and may escape the caller's transaction. Keep primitives close to leaf operations.

6. An **App-Level Wrapper** takes its domain arguments first, either positional or as a named object per `.agents/skills/typescript-api-design/SKILL.md`. It may then take an optional trailing options object whose `db` handle defaults to the global client:

   ```ts
   wrapper(params, { db = defaultDb } = {})
   ```

   The handle lives in an options object, not as a bare positional argument and not mixed into the domain object. This keeps infrastructure separate from domain inputs and allows future options to be added without changing the signature.

7. The wrapper's optional `db` handle is a test seam. In application/runtime code, callers normally omit it and let the wrapper use the global client. Tests may pass a test database handle to exercise wrapper behavior without module-mocking `src/db/kysely.ts`.

8. Do not pass a transaction to an app-level wrapper. Transactions are valid primitive handles, not wrapper handles. A write wrapper opens its own transaction on the handle it receives, so passing a transaction to a wrapper is invalid. Code that already owns a transaction should call primitives directly.

9. A write wrapper owns its transaction boundary. It opens the transaction, calls one or more primitives inside it, waits for the transaction to commit, and only then invalidates cache tags.

10. Multi-step write callers, such as imports or batch edits, compose primitives inside their own transaction and own the post-commit invalidation themselves.

11. Write wrappers should compose primitives, not other write wrappers. This avoids nested transaction ambiguity and duplicate invalidation. If a write operation needs reusable database behavior, extract that behavior into a primitive and call it from both wrappers.

12. A read wrapper owns caching only. It declares cache tags and `cacheLife`, delegates database work to its `...FromDb` primitive, and contains no data logic of its own.

13. Cached read wrappers may carry the same trailing `{ db = defaultDb } = {}` test seam as write wrappers. It is a test-only seam: tests mock `next/cache`, which makes the `"use cache"` directive inert, so the handle flows to the primitive and the wrapper's delegation and tag registration can be exercised directly. Runtime callers always omit the handle and pass domain arguments only.

14. Never pass a `db` handle to a cached wrapper from Next.js runtime code. A Kysely handle is a non-serializable class instance, and `"use cache"` serializes a function's arguments to form its cache key before the body runs, so passing one throws `Cannot serialize class instance` — Next does not silently ignore it. This makes the misuse loud, but because serialization precedes the body, a friendlier guard cannot run earlier without wrapping the cached function in a non-cached dispatch layer; we deliberately do not add that layer (it would let a passed handle silently bypass the cache instead of failing). Document the seam at the wrapper so the throw is easy to trace.

   A plain deriver that composes a cached wrapper may forward its own optional `db` option unchanged to that wrapper — callers should not need to know whether a given read is the cached source or a deriver over it. The deriver must not resolve its own default before forwarding (no `{ db = defaultDb } = {}` on the deriver itself): when the option is omitted, it must stay `undefined` so the forwarded call collapses to the exact shape the wrapper receives when called directly, sharing its cache entry rather than splitting it. Resolving the default first would forward a real Kysely instance even on the plain runtime path, defeating the point. A handle that does reach the cached wrapper, forwarded or direct, throws the same way either way — there is no dispatch and no silent bypass, because the deriver never branches on the value, it only passes it through.

15. Cache tags are extracted to pure helpers and tested directly. Wrapper tests may verify that the wrapper uses the expected tag helper, but actual cache revalidation behavior is an end-to-end concern.

16. Any derivation that is not database access, such as a row-to-grid transform, is extracted to a pure function and unit-tested directly. Primitives and wrappers should stay thin.

## Example

```ts
export async function saveQuestionsInDb(
  db: Kysely<DB>,
  { questions, projectId }: { questions: ImportedQuestions; projectId: string },
): Promise<{ questionCount: number; rubricCount: number }> {
  // `db` may be the global client or a caller-supplied transaction.
  // Perform database work only.
}

export async function saveQuestions(
  params: { questions: ImportedQuestions; projectId: string },
  { db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<{ questionCount: number; rubricCount: number }> {
  const result = await db.transaction().execute((tx) =>
    saveQuestionsInDb(tx, params),
  );

  revalidateTag(projectQuestionsTag(params.projectId));

  return result;
}
```

## Considered Options

- **Keep the optional `options.db` handle on primitives**, as in the assessment path status quo. Rejected: on a primitive, an optional handle keeps two call shapes and lets a caller silently skip a transaction. A required handle makes composition explicit. This rejection is scoped to primitives. A wrapper opens its own transaction on whatever handle it receives, so an optional handle there cannot silently escape a transaction; it is allowed as a test seam.

- **Introduce a `DbClient` / `DbHandle` union type** such as `Kysely<DB> | Transaction<DB>`. Rejected as redundant: `Transaction<DB>` already extends `Kysely<DB>`, so the union equals `Kysely<DB>` and reads as a mistake. Use `Kysely<DB>` for parameters that accept either the global client or a transaction.

- **Invalidate cache at the server-action or route boundary instead of in the transaction owner**. Rejected as a second rule: it splits "who invalidates" between wrappers and orchestrators. One rule is easier to apply consistently: the transaction owner invalidates after commit.

- **Let write wrappers compose other write wrappers**. Rejected as the default pattern: it creates nested transaction ambiguity and makes cache invalidation ownership harder to see. Shared write behavior belongs in primitives.

## Consequences

- Primitives become directly testable with a test database or transaction, with no `src/db/kysely.ts` module mocking.

- Multi-step writes can compose primitives inside a single caller-owned transaction without accidentally escaping to the global client.

- Write wrappers are tested through the `{ db = defaultDb }` seam: a test passes a test-database handle and exercises the wrapper directly, with no module mocking and no dynamic import. These tests cover the transaction boundary and post-commit invalidation call.

- Read wrappers are tested through the same seam when useful. These tests cover delegation to the primitive and use of cache tag helpers, not the Next.js cache runtime itself. A plain deriver over another cached wrapper forwards the same seam unchanged (rule 14), so it can be tested the same way callers test the source; its own pure logic (a transform, a lookup) is additionally covered by direct unit tests.

- Actual cache behavior, including revalidation and tag busting, only runs under the real Next.js runtime and is treated as an end-to-end concern. That coverage is deferred until a caching regression warrants it; primitive coverage, wrapper seam tests, and pure tag-helper tests guard the realistic regressions in the meantime.

- This complements [ADR 0002](./0002-db-is-infrastructure-features-own-persistence.md): primitives and wrappers both live in the owning feature folder; `src/db` stays infrastructure and exposes only the `Kysely<DB>` client and generated types.

- `CONTEXT.md` gains **DB Primitive** and **App-Level Wrapper**.

- Migration is incremental. The questions read/write modules and the assessment write path adopt the pattern first; other modules migrate when nearby code is touched, not in one mechanical pass.
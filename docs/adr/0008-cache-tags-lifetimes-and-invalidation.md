# Cache tags, lifetimes, and invalidation are centrally defined and explicitly mapped

- **Status:** Accepted
- **Created:** 2026-06-17

All cache tag strings are produced by helpers in `src/db/cacheTags.ts`. Every `"use cache"` scope registers the full set of tags for the data it renders and declares an explicit `cacheLife` from a named policy class. Every mutation invalidates through a semantic helper, and every registered tag appears in a documented mutation-to-tag map. No cached scope relies on undocumented Next.js behavior such as nested tag propagation.

This ADR builds on ADR 0007, which defines who caches (read wrappers) and who invalidates (the transaction owner, after commit). This ADR defines what is tagged, how long it lives, and which primitive performs the invalidation.

## Why

Cache invalidation is correctness-sensitive, and the failure mode is silent: a typo'd tag string or a read that registers a tag no mutation ever invalidates does not fail any test — it serves stale data until a fallback lifetime expires. The caching audit (`docs/investigations/2026-06-11-caching-loading-audit.md`) found all of these latent in the codebase: ad-hoc tag strings in pages, a tag (`questions:${questionId}`) registered by three readers and invalidated by nothing, cached loaders with no explicit lifetime, and comments describing invalidation behavior that the code contradicts.

Two Next.js behaviors make discipline non-optional under `cacheComponents`:

- Cache lifetimes propagate from inner cached functions to enclosing `"use cache"` scopes, and Next errors at prerender when a short-lived inner cache is nested in an outer scope with no explicit `cacheLife`. An omitted lifetime is therefore not neutral; it is an implicit dependency on whatever is composed inside.
- Tag propagation from inner cached functions to enclosing scopes is undocumented and community guidance conflicts, so its behavior may be inconsistent across versions and code paths. Correctness must never depend on it in either direction — a positive observation in one case does not make it dependable.

Finally, the invalidation primitive is a freshness policy, not plumbing. `updateTag` expires immediately and blocks the next read on fresh data (read-your-own-writes). `revalidateTag` serves stale data while refreshing in the background. Using read-your-writes semantics for derived projections (completion, progress) makes the grading loop block on recomputation after every save, which is a direct contributor to the loading symptom in #59.

## Rules

1. `src/db/cacheTags.ts` is the only producer of cache tag strings. No template literal or string constant outside that file may build a tag. Pages, sections, and feature loaders import named helpers; helper functions that return tag arrays (such as per-loader `...CacheTags()` functions) must themselves compose only `cacheTags.ts` helpers.

2. Every accepted tag scope has a named helper. The vocabulary is closed: adding a tag means adding a helper, an entry in the invalidation map (rule 7), and at least one invalidating mutation. A tag with no invalidating mutation is forbidden unless the map documents an explicit lifetime-only policy for it.

3. A `"use cache"` scope registers the full closure of tags for everything it renders, including data obtained through nested cached loaders. **Never depend on nested tag propagation.** It is undocumented and may be inconsistent across versions and code paths, so even where it appears to work it is unsafe to rely on; correctness must be independent of it. This rule is not subject to empirical relaxation — observing that propagation works in one case does not make undocumented behavior dependable.

4. Every `"use cache"` scope declares an explicit `cacheLife`, chosen from a named policy class. The classes, not the exact numbers, are the contract:

   - `definitions` — questions, rubrics: long fallback (currently one hour); writes are the freshness mechanism.
   - `roster` — submissions, students: long fallback; imports are the freshness mechanism.
   - `values` — individual assessment values: conservative fallback; exact-tag invalidation is the freshness mechanism.
   - `projection` — completion, progress, overview, dashboards: short fallback (currently 60 seconds); derived and user-visible during grading.
   - `directory` — grid list and grid lookup: short fallback.

   Changing a class's duration is a one-line change in one place; a loader that needs to deviate from its class documents why at the call site.

5. Cache keys must contain only domain arguments. The `{ db = defaultDb }` options object on a cached wrapper is a test-only seam (ADR 0007 rules 13–14); runtime callers never pass a handle, so nothing non-serializable enters the key. When several reads need the same expensive data, funnel them through one cached wrapper and let the others derive from it as plain (non-cached) functions, so they share a single cache entry rather than each owning a `"use cache"` scope. A deriver may forward its own optional `db` option unchanged to the shared wrapper (ADR 0007 rule 14), as long as it never resolves its own default before forwarding — an omitted option must stay `undefined` so the call collapses to the wrapper's own no-argument shape and shares its cache entry. Do not wrap a cached function in a dispatch layer that branches on whether a handle was passed and routes around the cache: a stray runtime handle, forwarded or direct, should reach the cached wrapper and fail loudly (Next throws on the non-serializable argument), not silently skip the cache.

6. Mutations invalidate through semantic helpers named after the mutation, not after the mechanism: `invalidateAssessmentSave(...)`, `invalidateAssessmentImport(...)`, `invalidateQuestionDefinitionSave(...)`, and so on, colocated with `cacheTags.ts`. Wrappers and import actions call exactly one helper after commit. The helper chooses the primitive per tag class:

   - `updateTag` (read-your-own-writes) for the tags of the entity that was just edited — the exact assessment pair, the submission's assessments, the question's definition.
   - `revalidateTag` (stale-while-revalidate) for derived projection tags and coarse aggregate tags, so a save never blocks the next navigation on recomputing grid-wide completion.

   `revalidateTag` is only callable in request scope; helpers used outside request scope must document the constraint, as the import savers do today.

7. The mutation-to-tag map lives in `docs/reference/cache-invalidation-map.md` and is updated in the same PR as any change to a tag helper, a semantic invalidation helper, or the tags a loader registers. Reviewers reject a caching change whose map entry is missing. Tests assert helper outputs (tags produced, tags invalidated) so the map and code cannot silently diverge.

8. Tags are grid-scoped: every tag except `allGridsTag` lives under the `grids:{gridId}:…` namespace, so a mutation in one grid never invalidates another grid's cached reads. One uniform grammar, `grids:{gridId}:<entity>[:<discriminator>:<id>]…`, with any author-chosen id (a grade target or rubric public id) always behind a literal discriminator (`target:`, `rubric:`); no two tag shapes can alias regardless of what ids authors pick — a structural guarantee, not a convention that depends on ids looking a certain way. This scoping was migrated all-at-once with the Project→Grid rename, never a mix of scoped and unscoped shapes.

## Consequences

- A new cached read costs three small artifacts: a helper-based tag set, an explicit lifetime class, and a map entry. This is intentional friction; it is the cheap end of the cost curve compared with debugging staleness.
- Page-level sections are more verbose (full tag closure). That verbosity is the permanent price of not depending on undocumented behavior; verifying propagation would not remove it, because undocumented behavior stays undependable even when it happens to work.
- The `updateTag`/`revalidateTag` split means progress indicators may be one navigation stale immediately after a save. This is accepted: the grading loop must not block on derived data (#59).

## Changelog

- 2026-07-14: Rule 8 executed — tags moved from project-coarse to grid-scoped under the `grids:{gridId}:…` namespace (only the grid list stays global), following the Project→Grid rename.

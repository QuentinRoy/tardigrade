# Next.js caching in this repository

This guide explains how Next.js caching actually works under the configuration this repository uses, and gives recipes for common tasks. It exists because the mental model is genuinely non-obvious: Next 16 with `cacheComponents: true` behaves differently from both classic SSR and older App Router defaults, and most online material describes the older models.

Read this alongside ADR 0007 (who caches and who invalidates) and ADR 0008 (tags, lifetimes, and invalidation policy). This guide explains the mechanics; the ADRs state the rules.

## The model in one paragraph

With `cacheComponents: true`, nothing is cached unless you say so, and everything you do not cache must be allowed to suspend. Any server component or function that performs IO (database, fetch) is either inside a `"use cache"` scope — cached, keyed by its inputs, invalidated by tags or lifetime — or it is dynamic, meaning it runs on the server on every request and streams its result into the nearest Suspense or `loading.tsx` boundary. The skeleton a user sees during navigation is the fallback of that boundary while dynamic work streams.

## The four layers

When reasoning about "why was this stale" or "why did this show a skeleton", identify which layer you are in:

1. **The server data cache** — `"use cache"` functions and components. Entries are keyed by inputs, tagged with `cacheTag`, bounded by `cacheLife`, and invalidated by `updateTag`/`revalidateTag`. This is the layer ADR 0007/0008 govern.
2. **Route rendering topology** — which parts of a route segment are cached components versus dynamic components. A page whose body is one big dynamic component must round-trip to the server on every navigation, no matter how warm the data caches are; only the inner data reads are saved, not the render or the trip.
3. **The client router cache** — the browser keeps recently rendered segments and reuses them on navigation. Server actions that call `updateTag`/`revalidateTag` refresh affected segments in the action response.
4. **Link prefetch** — `next/link` prefetches what can be known ahead of time, which under `cacheComponents` is the cached/static part of the target route. A fully dynamic page body gives prefetch almost nothing to fetch; `router.push` prefetches nothing at all.

A practical consequence in this repo: the rubric grading page (`app/grids/[gridId]/[gridSlug]/grades/[targetId]/[targetSlug]/rubrics/[rubricId]/page.tsx`) has a cached `RubricHeaderSection` and no blocking top-level await, so it navigates fast with explicit prefetch on prev/next. The grade-target grading page (`app/grids/[gridId]/[gridSlug]/grades/[targetId]/[targetSlug]/page.tsx`) has no cached section at all and blocks on uncached `loadGridByPublicId`/`loadGradeTargets` before rendering anything, so it falls back to the root `loading.tsx` skeleton. Same data layer underneath — different topology and prefetch.

## `"use cache"` mechanics

Placing `"use cache"` at the top of an async function or component makes its result cacheable.

**Cache keys.** All arguments, plus any variables captured from enclosing scope, become part of the cache key. They must be serializable. This has two sharp edges:

- A non-serializable argument (a Kysely handle, a class instance) is not hashed — it becomes an opaque reference that the cached function cannot actually use. This is why ADR 0007 forbids passing a `db` handle to a cached wrapper at runtime: it is not just impure, it does not work.
- Module-level values referenced inside the function (like the global `db` client) are not arguments and not captured per-call, so they are fine. `{ db = defaultDb } = {}` works at runtime precisely because runtime callers never pass the option, so nothing non-serializable enters the key.

**Granularity.** A cached *function* caches data. A cached *component* caches rendered output (its RSC payload), keyed by its serialized props. This repo uses both: data loaders in `src/**` and page sections like `RubricHeaderSection` in `app/**`. A cached component whose props include `rubricId` has one entry per rubric — useful, but it means the first visit to each rubric is a miss by construction.

**Nesting.** Cached scopes nest. If the outer entry is fresh, inner functions never run. If the outer entry is stale but inner entries are fresh, the outer re-render is served from inner caches. Two propagation behaviors matter:

- *Lifetimes propagate* (documented): a short-lived inner cache shortens the effective lifetime of the outer scope, and Next errors at prerender if the outer scope has no explicit `cacheLife` of its own. Always declare `cacheLife` explicitly (ADR 0008 rule 4).
- *Tags may or may not propagate* (not clearly documented). Do not depend on it: register the full tag closure in every scope (ADR 0008 rule 3).

## Tags and invalidation

`cacheTag("a", "b")` attaches tags to the enclosing cache scope. Invalidation happens from server functions or route handlers:

- `updateTag(tag)` — expire immediately. The next read blocks on fresh data. Use for the entity the user just edited, so they read their own write.
- `revalidateTag(tag, profile)` — serve stale while revalidating in the background. Use for derived projections (completion, progress) and coarse aggregates, where blocking a navigation on recomputation is worse than one stale view. Only callable in request scope.

In this repo you never call these primitives directly from feature code: write wrappers and import actions call one semantic helper (`invalidateAssessmentSave(...)` etc.) after their transaction commits, and the helper chooses the primitive per tag class (ADR 0008 rule 6). The full mutation-to-tag map lives in `docs/reference/cache-invalidation-map.md`.

## Lifetimes

`cacheLife` takes a named profile or `{ stale, revalidate, expire }`. The repo uses policy classes (ADR 0008 rule 4): `definitions` and `roster` are long because writes invalidate them; `values` is conservative because exact tags invalidate it; `projection` and `directory` are short because they are derived or cheap. The exact numbers matter less than the rule that omission is never accidental — an omitted `cacheLife` silently inherits framework defaults *and* whatever shorter lifetimes are nested inside.

## Dynamic content and loading UI

Anything not in a `"use cache"` scope that does IO is dynamic and must be inside a Suspense boundary or covered by a `loading.tsx`. Where you place the boundary decides what the user keeps seeing during a navigation:

- A single root `loading.tsx` (the current state) replaces the whole page with a generic skeleton.
- A boundary around just the dynamic part of a page keeps the cached sections (header, navigation, context) visible while only the dynamic part streams.

When a page feels slow to navigate to, fix it in this order: make more of it cacheable (topology), prefetch it (links), choose non-blocking invalidation (`revalidateTag` for projections), and only then improve the skeleton.

## Recipes

### Add a cached read

1. Write the `...FromDb` primitive taking a required `Kysely<DB>` handle (ADR 0007).
2. Write the wrapper: `"use cache"`, `cacheTags(...)` using only `src/db/cacheTags.ts` helpers, explicit `cacheLife` from the right policy class, delegate to the primitive with the default client.
3. Add or update the entry in the invalidation map; confirm every tag you registered has an invalidating mutation.
4. Test the tag helper output, not the Next cache runtime.

### Add a mutation

1. Write the `...InDb` primitive.
2. The wrapper opens the transaction, runs the primitive, and after commit calls exactly one semantic invalidation helper.
3. Add the mutation to the invalidation map. Check the map for readers of every tag you invalidate: that list is the blast radius of your write. If it includes hot grading-path projections, prefer `revalidateTag` semantics for those tags.

### Add a page or section

1. Decide what is cacheable. Prefer cached sections for stable context (headers, definitions, navigation) and a small dynamic remainder, rather than one dynamic body.
2. Cached sections take only serializable props, register the full tag closure of what they render, and declare `cacheLife`.
3. Put the dynamic remainder under a Suspense boundary close to it, so cached context stays visible.
4. Navigation into the page should be `next/link` (prefetchable), with explicit `prefetch` for known next targets such as prev/next, not `router.push`, unless the target genuinely cannot be known ahead of interaction.

### Debug staleness or slowness

1. Identify the layer first: wrong data after a write → tags/invalidation (check the map); skeleton on navigation → topology/prefetch; slow first paint per entity → per-entity cache keys (expected) or missing prefetch.
2. Run with `NEXT_PRIVATE_DEBUG_CACHE=1` to log cache hits, misses, and tag invalidations.
3. Grep the tag in `cacheTags.ts`, the readers that register it, and the helpers that invalidate it. If any of the three is missing, that is the bug.

## Pitfalls

- Building a tag string inline. It compiles, works in testing, and goes stale in production when the writer's string drifts from the reader's. Use the helpers.
- Registering a tag "to be safe" that nothing invalidates. It does nothing except imply a guarantee the system does not provide.
- Relying on a coarse tag to cover a granular read (or the reverse) without a map entry saying so. It often works by coincidence today and breaks when a mutation's tag list is edited.
- Passing a `db` handle into a cached wrapper from runtime code. The handle becomes an unusable reference; this fails at runtime, not at the type level.
- Treating `updateTag` as the safe default. It is the *blocking* default; for derived data it converts every save into latency on the next navigation.
- Adding `loading.tsx` to mask a topology problem. The skeleton gets prettier; the wait stays.

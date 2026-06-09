# Plan: separate DB primitives from app orchestration (issue #138)

Status: Execution plan — **complete** (see Progress below)
Date: 2026-06-04
Owner: Unassigned
Issue: #138

## Progress (as of 2026-06-09)

**Done — primitives + write/import side:**
- All 9 modules have their DB Primitive extracted (`*FromDb` reads, `*InDb` writes), taking a `Kysely<DB>` handle.
- Renames/composition: `loadQuestions`→`loadQuestionGrid`; `loadQuestionRows` added (keeps `cacheLife({ revalidate: 60*60 })`); `loadQuestionDefinitions` composes `loadQuestionRowsFromDb`+count; call sites updated.
- Cache-owner relocation: all three `*ImportAction` files dropped `revalidateTag`; savers invalidate post-commit with the correct tag sets; interactive `saveAssessment` keeps `updateTag`.
- `assessments.integration.test.ts` split into a new `assessmentMutations.integration.test.ts`; shared `createAssessmentFixture` moved to `src/test/assessments.ts`.
- `saveAssessment.ts` re-export collision fixed.
- Read integration tests for questions / questionDefinitions / submissions / submissionProgress are de-mocked by calling the **primitive** directly with a test handle.

**Done — the 2026-06-09 decision update (uniform read-wrapper seam + tag helpers):**
- Every wrapper carries the `{ db = defaultDb } = {}` seam — reads (`loadSubmissions`, `loadAssessment`, `loadQuestionRows`, `loadQuestionGrid`, `loadQuestionDefinitions`, both `submissionProgress` wrappers, `getQuestionDefinitionDeleteImpact`) and writes (`saveQuestionDefinition`, `deleteQuestionDefinition`, `reorderQuestions`, `saveAssessment`, the three import savers).
- Pure tag helpers extracted and unit-tested: `loadAssessmentCacheTags`, `questionCacheTags`, `submissionsCacheTags`, `submissionQuestionProgressCacheTags`, `submissionOverviewProgressCacheTags` (in `assessments.test.ts`, `questions.test.ts`, `submissions.test.ts`, `submissionProgress.test.ts`).
- Read-wrapper seam tests written for each seamed read wrapper: assert delegation through `{ db }` (returns the test db's rows) and, where the wrapper caches, the exact declared `cacheTag` set equals the tag helper.
- Last kysely module mock removed: `assessments.integration.test.ts` no longer uses `loadAssessmentWrapperWithDb`. No `vi.doMock("#db/kysely")`, `vi.resetModules`, or dynamic `import` remains anywhere in the suite.
- `loadQuestionDefinitions` decision: an in-progress edit had added a bare `"use cache"` (no tags) to it; the committed baseline had none. Reverted to no cache — it stays a plain `{ db }`-seamed wrapper. Caching it correctly would need assessment tags (its result includes per-question `assessmentCount`), which is a caching-strategy change the plan marks out of scope.

Verification: `pnpm run check`, `pnpm run check-types`, full unit suite (69) and the affected integration suite (57) all pass.

Decision of record: `docs/adr/0007-db-primitives-take-a-handle-wrappers-own-transactions-and-cache.md`
Glossary: CONTEXT.md — **DB Primitive**, **App-Level Wrapper**
Prior art: `plans/completed/2026-05-29-split-questions-db-module.md`, `plans/completed/2026-06-01-split-assessments-db-module.md`

## Decision update (2026-06-09): uniform `{ db = defaultDb }` seam on read wrappers too

An interim revision of ADR 0007 carved out a `"use cache"` read-wrapper **exception**: read wrappers could not take the `{ db }` handle (a non-serializable `Kysely<DB>` was assumed to pollute the cache key), so they would keep the `vi.doMock("#db/kysely")` + dynamic-import seam for tag assertions. **That exception is removed.** Read wrappers now carry the same `{ db = defaultDb } = {}` seam as write wrappers and are integration-tested through it — **no module mock, no `vi.resetModules`, no dynamic import anywhere in the suite**, reads included.

Why the seam is safe on a `"use cache"` wrapper: `db` is defaulted and the Next runtime never passes the options object, so Next derives the cache key from the arguments actually passed and the body binds the global client afterwards — the handle is never an argument Next serializes and cannot enter or fragment the key. (If a handle were ever passed in a real runtime, Next either excludes the non-serializable value as an opaque pass-through reference or throws loudly — never a silent mis-key.) Under vitest the directive is inert, so the test passes `{ db }` and runs the wrapper body directly against the test database. See ADR 0007 rule 6.

Two consequent additions to the recipe and coverage below:

- **Pure tag helpers.** Each wrapper's tag (+ `cacheLife`) set is extracted to a pure helper that the wrapper spreads into `cacheTags(...)` / `updateTags(...)`, and that helper is **unit-tested on its own** (no db, no mock, no dynamic import). This is the primary guard for cross-cutting tag invariants (e.g. a granular assessment read also declaring the `assessments:all` bulk-import fallback).
- **Cache behavior is e2e-only and deferred.** Real revalidation / tag-busting only runs under `next build && next start`, never under vitest. The seam tests assert *declared* tags and delegation, not cache behavior; end-to-end cache coverage is deferred until a regression warrants it.

## Goal

Split feature persistence into **DB Primitives** (required `Kysely<DB>` handle, DB work only, no transaction, no cache) and **App-Level Wrappers** (own the global `db`, transactions, and cache invalidation). Apply this to **every DB module that currently has a test seam**, so the whole suite stops mocking `src/db/kysely.ts`.

### Scope (one PR, by explicit user decision)

This intentionally migrates **all** modules behind the `vi.doMock("#db/kysely")` / `vi.resetModules` / dynamic-`import` seam, not just questions + assessment. This **overrides the issue's non-goal** "Do not refactor every DB module in one large mechanical PR" — the user has accepted the larger, single PR because removing the import-mock seam everywhere is the point. Keep it behavior-preserving; the observable changes are (a) where cache invalidation runs (relocated, same tags) and (b) every wrapper — read and write — gains an optional trailing `{ db = defaultDb } = {}` test-seam argument.

The nine seam test files / their modules:

| Test file | Module(s) | Kind |
|---|---|---|
| `questions/questions.integration.test.ts` | `questions.ts` | read |
| `questions/questionDefinitions.integration.test.ts` | `questionDefinitions.ts` | read |
| `questions/questionDefinitionMutations.integration.test.ts` | `questionDefinitionMutations.ts` | write |
| `assessments/assessments.integration.test.ts` | `assessments.ts` (read) + `assessmentMutations.ts` (write) — **split into two files** | read+write |
| `assessments/submissionProgress.integration.test.ts` | `submissionProgress.ts` | read |
| `submissions/submissions.integration.test.ts` | `submissions.ts` | read |
| `import/saveQuestions.integration.test.ts` | `import/saveQuestions.ts` | write |
| `import/saveStudents.integration.test.ts` | `import/saveStudents.ts` | write |
| `import/saveAssessments.integration.test.ts` | `import/saveAssessments.ts` | write |

## Divergences from issue #138 (as written)

The grilling session changed several specifics from the issue text — implement these, not the issue's literal examples:

- **Names.** The issue's `loadQuestionsFromDb` / `loadQuestions` collide with existing symbols (the cached rows read and the Grid read already use those names). Use `loadQuestionRowsFromDb` (primitive) + `loadQuestionRows` (cached) and rename `loadQuestions` → `loadQuestionGrid`.
- **No handle type.** The issue's `DbClient = Kysely<DB> | Transaction<DB>` is redundant (`Transaction<DB>` extends `Kysely<DB>`, confirmed against Kysely docs). Use `Kysely<DB>` directly; delete the existing `AssessmentWriteDb`.
- **Signature.** Not the issue's fully-positional `fn(db, input, projectId)`. Use `fn(db, { …args })` per `docs/guides/typescript-api-design.md`; single obvious-arg reads stay positional.
- **Scope.** Larger than the issue's "one write + one read": all nine seam modules in one PR (see Scope above) — a deliberate override of the issue's reviewability non-goal.
- **Cache API is frozen.** A unify-on-`updateTag` idea was raised during grilling and then explicitly reverted. Do **not** change the invalidation API: imports keep `revalidateTag(tag, "max")`, interactive keeps `updateTag`. The only change is *where* invalidation runs (transaction owner, post-commit), not *how*.

## The recipe (per ADR 0007)

- **Read module:** extract the query body into `xFromDb(db, …)` (no cache); the bare cached function becomes the **wrapper** that takes `{ db = defaultDb } = {}`, keeps `"use cache"` + `cacheTags` (+ `cacheLife` where present), and delegates to the primitive on that handle (default = global client). Spread the wrapper's tags from a pure tag helper. Primitive signature `(db, { …domainArgs })`; a single obvious arg stays positional.
- **Write module:** extract the in-transaction body into a self-contained `xInDb(db, { … })` (resolve + validate + persist on the handle); the bare wrapper takes `{ db = defaultDb } = {}`, opens `db.transaction()` on that handle, and invalidates after commit (tags spread from a pure tag helper).
- **No custom handle type** — `db: Kysely<DB>` (a `Transaction<DB>` already is one).
- **Composition:** a wrapper may compose other wrappers and/or primitives — e.g. `loadQuestionGrid`→`loadQuestionRows`, `loadQuestionDefinitions`→`loadQuestionRows`+count, `rubricOverview`→`loadSubmissions`+`loadQuestionGrid`, `saveAssessments`→`saveAssessmentInDb`. A primitive composes only other primitives, threading its handle, and must **never call a wrapper** — that would run the sub-read on the global `db` and escape the caller's transaction. Keep primitives close to leaf.
- **Cache owner rule:** the function that owns the transaction invalidates after it commits. The three `*ImportAction` files drop their `revalidateTag` calls; the savers invalidate post-commit, preserving each path's current API verbatim — the import savers keep `revalidateTag(tag, "max")`, the interactive `saveAssessment` wrapper keeps `updateTag`. This is a relocation only; no invalidation timing changes.

## TDD approach

Vertical slices, one test → minimal code → next. For a behavior-preserving refactor the cleanest red/green per module is: **rewrite that module's integration test to call the new handle-accepting primitive directly (RED — it doesn't exist yet) → extract the primitive (GREEN)**, with the test's existing behavioral assertions kept intact as the drift guard. Never bulk-write all tests first; never refactor while RED.

Each module's de-mocked test gets its DB from `createTestDb()` with `await using` disposable fixtures (exemplar: `src/import/saveStudents.integration.test.ts`), and write-composition tests pass a `tx`.

### Tracer bullets (do these four first — the genuinely new capabilities)

1. ✅ **Read primitive honours an injected handle** *(highest)* — `loadQuestionRowsFromDb(testDb, projectId)` returns only that project's question rows, second project's excluded. No `vi.doMock`. Extract the 5-query body from `questions.ts`; thread `resolveProjectRowId(db, projectId)`.
2. ✅ **Write primitive composes inside a caller transaction** *(highest)* — `saveQuestionDefinitionInDb(tx, { input, projectId })` persists question + rubrics inside a caller-owned `tx`; rolling that `tx` back discards everything.
3. ✅ **Import stays atomic and invalidates after commit** *(highest)* — `saveAssessments(rows, projectId)` writes all rows in one transaction (mid-batch failure rolls back the whole import) and invalidates `assessments` + `assessments:all` after commit; `assessmentsImportAction` no longer invalidates.
4. ⬜ **`"use cache"` read wrapper honours the injected handle** *(highest — validates the seam-safety assumption)* — `loadAssessment(params, { db: testDb })` returns the test db's rows and (with `next/cache` mocked) declares its current tag set, with no `vi.doMock`/dynamic import. Confirms the directive is inert under vitest and the seam works on a cached wrapper before rolling it out to the other read modules. **Not done: `loadAssessment` has no `{ db }` seam; `assessments.integration.test.ts` still uses the `vi.doMock` wrapper.**

### Then apply the recipe per module (each guarded by its de-mocked test)

**Reads** — primitives ✅ extracted; ⬜ wrappers still missing the `{ db = defaultDb } = {}` seam, pure tag helpers, and seam tests.
- ◐ `questions.ts` — `loadQuestionRowsFromDb(db, …)` primitive ✅ + `loadQuestionRows(…)` cached wrapper ✅ (**`cacheLife({ revalidate: 60*60 })`** kept); `loadQuestions` → `loadQuestionGrid` ✅; `loadQuestion`/`loadQuestionDefinitions` point at `loadQuestionRows` ✅; call sites updated ✅. ⬜ Wrapper `{ db }` seam + tag helper + seam test.
- ◐ `questionDefinitions.ts` — `loadQuestionDefinitionsFromDb` + `getQuestionDefinitionDeleteImpactFromDb` primitives ✅. ⬜ Wrapper `{ db }` seam + tag helper + seam test.
- ◐ `assessments.ts` — `loadAssessmentFromDb` primitive ✅. ⬜ `loadAssessment` wrapper `{ db }` seam + tag helper + seam test (tracer #4).
- ◐ `submissionProgress.ts` — both `*FromDb` primitives ✅. ⬜ Wrapper `{ db }` seam + tag helpers + seam tests.
- ◐ `submissions.ts` — `loadSubmissionsFromDb` primitive ✅. ⬜ `loadSubmissions` wrapper `{ db }` seam + tag helper + seam test.

**Writes** — ✅ complete.
- ✅ `questionDefinitionMutations.ts` — `saveQuestionDefinitionInDb` / `deleteQuestionDefinitionInDb` / `reorderQuestionsInDb` + bare wrappers (tx + `updateTags`).
- ✅ `assessmentMutations.ts` — `saveAssessmentInDb(db, params)` exported; `AssessmentWriteDb` deleted; `saveAssessment` wrapper carries the canonical `{ db = defaultDb } = {}` seam.
- ✅ `import/saveAssessments.ts`, `import/saveQuestions.ts`, `import/saveStudents.ts` — `xInDb(db, { … })` primitives; savers own the `tx` and invalidate post-commit; the three `*ImportAction` files dropped their `revalidateTag` calls. Tag sets preserved (questions → `questions`+`assessments`+`assessments:all`; students → `submissions`+`assessments`+`assessments:all`; assessments → `assessments`+`assessments:all`).

### Cache-invalidation coverage (per module)

Cache tags are a correctness contract: a dropped or renamed tag serves stale grades/questions, so these assertions are intentional guards, not brittle coupling — a test that fails when a tag changes is doing its job. Capture each path's current tag set *before* refactoring and assert it after. For every wrapper/saver:

- **App-Level Wrapper** (`saveQuestionDefinition`, `deleteQuestionDefinition`, `reorderQuestions`, interactive `saveAssessment`): assert it calls `updateTag` with its exact current tag set on success, and does **not** invalidate when it throws.
  - `saveAssessment` → `assessmentCacheTag(submissionId, questionId)`, `CACHE_TAGS.assessments`, `assessmentQuestionCacheTag(questionId)`.
  - question wrappers → the tag set each currently emits (`CACHE_TAGS.questions`, plus the per-question tag where present).
- **Import savers** (`saveAssessments`, `saveQuestions`, `saveStudents`): assert post-commit `revalidateTag(tag, "max")` with the exact set the matching action emits today — assessments → `assessments`+`assessments:all`; questions → `questions`+`assessments`+`assessments:all`; students → `submissions`+`assessments`+`assessments:all` — and assert the `*ImportAction` no longer invalidates.
- **DB Primitive** (`*InDb` called directly with a handle/tx): assert neither `updateTag` nor `revalidateTag` is called — invalidation never happens inside persistence.
- **Read wrapper** (`loadAssessment`, `loadQuestionRows`, …, called through the `{ db }` seam with `next/cache` mocked): assert it declares its exact current `cacheTag` set (and `cacheLife` where present), and that it delegates to its primitive. The cross-cutting invariant lives here — e.g. `loadAssessment` must declare `assessments:all` alongside its granular tag, or a bulk import serves stale grades.
- **Pure tag helpers** (one per wrapper): unit-test the returned tag set directly — no db, no `next/cache`. This is the durable contract; the read-wrapper seam test above only checks the wrapper actually spreads the helper.

## Cross-cutting cleanups
- ◐ Delete the `*WithDb` module-mock helpers (and any `vi.doMock("#db/kysely")` / `vi.resetModules` / dynamic `import`) in all nine test files. **Last one remaining: `assessments.integration.test.ts` still has `loadAssessmentWrapperWithDb`** (`vi.resetModules` + `vi.doMock("#db/kysely")` + dynamic import). The other eight are de-mocked.
- ✅ **Split `assessments.integration.test.ts`** — `loadAssessment` (read) cases stay; `saveAssessment`/`saveAssessmentInDb` moved into `assessmentMutations.integration.test.ts`; shared `createAssessmentFixture` moved to `src/test/assessments.ts`.
- ✅ Fix `src/assessments/saveAssessment.ts` re-export collision.
- Leave `resolveProjectRowId` as a handle-threaded helper; eliminating the extra round trip (CONTEXT *Project Resolution Strategy*) is out of scope.
- Moving `revalidateTag` into the savers is safe only because each saver is always invoked from a `*ImportAction` (request scope); `revalidateTag`/`updateTag` throw outside a request. Do not call savers from scripts/seeds without a request context.

## Refactor pass (only while GREEN)
Run the simplify pass (`.agents/skills/simplify/SKILL.md`) over each module after its slice is green. (This is the behavior-preserving cleanup step, not a place to change outputs.)

## Checks
- `pnpm run check --fix` and `pnpm run check-types` (always).
- `pnpm test:integration` (Docker) for the rewritten `*.integration.test.ts`; `pnpm test:unit <stem>` for any unit-level changes.

## Out of scope
- In-query project resolution; final caching strategy; any public identifier changes; UI/behaviour changes.
- Real cache-behavior coverage (revalidation / tag-busting under `next build && next start`) — deferred until a caching regression warrants it. Seam tests assert declared tags only.

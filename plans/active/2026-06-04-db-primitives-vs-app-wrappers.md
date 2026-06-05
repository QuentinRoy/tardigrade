# Plan: separate DB primitives from app orchestration (issue #138)

Status: Active execution plan
Date: 2026-06-04
Owner: Unassigned
Issue: #138
Decision of record: `docs/adr/0007-db-primitives-take-a-handle-wrappers-own-transactions-and-cache.md`
Glossary: CONTEXT.md — **DB Primitive**, **App-Level Wrapper**
Prior art: `plans/completed/2026-05-29-split-questions-db-module.md`, `plans/completed/2026-06-01-split-assessments-db-module.md`

## Goal

Split feature persistence into **DB Primitives** (required `Kysely<DB>` handle, DB work only, no transaction, no cache) and **App-Level Wrappers** (own the global `db`, transactions, and cache invalidation). Apply this to **every DB module that currently has a test seam**, so the whole suite stops mocking `src/db/kysely.ts`.

### Scope (one PR, by explicit user decision)

This intentionally migrates **all** modules behind the `vi.doMock("#db/kysely")` / `vi.resetModules` / dynamic-`import` seam, not just questions + assessment. This **overrides the issue's non-goal** "Do not refactor every DB module in one large mechanical PR" — the user has accepted the larger, single PR because removing the import-mock seam everywhere is the point. Keep it behavior-preserving; the only observable change is where cache invalidation runs (relocated, same tags).

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

- **Read module:** extract the query body into `xFromDb(db, …)` (no cache); the bare cached function becomes the **wrapper** that calls it on the global `db` and keeps `"use cache"` + `cacheTags` (+ `cacheLife` where present). Primitive signature `(db, { …domainArgs })`; a single obvious arg stays positional.
- **Write module:** extract the in-transaction body into a self-contained `xInDb(db, { … })` (resolve + validate + persist on the handle); the bare wrapper opens `db.transaction()` and invalidates after commit.
- **No custom handle type** — `db: Kysely<DB>` (a `Transaction<DB>` already is one).
- **Composition:** a wrapper may compose other wrappers and/or primitives — e.g. `loadQuestionGrid`→`loadQuestionRows`, `loadQuestionDefinitions`→`loadQuestionRows`+count, `rubricOverview`→`loadSubmissions`+`loadQuestionGrid`, `saveAssessments`→`saveAssessmentInDb`. A primitive composes only other primitives, threading its handle, and must **never call a wrapper** — that would run the sub-read on the global `db` and escape the caller's transaction. Keep primitives close to leaf.
- **Cache owner rule:** the function that owns the transaction invalidates after it commits. The three `*ImportAction` files drop their `revalidateTag` calls; the savers invalidate post-commit, preserving each path's current API verbatim — the import savers keep `revalidateTag(tag, "max")`, the interactive `saveAssessment` wrapper keeps `updateTag`. This is a relocation only; no invalidation timing changes.

## TDD approach

Vertical slices, one test → minimal code → next. For a behavior-preserving refactor the cleanest red/green per module is: **rewrite that module's integration test to call the new handle-accepting primitive directly (RED — it doesn't exist yet) → extract the primitive (GREEN)**, with the test's existing behavioral assertions kept intact as the drift guard. Never bulk-write all tests first; never refactor while RED.

Each module's de-mocked test gets its DB from `createTestDb()` with `await using` disposable fixtures (exemplar: `src/import/saveStudents.integration.test.ts`), and write-composition tests pass a `tx`.

### Tracer bullets (do these three first — the genuinely new capabilities)

1. **Read primitive honours an injected handle** *(highest)* — `loadQuestionRowsFromDb(testDb, projectId)` returns only that project's question rows, second project's excluded. No `vi.doMock`. Extract the 5-query body from `questions.ts`; thread `resolveProjectRowId(db, projectId)`.
2. **Write primitive composes inside a caller transaction** *(highest)* — `saveQuestionDefinitionInDb(tx, { input, projectId })` persists question + rubrics inside a caller-owned `tx`; rolling that `tx` back discards everything.
3. **Import stays atomic and invalidates after commit** *(highest)* — `saveAssessments(rows, projectId)` writes all rows in one transaction (mid-batch failure rolls back the whole import) and invalidates `assessments` + `assessments:all` after commit; `assessmentsImportAction` no longer invalidates.

### Then apply the recipe per module (each guarded by its de-mocked test)

**Reads**
- `questions.ts` — `loadQuestionRowsFromDb(db, …)` primitive + `loadQuestionRows(…)` cached wrapper (**keep `cacheLife({ revalidate: 60*60 })`** — it lives on today's cached read, not on the Grid wrapper); rename `loadQuestions` → `loadQuestionGrid`; point `loadQuestion`/`loadQuestionDefinitions` at `loadQuestionRows`. Update call sites: `assessments/rubricOverview.ts`, two assessment pages, `export/questions/route.ts`.
- `questionDefinitions.ts` — `loadQuestionDefinitionsFromDb(db, projectId)` and `getQuestionDefinitionDeleteImpactFromDb(db, { questionId, projectId })`; threaded `resolveProjectRowId(db, …)`.
- `assessments.ts` — `loadAssessmentFromDb(db, …)` primitive + cached `loadAssessment` wrapper.
- `submissionProgress.ts` — `loadSubmissionQuestionProgressFromDb` and `loadSubmissionOverviewProgressFromDb` primitives + cached wrappers.
- `submissions.ts` — `loadSubmissionsFromDb(db, projectId)` primitive + cached `loadSubmissions` wrapper.

**Writes**
- `questionDefinitionMutations.ts` — `saveQuestionDefinitionInDb` / `deleteQuestionDefinitionInDb` / `reorderQuestionsInDb` (self-contained) + bare wrappers (tx + `updateTags`). Existing delete/reorder cases are well-covered — re-point them at the wrappers; add new primitive tests only where coverage is weak.
- `assessmentMutations.ts` — export `applySaveAssessment` as `saveAssessmentInDb(db, params)`; delete `AssessmentWriteDb` (use `Kysely<DB>`); wrapper drops `opts.db`.
- `import/saveAssessments.ts`, `import/saveQuestions.ts`, `import/saveStudents.ts` — `xInDb(db, { … })` primitives; app-level savers own the `tx` and invalidate post-commit with `updateTags`. The matching actions (`assessmentsImportAction`, `questionsImportAction`, `studentsImportAction`) drop their `revalidateTag` calls. Preserve each action's current tag set: questions → `questions`+`assessments`+`assessments:all`; students → `submissions`+`assessments`+`assessments:all`; assessments → `assessments`+`assessments:all`.

### Cache-invalidation coverage (per module)

Cache tags are a correctness contract: a dropped or renamed tag serves stale grades/questions, so these assertions are intentional guards, not brittle coupling — a test that fails when a tag changes is doing its job. Capture each path's current tag set *before* refactoring and assert it after. For every wrapper/saver:

- **App-Level Wrapper** (`saveQuestionDefinition`, `deleteQuestionDefinition`, `reorderQuestions`, interactive `saveAssessment`): assert it calls `updateTag` with its exact current tag set on success, and does **not** invalidate when it throws.
  - `saveAssessment` → `assessmentCacheTag(submissionId, questionId)`, `CACHE_TAGS.assessments`, `assessmentQuestionCacheTag(questionId)`.
  - question wrappers → the tag set each currently emits (`CACHE_TAGS.questions`, plus the per-question tag where present).
- **Import savers** (`saveAssessments`, `saveQuestions`, `saveStudents`): assert post-commit `revalidateTag(tag, "max")` with the exact set the matching action emits today — assessments → `assessments`+`assessments:all`; questions → `questions`+`assessments`+`assessments:all`; students → `submissions`+`assessments`+`assessments:all` — and assert the `*ImportAction` no longer invalidates.
- **DB Primitive** (`*InDb` called directly with a handle/tx): assert neither `updateTag` nor `revalidateTag` is called — invalidation never happens inside persistence.

## Cross-cutting cleanups
- Delete the `*WithDb` module-mock helpers in all nine test files; call primitives directly.
- **Split `assessments.integration.test.ts`** (it was a mistake to merge it): keep `loadAssessment` (read) cases in `assessments.integration.test.ts`, move `saveAssessment`/`saveAssessmentInDb` (write) cases into a new `assessmentMutations.integration.test.ts`, mirroring the questions read/write file split. It is the only seam file covering two modules. Move the shared `createAssessmentFixture` into a `#test/assessments.ts` helper so both files share it — expose **Project ID** per the *Test Helper Boundary*; keep **Project Row ID** internal to fixture plumbing only.
- Fix `src/assessments/saveAssessment.ts`: re-export the bare `saveAssessment` (its `as saveAssessmentInDb` alias now collides with the real primitive; the two client consumers already import the bare name, so they are unaffected).
- Leave `resolveProjectRowId` as a handle-threaded helper; eliminating the extra round trip (CONTEXT *Project Resolution Strategy*) is out of scope.
- Moving `revalidateTag` into the savers is safe only because each saver is always invoked from a `*ImportAction` (request scope); `revalidateTag`/`updateTag` throw outside a request. Do not call savers from scripts/seeds without a request context.

## Refactor pass (only while GREEN)
Run the simplify pass (`.agents/skills/simplify/SKILL.md`) over each module after its slice is green. (This is the behavior-preserving cleanup step, not a place to change outputs.)

## Checks
- `pnpm run check --fix` and `pnpm run check-types` (always).
- `pnpm test:integration` (Docker) for the rewritten `*.integration.test.ts`; `pnpm test:unit <stem>` for any unit-level changes.

## Out of scope
- In-query project resolution; final caching strategy; any public identifier changes; UI/behaviour changes.

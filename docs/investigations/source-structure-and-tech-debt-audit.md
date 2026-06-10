# Investigation: source structure and technical debt audit

Status: Current investigation
Date: 2026-05-25
Last updated: 2026-06-10
Related: #115, #99, #59, #51, #68, #110

## Table of contents

- [Question](#question)
- [Executive summary](#executive-summary)
- [Status at a glance](#status-at-a-glance)
- [Relationship to other investigations](#relationship-to-other-investigations)
- [Principles used in this audit](#principles-used-in-this-audit)
- [Finding 1: project route context and slug handling](#finding-1-project-route-context-and-slug-handling)
- [Finding 2: project-scoped pages repeat route resolution](#finding-2-project-scoped-pages-repeat-route-resolution)
- [Finding 3: submission overview assessment loading is too fragmented](#finding-3-submission-overview-assessment-loading-is-too-fragmented)
- [Finding 4: question-specific grading page cache boundaries need review](#finding-4-question-specific-grading-page-cache-boundaries-need-review)
- [Finding 5: question definition persistence has been split and relocated](#finding-5-question-definition-persistence-has-been-split-and-relocated)
- [Finding 6: assessment reads and writes have been split and relocated](#finding-6-assessment-reads-and-writes-have-been-split-and-relocated)
- [Finding 7: clarify raw database types versus feature-facing types](#finding-7-clarify-raw-database-types-versus-feature-facing-types)
- [Finding 8: question and rubric read-model assembly is duplicated](#finding-8-question-and-rubric-read-model-assembly-is-duplicated)
- [Finding 9: assessment completion semantics are duplicated across projections](#finding-9-assessment-completion-semantics-are-duplicated-across-projections)
- [Finding 10: export submissions is a correctness-sensitive state machine that needs smaller seams](#finding-10-export-submissions-is-a-correctness-sensitive-state-machine-that-needs-smaller-seams)
- [Finding 11: import flows should expose parse, prepare, and write seams](#finding-11-import-flows-should-expose-parse-prepare-and-write-seams)
- [Finding 12: app shell navigation mixes route parsing, navigation structure, local storage, and export behavior](#finding-12-app-shell-navigation-mixes-route-parsing-navigation-structure-local-storage-and-export-behavior)
- [Finding 13: numeric rubric editing parses too eagerly](#finding-13-numeric-rubric-editing-parses-too-eagerly)
- [Finding 14: grading clients duplicate stable workflow behavior](#finding-14-grading-clients-duplicate-stable-workflow-behavior)
- [Finding 15: server actions are colocated with workflows, but their contracts need clearer boundaries](#finding-15-server-actions-are-colocated-with-workflows-but-their-contracts-need-clearer-boundaries)
- [Finding 16: cache tags and invalidation are useful but scattered](#finding-16-cache-tags-and-invalidation-are-useful-but-scattered)
- [Finding 17: `shared` bucket renamed to `src/ui`](#finding-17-shared-bucket-renamed-to-srcui)
- [Finding 18: route handlers are thinner; export internals remain the main split candidate](#finding-18-route-handlers-are-thinner-export-internals-remain-the-main-split-candidate)
- [Finding 19: several components are reasonably split and should not be over-refactored](#finding-19-several-components-are-reasonably-split-and-should-not-be-over-refactored)
- [Finding 20: file reorganization should establish ownership before further splitting](#finding-20-file-reorganization-should-establish-ownership-before-further-splitting)

## Question

Which parts of the current source code should be rewritten, split, or reorganized to improve developer experience, reduce technical debt, improve performance where relevant, and make future changes safer?

This investigation focuses on concrete codebase findings rather than a final architecture decision. It should inform #115, but it is not itself an ADR.

## Executive summary

This document was originally written before several architecture cleanup PRs landed. The current source tree no longer matches all of the original findings.

Resolved or largely resolved since the first audit:

1. project identifier normalization is complete: `project.id` is the public id and `project.row_id` is the internal database key;
2. project path helpers have moved from `routes.ts` to `projectPaths.ts`;
3. project-scoped routes now have a layout-level existence gate;
4. stale project-slug correction is handled client-side in the project-scoped layout via `CosmeticSlugReplacement` (ADR 0005), replacing the removed server-side `canonicalProjectRedirect`;
5. question definition reads and mutations have been split;
6. assessment reads and assessment writes have been split, with a transaction-friendly write API;
7. the ADR 0002 source reorganization has landed: feature-owned persistence, read models, and feature-facing types now live in `src/projects`, `src/submissions`, `src/questions`, `src/assessments`, and `src/rubrics`; `src/db/types.ts` was deleted; `src/db` is database infrastructure only; and the historical `src/shared` bucket was renamed to a flat `src/ui` (see `plans/completed/2026-06-02-source-reorganization.md`).
8. submission overview assessment loading is consolidated: `loadSubmissionAssessments` (#145) returns every question's rubric values for a submission in one query, replacing the per-question `loadAssessment` calls on the submission overview page; assessment reads are also now scoped by Project ID and `assessmentCacheTag` supports a nested submission/question scope.
9. all three import flows (assessments, questions, students) have been restructured around explicit parse → load context → prepare → write seams, per the [import parse/prepare/write design](../design/2026-06-10-import-parse-prepare-write-seams.md) and `plans/completed/2026-06-10-import-parse-prepare-write-seams.md` (#146, #147).

With ownership now matching ADR 0002, the highest-value remaining work is the local seam cleanup that was previously gated on the reorganization:

1. assessment mutation internals, if further seams are still useful before or during relocation;
2. question-specific grading page cache-boundary review;
3. question/rubric read-model reuse;
4. submission export internals;
5. assessment completion and overview semantics;
6. app shell decomposition;
7. numeric rubric editing.

The recurring problem is still mixed responsibility, but the concrete instances have changed. The question and assessment splits deliberately deferred ADR 0002 compliance so that the files could first be split by responsibility inside `src/db`; that relocation has since landed, so future splitting now happens in the owning feature folder rather than under `src/db`. The remaining seams below are about local responsibility boundaries inside those owners, not ownership.

## Status at a glance

This table is the single source of truth for each finding's status. The per-finding "Current status" sections defer to it and carry the explanation rather than restating the verdict, so status only has to be updated here.

| Finding | Status | Tracked in |
|---|---|---|
| 1. Project route context and slug handling | Resolved | ADR 0005, #141 |
| 2. Project-scoped pages repeat route resolution | Resolved | ADR 0005 |
| 3. Submission overview assessment loading too fragmented | Resolved | #145; Priority 1 |
| 4. Question-specific grading page cache boundaries | Open (review) | Priority 5, #59 |
| 5. Question definition persistence split and relocated | Resolved | ADR 0002, #137 |
| 6. Assessment reads and writes split and relocated | Resolved | ADR 0002, #137; follow-up Priority 4 |
| 7. Raw database types versus feature-facing types | Largely resolved | ADR 0002, #137 |
| 8. Question/rubric read-model assembly duplicated | Open | Priority 6 |
| 9. Assessment completion semantics duplicated | Open | Priority 8 |
| 10. Export submissions state machine needs smaller seams | Open | Priority 7 |
| 11. Import parse/prepare/write seams | Resolved | [design](../design/2026-06-10-import-parse-prepare-write-seams.md), `plans/completed/2026-06-10-import-parse-prepare-write-seams.md`, #146, #147 |
| 12. App shell navigation mixes concerns | Open | Priority 9 |
| 13. Numeric rubric editing parses too eagerly | Open | Priority 10, #68 |
| 14. Grading clients duplicate workflow behavior | Open (partial reuse exists) | Finding body |
| 15. Server action contract boundaries | Open | Finding body |
| 16. Cache tags and invalidation scattered | Open | Finding body |
| 17. `shared` bucket renamed to `src/ui` | Resolved | #137 |
| 18. Route handlers thinner; export internals remain | Partial | Priority 7 |
| 19. Reasonably split components — do not over-refactor | Guidance | — |
| 20. File reorganization establishes ownership | Resolved | ADR 0002, #137 |

## Relationship to other investigations

This document focuses on concrete source-code structure and technical debt. It intentionally does not own terminology, product positioning, offline architecture, or final caching strategy.

See [the investigation overlap audit](./investigation-overlap-audit.md) for a fuller ownership map across ongoing investigations.

Important related documents:

- [Domain terminology audit](./domain-terminology-audit.md) owns naming decisions such as `Project` versus `Assignment`, `Assessment` versus `Grading`, and `Rubric` versus `Criterion`.
- [Assessment target model](./assessment-target-model.md) owns student/group/submission/assessment-target semantics.
- [Mark, grade and weighting model](./mark-grade-weighting-model.md) owns grading output semantics such as mark, grade, score, and weighting.
- [Grading workflows and product positioning](./grading-workflows-and-product-positioning.md) owns workflow and product-scope questions such as spreadsheet replacement, LMS integration, and explicit import/export operations.
- [Offline support](./offline-support.md) owns local storage, command outbox, sync, and conflict strategy questions.
- #59 should own final loading, caching, revalidation, and route-boundary strategy.

Folder names and target source shapes in this document are therefore provisional. They should be revisited if terminology or product-model investigations converge differently.

## Principles used in this audit

### Colocation is good, but reason-to-change matters

Files should be near the workflow or domain concept they support. Grouping files only because they are all `actions`, `repositories`, or `components` is not very useful.

Good colocation examples:

```txt
src/grading/saveAssessment.action.ts
src/grading/saveAssessment.ts
src/grading/assessmentRepository.ts
```

Less useful colocation:

```txt
src/server/actions/grading.ts
src/server/actions/import.ts
src/server/actions/questions.ts
```

Those files share a framework mechanism, not a product reason to change.

### Prefer flat modules first

For this project, deep folder structures are probably not needed yet. File suffixes can carry much of the structure:

```txt
*.action.ts       server-action boundary
*.repository.ts   Kysely/DB access
*.service.ts      orchestration when needed
*.types.ts        domain or DTO types
*.schema.ts       validation schemas
*.test.ts         colocated tests
```

Only introduce `domain/`, `server/`, or `ui/` subfolders inside a module when the module becomes too crowded.

### WET before DRY, but not forever

A WET-friendly approach is useful here: tolerate duplication until the abstraction is obvious. However, repeated logic that is already stable and domain-named should be extracted.

Likely acceptable temporary duplication:

- local UI layout differences;
- route-specific rendering choices;
- one-off labels or help content;
- cached server-component reads where the cache boundary is intentional.

Likely extraction candidates:

- submission overview assessment read models;
- question/rubric row assembly;
- assessment mutation internals, if current seams remain too broad;
- progress completion semantics;
- submission navigation and quick-jump behavior.

### Keep `app/` as routing and composition

Next route files should remain in `app/`. Plain path builders live in `src/projects/projectPaths.ts`.

### `src/db` is now database infrastructure only

ADR 0002 points toward `src/db` being database infrastructure only, with features owning their read models, write commands, domain types, and validation schemas. As of the 2026-06-02 source reorganization, that target state has been reached: feature persistence and read models now live in their owning feature folders, and `src/db` holds only `kysely.ts`, `generated/`, `migrations/`, `migrate.ts`, `cacheTags.ts`, `projectScope.ts`, and database integration tests.

For new work, do not add feature logic to `src/db`. Feature read models, write commands, validation, and domain/read-model types belong in the owning feature folder, which may call `src/db` infrastructure entry points. Remaining seam cleanup (read models, mutation internals, completion semantics) should happen in those feature folders.

## Finding 1: project route context and slug handling

### Current status

Status in the [status table](#status-at-a-glance).

Project path helpers have been renamed from `routes.ts` to `projectPaths.ts`. Project-scoped routes now have a layout-level existence gate, and the app shell receives the real project name instead of reconstructing it from the slug.

The slug-canonicalization mechanism is now implemented per ADR 0005 (which supersedes ADR 0001): the project-scoped layout mounts the `CosmeticSlugReplacement` client component (Option D below), which replaces a stale slug segment in place via `usePathname()` and `window.history.replaceState()`. The server-side `canonicalProjectRedirect` helper and its per-page calls have been removed. The options analysis below is retained for context.

### Current behavior

Project-scoped routes still use URLs shaped roughly like:

```txt
/projects/[projectId]/[projectSlug]/...
```

The slug is derived from the project name in TypeScript. This is intentional. The canonical project identity is the public project id; the slug is cosmetic and improves URL readability.

### Remaining concern

The per-page convention risk is resolved: slug correction now lives in the project-scoped layout, so new project-scoped pages inherit it automatically and cannot forget it.

This also scales to other entities that gain cosmetic slug segments, such as submissions (#136). For example, future routes could become shaped roughly like:

```txt
/projects/[projectId]/[projectSlug]/assessments/submissions/[submissionId]/[submissionSlug]/...
```

In that model, each slug-bearing layer mounts its own `CosmeticSlugReplacement` against its own `id`/`slug` segment pair, so no deep page has to remember any canonicalization step.

### Important constraint: slugs are cosmetic

Slug handling should not be treated as route correctness. The app must resolve projects, submissions, and other entities by their authoritative ids. Slugs must not affect lookup, authorization, cache identity, or rendered data.

A stale slug should therefore not produce a 404 and does not need to force a server redirect. It is an outdated readable label in the URL. Cleaning it up is useful for presentation, but the page is already correct if the id resolves the intended entity.

### Options considered

#### Option A: keep page-level canonicalization helpers

Keep the current `canonicalProjectRedirect` design. Each project-scoped page loads the project, passes the requested slug and a route kind to the helper, and the helper redirects to the canonical path when needed.

Pros:

- keeps canonicalization close to the data already loaded by the page;
- avoids Proxy and request-header plumbing;
- uses typed route kinds and `projectPaths.ts` builders instead of string-based path manipulation;
- has already fixed the main source of drift: duplicated redirect target construction.

Cons:

- new project-scoped pages can still forget to call the helper;
- the route-kind union must grow when new project-scoped route shapes are added;
- this becomes more awkward if other entities, such as submissions, also gain cosmetic slug segments;
- deep pages may need to remember several canonicalization calls, for example one for the project slug and one for the submission slug;
- server redirects add an extra request for a cosmetic URL correction.

This option is acceptable while project-scoped routes remain few and only projects have cosmetic slugs. It is less attractive if submission slugs are added.

#### Option B: proxy-level canonicalization

Move slug canonicalization to Next Proxy. For every matching project URL, Proxy parses the relevant id and slug segments, loads the canonical slug from the database, and redirects to the same path with stale slug segments replaced.

Pros:

- removes the per-page convention entirely;
- scales better to multiple cosmetic slug segments, such as project and submission slugs;
- matches the URL semantics: ids are authoritative, slugs are cosmetic, and canonicalization replaces stale cosmetic segments while preserving the rest of the path;
- avoids a growing route-kind enum for canonicalization;
- keeps pages focused on rendering and domain loading.

Cons:

- adds a database lookup before rendering project-scoped requests;
- the page or layout may still load the same project or submission afterward, unless additional sharing is introduced;
- on serverless deployments, Proxy and render code may not share the same database pool or cache instance;
- requires care with database pooling if deployed to Vercel or similar platforms;
- uses path-segment rewriting, which is less typed than the current `projectPaths.ts`-based helper;
- still performs a server redirect for a cosmetic URL correction.

This option is the cleanest centralized server-side model if cosmetic slugs become a general routing pattern, but it may be heavier than needed while slugs remain purely cosmetic.

#### Option C: Proxy passes the pathname to layouts

Use Proxy only to pass the current pathname to the application, for example through an internal request header. The project layout still loads the project, compares the requested slug with the canonical slug, and redirects by replacing the stale slug segment in the full pathname.

Pros:

- avoids database access in Proxy;
- keeps project loading in the normal layout or render layer;
- removes the need for each page to reconstruct its canonical route;
- can preserve deep paths without the layout knowing route-specific params such as `submissionId` or `questionId`.

Cons:

- introduces internal request-header plumbing;
- couples layout canonicalization to Proxy behavior;
- requires fallback behavior if the header is missing;
- still relies on string-based path-segment replacement;
- is unreliable as a primary mechanism during client-side navigation if the relevant layout is already mounted and reused;
- feels more indirect than doing the redirect directly in Proxy.

This option is not recommended as the primary mechanism. It tries to compensate for the fact that server layouts cannot access the current pathname, but layouts are intentionally reused across client-side navigations, so layout-level redirect logic can become stale.

#### Option D: client-side cosmetic pathname replacement

Stop treating stale slugs as server redirect targets. Instead, resolve and render by id, then inject a small Client Component from the relevant layout to replace stale cosmetic URL segments in the current history entry.

For project routes, the project layout can load the project by id and render a client component with the canonical project slug. The client component uses `usePathname()` and `window.history.replaceState()` to replace only the cosmetic project slug segment when it differs from the canonical slug. Future submission layouts could do the same for submission slugs.

Pros:

- removes the per-page convention;
- avoids Proxy;
- avoids server redirects and extra navigation requests;
- avoids duplicate database reads before rendering;
- keeps canonical data loading in layouts;
- works well with the fact that slugs are cosmetic and ids are authoritative;
- scales to additional cosmetic slug segments by adding layout-level cosmetic replacement components;
- uses `replaceState`, so it does not add a new browser history entry.

Cons:

- the initial server response is still served under the stale URL;
- the browser may still remember a stale URL in its global history or autocomplete;
- the cleanup depends on client JavaScript and hydration;
- this is only acceptable while slugs remain cosmetic;
- care is needed if several active layout components replace different slug segments in the same pathname.

This option fits the current semantics best if stale slugs are only an address-bar presentation issue.

### Rejected direction: store `project.slug`

Do not store the project slug in the database.

The slug is cosmetic. The canonical project identity is the public project id. The slug exists only to make URLs and filenames more readable, and it can be derived from the project name when needed. Persisting it would make a cosmetic value look like domain state, add migration and backfill work, and force policy decisions around rename behavior that the app does not currently need.

The same principle should apply to future submission slugs unless a separate investigation identifies a domain reason to persist them.

### Recommendation

Keep the current identity model:

1. public project id is the canonical route identity;
2. slug is derived from project name;
3. the slug is cosmetic and must not affect lookup, authorization, cache identity, or rendered data;
4. `projectPaths.ts` remains the sole source of URL string construction.

Replace server-side stale-slug redirects with layout-injected client-side cosmetic pathname replacement.

The intended direction is:

1. server layouts resolve entities by authoritative id;
2. layouts pass canonical cosmetic slug values to small Client Components;
3. those Client Components use `usePathname()` and the browser History API to replace stale slug segments in the current pathname without triggering navigation;
4. pages no longer call slug canonicalization helpers directly.

This avoids Proxy, avoids extra requests, avoids per-page redirect helpers, and keeps slug handling aligned with the fact that slugs are cosmetic. It also scales better if submissions later gain cosmetic slug segments: each slug-bearing layout can clean up its own URL segment after resolving the entity by id.

This approach is only valid while slugs remain cosmetic. If a slug ever becomes semantic, for example if it affects lookup, authorization, cache identity, sharing semantics, or rendered data, canonicalization should move back to a server-side mechanism.

## Finding 2: project-scoped pages repeat route resolution

### Current status

Status in the [status table](#status-at-a-glance).

The original audit observed that most project-scoped pages repeated project existence checks, null handling, slug comparison, and redirect target construction. That is no longer the current state: existence gating and slug correction are both owned by the project-scoped layout, so pages no longer repeat either concern.

### Current behavior

The project-scoped layout now owns user-facing project existence checks. Project pages can use `loadProjectByPublicId(projectId, { required: true })` when they need project data after the layout has already gated the route.

Slug correction is no longer page-level at all. The project-scoped layout mounts the `CosmeticSlugReplacement` client component once (ADR 0005), so pages no longer declare a route kind or call any slug helper.

### Remaining concern

None for slug handling: because correction is owned by the layout, a brand-new project-scoped page inherits it automatically and cannot forget it.

### Recommendation

Resolved by ADR 0005. No broader project route-context rewrite is needed.

## Finding 3: submission overview assessment loading is too fragmented

### Current status

Status in the [status table](#status-at-a-glance).

`loadSubmissionAssessments` (#145) returns every question's rubric values for a submission in one query, keyed by Question ID. The submission overview page now loads project context, submissions, the question grid, submission overview progress, and this single assessments map in parallel via `Promise.all`, then attaches each question's values to its rubrics. The original behavior and candidate rewrite below are kept for context.

### Original behavior

The submission overview page loaded project context, submissions, the question grid, submission overview progress, then one assessment load per question. The page mapped questions to `loadAssessment(submissionId, questionId)` calls and attached each result to the corresponding rubrics.

### Why this mattered

The page is naturally a submission-level read model: it needs all questions and all rubric assessment values for one submission. Loading each question assessment separately was conceptually backwards for this route.

Potential costs:

- unnecessary DB round trips;
- more complicated cache behavior;
- page code does data assembly that belongs in a loader;
- harder tests for the full submission overview state;
- slower navigation between submissions.

### Implemented direction

`src/assessments/assessments.ts` now exposes:

- `loadQuestionAssessment` (renamed from `loadAssessment`): a single submission/question's rubric values, scoped by Project ID;
- `loadSubmissionAssessments`: every question's rubric values for a submission, scoped by Project ID, returned as a `Record<questionId, AssessmentRubricValue[]>`.

Both share row-loading and rubric-value mapping helpers. `assessmentCacheTag` (in `src/db/cacheTags.ts`) now takes an optional `{ submissionId, questionId }` scope, and `saveAssessment` invalidates the question, submission, and coarse `assessments:all` tags.

### Tests added

- submission with no assessments;
- mixed rubric types;
- project isolation: a mismatched Project ID returns no data.

## Finding 4: question-specific grading page cache boundaries need review

### Current behavior

The question-specific grading page splits loading across cached server component sections. These sections intentionally have overlapping data needs.

The page needs project context, question definition, current submission, all submissions for navigation, current assessment values, and progress by submission.

### Why this matters

This page is core grading UX. Its data requirements should remain clear, but repeated cached reads are not automatically technical debt in a Next.js app. In some cases, colocating reads with cached server sections is the intended model and trying to dedupe everything into one loader can fight framework boundaries.

### Candidate review

Before rewriting this page, check the relevant caching and page-boundary plans. The question should be:

```txt
Are the current cached server sections the intended boundary?
```

not:

```txt
Can every repeated read be deduplicated manually?
```

Extract a loader only if it clarifies semantics without hiding cache behavior, reduces real query duplication not handled by cache, gives a better test seam for the full page model, and does not collapse useful cache boundaries.

## Finding 5: question definition persistence has been split and relocated

### Current status

Status in the [status table](#status-at-a-glance).

The original audit described `src/db/questions.ts` as an overgrown mixed-responsibility module. Question definition reads and mutations were first split, then relocated into `src/questions` during the 2026-06-02 source reorganization, satisfying ADR 0002.

### Current structure

Question persistence now lives in the feature folder alongside its UI-facing schemas, actions, and types:

```txt
src/questions/questions.ts
src/questions/questionDefinitions.ts
src/questions/questionDefinitionMutations.ts
src/questions/types.ts
src/questions/schemas.ts
src/questions/actions.ts
```

The seams are:

- `questions.ts` owns general question/rubric read models;
- `questionDefinitions.ts` owns management-facing question definition reads;
- `questionDefinitionMutations.ts` owns save/delete/reorder mutations;
- the rest of `src/questions/*` owns UI-facing schemas, actions, and management UI.

### Recommendation

The ownership relocation is done. The only remaining follow-up is to review the current question-definition split after a few changes have landed, and split further inside `src/questions` only if review or test pain justifies it.

## Finding 6: assessment reads and writes have been split and relocated

### Current status

Status in the [status table](#status-at-a-glance).

The original audit described `src/db/assessments.ts` as mixing assessment loading, validation, persistence, command semantics, transaction support, and cache invalidation. Assessment reads and writes were first split, then relocated into `src/assessments` during the 2026-06-02 source reorganization.

### Current behavior

Assessment persistence now lives in the feature folder: `src/assessments/assessments.ts` (reads), `src/assessments/assessmentMutations.ts` (writes), plus `assessmentsProgress.ts`, `submissionProgress.ts`, `rubricOverview.ts`, `rubricOverviewBuilder.ts`, `assessmentSummary.ts`, and `types.ts`. Assessment reads live separately from assessment mutations, and the mutation path supports both standalone saves and caller-supplied transactions, which is needed by assessment import.

### Remaining concern

Ownership is now correct. Any further internal split of the mutation path — validation, user-facing error messages, row upsert, subtype-specific writes, transaction handling, cache invalidation after standalone writes — should be done inside `src/assessments` and driven by actual review pain or test difficulty, not by a blanket rule that every command needs several files. See Priority 4.

### Transaction API requirement

The existing transaction-friendly API is the right direction. Preserve the rule that cache invalidation does not run inside a caller-owned transaction. The transaction owner should invalidate after commit.

## Finding 7: clarify raw database types versus feature-facing types

### Current status

Status in the [status table](#status-at-a-glance).

`src/db/types.ts` previously mixed generated-database-adjacent types, persistence projections, feature-facing read models, and UI/action/import/export contracts. During the 2026-06-02 source reorganization, every feature-facing type was moved into its owning feature folder (`src/submissions/types.ts`, `src/questions/types.ts`, `src/assessments/types.ts`, `src/rubrics/types.ts`), and `src/db/types.ts` was deleted with no re-export shim. `RubricType` is now a local literal union in `src/rubrics` rather than a re-export of the generated enum, so `src/rubrics` no longer depends on `src/db/generated/db.ts`. The decision direction below remains the standing rule for new types.

### Decision direction

Keep `src/db/generated/db.ts` private to the database infrastructure layer. Do not turn it into a general feature import surface, and do not add a thin facade that simply re-exports the same generated schema under another name.

Feature modules should derive their public types from explicit read models and query mappers rather than exposing raw generated row shapes. This keeps internal columns such as `row_id`, nullable storage details, and join artifacts from becoming user-facing contracts.

### Why this matters

ADR 0002 still points toward feature-owned persistence, but that does not require UI, action, import/export, or route code to depend on generated database row types. Feature persistence can remain implementation detail: it may call DB helpers, perform Kysely queries through infrastructure-owned entry points, and map results into explicit feature-facing types before returning them.

The important boundary is:

```txt
raw generated schema / row ids / storage nullability
  -> persistence-internal code only

explicit feature read models / DTOs / action states
  -> feature, UI, route, import, export code
```

### Recommendation

Use explicit feature-facing types and read models at module boundaries. Derive them from the query implementation when useful, but do not expose raw generated row types outside persistence-internal code.

For example:

```txt
src/questions/types.ts
src/questions/questionDefinitions.ts
src/questions/questionDefinitionMutations.ts

src/assessments/types.ts
src/assessments/assessments.ts
src/assessments/assessmentMutations.ts
```

The persistence code may use generated types internally, but the exported API should return question definitions, assessment read models, submission summaries, or action results, not generated table rows. If a type contains `row_id`, it should normally be persistence-internal.

### Migration approach

This migration is complete: the feature-facing types that lived in `src/db/types.ts` now live in their owning feature folders, and the file was deleted. The standing rule for new code is to keep generated database types and internal row/projection helpers inside `src/db`, derive explicit feature-facing read-model types in the owning feature, and avoid creating a thin schema facade unless a concrete problem appears that cannot be solved with the direct infrastructure imports already available.

## Finding 8: question and rubric read-model assembly is duplicated

### Current behavior

Question/rubric loading appears in multiple places:

- general question/rubric reads assemble questions, rubrics, and subtype data;
- export submission planning loads a similar structure;
- rubric overview loads questions and then assessment records;
- import assessment preparation loads rubric metadata for parsing.

Some duplication is expected because these flows need different projections. However, the multi-table rubric assembly logic is domain-stable and repeated enough to deserve a shared seam.

### Candidate direction

Introduce a canonical question/rubric read model loader or row assembly helper. With the ADR 0002 relocation landed, place this under the relevant feature ownership (for example `src/questions` or `src/rubrics`) rather than in `src/db`.

Export-specific code can transform the canonical grid into an export plan. Import-specific code can transform it into recognized assessment columns.

### Caution

Do not force every consumer to share one giant type. The shared piece should be the stable source data and rubric assembly. Workflow-specific projections should remain workflow-specific.

## Finding 9: assessment completion semantics are duplicated across projections

### Current behavior

Several pages compute related completion or summary metrics over assessment state:

- completion grouped by submission;
- completion grouped by question;
- project-level assessment completion;
- rubric overview analytics;
- shared assessment summary helpers.

These metrics are about assessment state. In the current app, assessment mostly means recorded grading values, but the term is broader than grading and may later encompass feedback or other evaluator-provided information. Submission, question, and project are grouping dimensions, not owners of the progress itself.

### Why this matters

Completion semantics are business logic. If different pages compute them differently, the dashboard, assessment list, submission overview, and question-by-question assessment pages can disagree.

The naming should avoid implying that a submission “has progress”. A submission is the assessed artifact. Completion is derived from assessment records and grouped by submission, question, or project depending on the view.

### Candidate direction

Create or document a shared assessment-completion model, then expose view-specific read models:

```txt
src/assessments/assessmentSummary.ts
src/assessments/assessmentCompletion.ts
src/assessments/loadCompletionBySubmission.ts
src/assessments/loadCompletionByQuestion.ts
src/assessments/loadProjectAssessmentCompletion.ts
```

This consolidation now belongs in `src/assessments` because progress logic is feature logic, not database infrastructure; the ADR 0002 relocation that gated it has landed.

## Finding 10: export submissions is a correctness-sensitive state machine that needs smaller seams

### Current behavior

Submission export asserts submission invariants, loads an export question plan, builds headers, streams joined DB rows, groups rows by submission, maps DB subtype values to assessment values, attaches assessments to rubrics, and builds CSV rows.

Streaming is reasonable, but the state machine should be independently testable.

### Candidate split

```txt
src/export/submissionExportOptions.ts
src/export/submissionExportPlan.ts
src/export/submissionAssessmentRows.ts
src/export/groupSubmissionRows.ts
src/export/submissionExportCsv.ts
src/export/submissionExport.ts
```

### Tests to add

- stream boundary occurs exactly at submission changes;
- last submission flushes correctly;
- submission with no assessments still exports;
- sparse assessment values export as empty cells;
- mixed rubric types export correctly;
- ordering is stable;
- include options affect headers and rows consistently;
- marks-only exports are not accidentally importable as assessment values unless explicitly supported.

## Finding 11: import flows should expose parse, prepare, and write seams

### Current status

Status in the [status table](#status-at-a-glance).

Decisions are captured in [Import parse, prepare, and write seams](../design/2026-06-10-import-parse-prepare-write-seams.md); delivery is tracked in `plans/completed/2026-06-10-import-parse-prepare-write-seams.md` (#146, #147). The original finding and candidate rewrite below are kept for context.

### Current behavior

All three import flows (assessments, questions, students) follow the same `parse -> load context -> prepare -> write` seam:

```txt
src/import/assessmentImportContext.ts    loadAssessmentImportContextFromDb()
src/import/prepareAssessmentImport.ts    AssessmentImportPlan + prepareAssessmentImport()  [pure]
src/import/saveAssessments.ts            saveAssessmentImportPlanInDb() + saveAssessments() wrapper

src/import/questionImportContext.ts      loadQuestionImportContextFromDb()
src/import/prepareQuestionImport.ts      QuestionImportPlan + prepareQuestionImport()  [pure]
src/import/saveQuestions.ts              saveQuestionImportPlanInDb() + saveQuestions() wrapper

src/import/studentImportContext.ts       loadStudentImportContextFromDb()
src/import/prepareStudentImport.ts       StudentImportPlan + prepareStudentImport()  [pure]
src/import/saveStudents.ts               saveStudentImportPlanInDb() + saveStudents() wrapper
```

Each app-level wrapper opens one transaction wrapping load context → prepare → write, so a plan can never go stale between prepare and write. The pure `prepare…Import` functions are unit-tested directly; context loaders and write primitives are exercised through the wrapper's integration tests.

Behavior changes delivered alongside the restructure:

- assessment import: unmatched submissions now block the whole import (previously silently skipped); overwrites are detected and the success message reports the overwrite count;
- question import: a rubric type change blocks if linked assessments exist (previously silently deleted and recreated, cascading away assessments); type changes with no linked assessments proceed and are reported in the plan;
- student import: the plan distinguishes created vs updated students/submissions and reports team membership changes; no blocking diagnostics in this flow.

### Why this mattered

Silent skips were dangerous for assessment data, and silent rubric-type changes could cascade-delete assessments. Splitting parse/prepare/write gave each flow a pure, unit-testable preparation stage and a place to surface blocking diagnostics, ignored columns, and overwrite/created/updated information.

### Remaining follow-up

Preview UI and configurable import policies (for example, whether missing submissions should be configurable rather than always-blocking) are deferred to the import/product workflow investigation; they were intentionally not built as part of this restructure.

## Finding 12: app shell navigation mixes route parsing, navigation structure, local storage, and export behavior

### Current behavior

The app shell drawer parses project route context from `usePathname`, builds navigation items, owns export options local storage, builds export submission URL query parameters, and renders import/export/project navigation sections.

The previous slug-to-display-name concern is resolved: the shell now receives the real project name from the project-scoped layout.

### Candidate split

```txt
src/ui/AppShell.tsx
src/ui/AppShellTopBar.tsx
src/ui/AppShellDrawer.tsx
src/ui/projectRouteContext.ts
src/ui/projectNavigationItems.ts
src/ui/ExportOptionsPanel.tsx
src/ui/useExportOptions.ts
```

Do not over-design the shell too early. The split becomes more useful if navigation or export options grow further.

## Finding 13: numeric rubric editing parses too eagerly

### Current behavior

The rubric editor has historically used numeric fields that parse too eagerly. This can break natural intermediate states such as `-`, `-0`, `1.`, and `0.`.

### Candidate rewrite

Introduce a string-backed numeric draft component:

```txt
src/ui/NumericDraftField.tsx
```

or colocated under questions/rubrics if only used there at first.

Behavior:

- store draft text while focused;
- allow intermediate states;
- parse on blur or submit;
- show validation without rewriting text too early;
- preserve numeric value type in the submitted payload.

## Finding 14: grading clients duplicate stable workflow behavior

### Current behavior

The question-by-question grading client and the submission-overview grading client both handle current submission lookup, previous/next submission navigation, quick-jump dialog state, keyboard shortcut for lookup, optimistic save state, save-error shaping, and submission label lookup.

Some reuse already exists through `useAssessmentSession`, which is good. But more duplication appears stable enough to extract.

### Candidate extractions

```txt
src/assessments/useSubmissionQuickJumpShortcut.ts
src/assessments/SubmissionNavigation.tsx
src/assessments/useCurrentSubmission.ts
src/assessments/buildSaveErrorContext.ts
```

Do not abstract the whole grading client into one mega-component. The overview-by-submission and question-by-question UIs are different. Extract the repeated workflow pieces only.

## Finding 15: server actions are colocated with workflows, but their contracts need clearer boundaries

### Current behavior

Question actions are close to question UI and schemas. Assessment/import actions use shared import error utilities. This is mostly good colocation.

The problem is that action contracts are not always explicit enough. Some actions return user-facing states, some thinly delegate to DB functions, and some rely on route/page refresh patterns.

### Candidate direction

Keep actions near their workflow, but make a consistent action pattern:

```txt
parse form/input
call command/service or mutation
map domain/application errors to action state
return typed action result
```

Avoid putting heavy business logic directly in actions. Avoid actions delegating straight into functions whose contracts are unclear.

## Finding 16: cache tags and invalidation are useful but scattered

### Current behavior

There is a cache tag helper module. Loaders use tags such as projects, questions, submissions, assessments, and question-scoped assessment tags. Mutations update tags.

This is a good foundation. The problem is that invalidation policy is spread across DB modules and actions rather than documented as a map.

### Candidate direction

Keep cache helper modules visible to write paths and document mutation-to-tag behavior. `cacheTags.ts` stayed in `src/db` after the ADR 0002 relocation and may remain infrastructure-adjacent, but feature commands should be explicit about which cache policy they invoke.

Potential map:

```txt
save assessment
  -> assessment(submission, question)
  -> assessment question progress(question)
  -> assessments aggregate

import assessments
  -> assessments:all
  -> assessments aggregate
  -> dashboard/overview relevant tags

save question definition
  -> questions
  -> assessments aggregate
  -> question-specific assessment tags

import students/submissions
  -> submissions
  -> progress and dashboard tags
```

## Finding 17: `shared` bucket renamed to `src/ui`

### Current status

Status in the [status table](#status-at-a-glance).

During the 2026-06-02 source reorganization, `src/shared` was renamed to a flat `src/ui`. The flatter shape was chosen over nested technical subfolders:

```txt
src/ui/AppShell.tsx
src/ui/AppShellDrawerContent.tsx
src/ui/AppShellTopBar.tsx
src/ui/AppShellNavigationShell.tsx
src/ui/SaveErrorsProvider.tsx
src/ui/SaveErrorsDisplay.tsx
src/ui/CodeSnippet.tsx
src/ui/MuiNextLink.tsx
src/ui/shiki-setup.ts
```

App shell decomposition (Finding 12) remains open, but the ownership bucket is no longer overly broad.

## Finding 18: route handlers are thinner; export internals remain the main split candidate

### Current behavior

Export route handlers are thinner than in the original audit. They mostly load project context, parse request options, call export creation helpers, and build response headers/filenames.

The larger concern now lives in export internals, especially submission export streaming and row grouping.

### Candidate split

Consider route-support helpers only after export semantics are clearer:

```txt
src/export/http.ts
src/export/filenames.ts
```

Possible helpers:

```ts
csvStreamResponse({ filename, stream })
yamlDownloadResponse({ filename, body })
buildDatedFilename({ prefix, slug, extension })
```

The export state machine is the more important rewrite.
## Finding 19: several components are reasonably split and should not be over-refactored

Not everything needs rewriting or relocation.

Examples that look reasonably scoped:

- RubricEditorList dispatches to rubric-type-specific editor components and owns list operations;
- QuestionForm mostly coordinates draft state, payload creation, errors, and form submission;
- type-specific rubric editor components are small;
- BaseImportForm is a reusable UI shell rather than a correctness-critical mixed persistence module.

The goal should be to split overloaded correctness-sensitive modules first, not to maximize the number of files. Some files are slightly broad but still locally understandable. These should not be reorganized only to satisfy a target tree.

This matters because source reorganization and file splitting are different operations:

- reorganization changes ownership and import direction;
- splitting changes local responsibility boundaries inside an owner.

A file can be in the right place but need splitting later. A file can also be internally acceptable but live in the wrong ownership folder. The audit should keep these concerns separate so that future work does not combine behavior-preserving moves, responsibility splits, and product changes in the same PR.

## Finding 20: file reorganization should establish ownership before further splitting

### Current status

Status in the [status table](#status-at-a-glance). Tracked and executed in `plans/completed/2026-06-02-source-reorganization.md`.

The behavior-preserving relocation described below has landed: project, submission, question, and assessment persistence and read models moved out of `src/db` into their owning feature folders, feature-facing types moved out of `src/db/types.ts` (which was deleted), and `src/shared` was renamed to `src/ui`. `src/db` is now database infrastructure only. The original finding and candidate direction are kept below for historical context.

### Original behavior

Some files lived in folders that reflected historical placement rather than ownership. The most important example was `src/db`: it contained feature-specific persistence and read-model code, even though ADR 0002 defines `src/db` as database infrastructure only.

This affected projects as well as questions and assessments. For example, project loading and creation lived under `src/db`, but they included project-specific behavior such as public-id generation, project summary mapping, slug derivation, and cache invalidation. That is project persistence, not database infrastructure.

### Why this mattered

Future splitting work should happen in the right ownership location. If overburdened files are split while they remain under `src/db`, the result may be cleaner locally but still structurally wrong. It can also make the later ADR 0002 relocation harder because there will be more files to move and more import paths to rewrite.

The reorganization therefore prioritized behavior-preserving file relocation before further fine-grained splitting, especially for feature persistence that lived under `src/db`.

### Relationship to ADR 0002

ADR 0002 is the reference for the target ownership boundary:

```txt
src/db/
  kysely.ts
  generated/
  migrations/
  cacheTags.ts
```

Feature-specific read models, write commands, validation, domain/read-model types, and user-facing errors should live in the owning feature folder.

This investigation should remain the practical migration reference for applying ADR 0002 across the current source tree. It can decide sequencing and concrete file moves, while ADR 0002 defines the direction.

### Candidate direction

Move feature persistence to owner folders with minimal behavior change before doing deeper splits.

Possible target shape:

```txt
src/
  projects/
    projects.ts
    projectPaths.ts
    canonicalProjectRedirect.ts

  submissions/
    submissions.ts
    types.ts
    getSubmissionLabel.ts
    quickJumpSearch.ts

  questions/
    questions.ts
    questionDefinitions.ts
    questionDefinitionMutations.ts
    types.ts
    schemas.ts
    actions.ts

  assessment/
    assessments.ts
    assessmentMutations.ts
    assessmentsProgress.ts
    submissionProgress.ts
    rubricOverview.ts
    rubricOverviewBuilder.ts
    assessmentSummary.ts

  db/
    kysely.ts
    generated/
    migrations/
    migrate.ts
    cacheTags.ts
    projectScope.ts
```

This keeps the structure flat. It does not require immediately introducing `repository`, `service`, or nested technical folders. Those can be added later only where local complexity justifies them.

Note: this historical target shape predates ADR 0005. The relocation as landed uses `src/assessments` (not `src/assessment`) and does not include `canonicalProjectRedirect.ts`, which was removed in favor of client-side `CosmeticSlugReplacement`.

### Suggested sequencing

1. Move project persistence out of `src/db` into `src/projects`.
2. Move question and question-definition persistence out of `src/db` into `src/questions`.
3. Move assessment reads and mutations out of `src/db` into `src/assessment`.
4. Keep `src/db` focused on Kysely setup, generated DB types, migrations, and cache-tag infrastructure.
5. After the moves, reassess which files still need internal splitting.

### Caution

These moves should be behavior-preserving. Avoid combining relocation with query rewrites, new abstractions, import-preview UI, terminology changes, or cache-policy changes unless the change is required to preserve behavior.

The immediate value is to make ownership match ADR 0002 so that future splitting happens in the right place.

## Prioritized rewrite backlog

This is the single actionable list for the open findings. It carries the sequencing the [status table](#status-at-a-glance) does not, and each entry's `Related` line is where it can be split out from #115 into a smaller implementation issue if that is useful. When an item is actively picked up, create a dated `plans/active/` plan for it (as the resolved findings already did) rather than tracking execution detail here.

### Priority 1: submission overview assessment read model — Done

Completed 2026-06-10 in #145.

Delivered:

- added `loadSubmissionAssessments`, returning every question's rubric values for a submission in one query, keyed by Question ID;
- replaced the per-question `loadAssessment` calls on the submission overview page with a single `loadSubmissionAssessments` call, loaded in parallel with project, submissions, question grid, and progress via `Promise.all`;
- scoped both `loadQuestionAssessment` (renamed from `loadAssessment`) and `loadSubmissionAssessments` by Project ID;
- extended `assessmentCacheTag` to a nested submission/question scope and had `saveAssessment` invalidate all three levels;
- added integration tests for mixed rubric types and project isolation.

Related: #59, #115, #145.

### Priority 2: assessment import parse/prepare/write boundaries — Done

Completed 2026-06-10 in #146 (assessments), #147 (questions), and the student import restructure (`plans/completed/2026-06-10-import-parse-prepare-write-seams.md`).

Delivered:

- split all three import flows (assessments, questions, students) into `parse -> load context -> prepare -> write`, with a pure `prepare…Import` function per flow returning a structured `…ImportPlan`;
- assessment import: unmatched submissions now block the import (previously silently skipped), and overwrites are detected and reported in the success message;
- question import: rubric type changes with linked assessments now block (previously silently deleted and recreated), naming the rubric and assessment count;
- student import: plan distinguishes created vs updated students/submissions and reports team membership changes;
- each wrapper opens one transaction wrapping load context → prepare → write;
- preview UI and configurable policies remain deferred to the import/product workflow investigation.

Related: [design](../design/2026-06-10-import-parse-prepare-write-seams.md), #110, #115.

### Priority 3: ADR 0002 source reorganization — Done

Completed 2026-06-02 in `plans/completed/2026-06-02-source-reorganization.md`.

Delivered:

- moved project persistence from `src/db` to `src/projects`;
- moved submission persistence and read models from `src/db` to `src/submissions`;
- moved question and question-definition persistence from `src/db` to `src/questions`;
- moved assessment reads, mutations, completion/progress, and overview read models from `src/db` to `src/assessments`;
- moved feature-facing types out of `src/db/types.ts` and deleted the file;
- renamed `src/shared` to a flat `src/ui`;
- kept all moves behavior-preserving;
- `src/db` is now Kysely setup, generated DB types, migrations, cache-tag infrastructure, and low-level database plumbing only.

The remaining priorities below are the local seam cleanups that this reorganization unblocked.

Related: ADR 0002, #115, `plans/completed/2026-06-02-source-reorganization.md`.

### Priority 4: assessment mutation internal split, if still needed

Why fourth:

- central write path;
- shared by interactive grading and imports;
- current read/write split and transaction-friendly API have resolved part of the old finding.

Suggested deliverables:

- review current `assessmentMutations` after the completed split;
- split validation/errors/repository helpers only if that improves tests or reviewability;
- do any split in the feature-owned location (`src/assessments`), since the ADR 0002 relocation has landed;
- preserve caller-owned transaction behavior and post-commit invalidation.

Related: reliability audit, #115.

### Priority 5: question-specific grading page cache-boundary review

Why fifth:

- core grading UX;
- current split may be correct under Next caching;
- avoid refactoring only to dedupe cached reads.

Suggested deliverables:

- check relevant caching plans and #59;
- document intended boundaries and which repeated cached reads are intentional;
- only extract a loader if it clarifies semantics without fighting cache boundaries.

Related: #59, #115.

### Priority 6: question/rubric read-model reuse

Why sixth:

- repeated multi-table assembly remains;
- useful for import/export consistency;
- less urgent now that question definition persistence has been split.

Suggested deliverables:

- identify the stable shared source data;
- reduce duplicated subtype assembly in read/export/import flows;
- avoid one giant cross-workflow type and let import/export keep workflow-specific projections.

Related: #115.

### Priority 7: submission export state-machine split

Why seventh:

- correctness-sensitive;
- splitting will make future export work safer;
- route handlers are already reasonably thin.

Suggested deliverables:

- split stream row grouping from CSV formatting;
- add tests for stream boundaries, sparse assessments, and ordering;
- keep response helper extraction secondary.

Related: reliability audit, #115.

### Priority 8: progress/read-model consolidation

Why eighth:

- repeated business semantics;
- important for consistency;
- interacts with caching audit #59.

Suggested deliverables:

- document completed-question/completed-rubric semantics;
- extract or align pure builders, building on existing summary helpers;
- align dashboard/list/overview calculations.

Related: #59, #115.

### Priority 9: app shell split

Why ninth:

- improves DX but not central correctness;
- slug-derived display name concern is already resolved;
- can be mechanical.

Suggested deliverables:

- extract export options hook/panel;
- extract navigation item builder;
- keep the resulting files flat in `src/ui`.

Related: #115.

### Priority 10: numeric draft field

Why tenth:

- small focused UX win;
- low risk;
- addresses #68.

Suggested deliverables:

- add `NumericDraftField` (string-backed numeric draft);
- replace eager numeric parsing in rubric fields;
- add regression tests for intermediate input states.

Related: #68.

## Open questions

### Source reorganization sequencing — resolved

Settled by the 2026-06-02 reorganization, delivered as a single PR (#137) of sequential behavior-preserving commits:

- project and submission persistence moved first, then question persistence, then assessment persistence, then shared UI (`src/shared` -> `src/ui`) — one commit per step.
- `src/db/types.ts` was emptied as feature-facing types moved into feature folders, then deleted in the same pass — no long-lived re-export shim.
- `cacheTags.ts` and `projectScope.ts` stayed in `src/db` as infrastructure-adjacent helpers. Whether feature commands should eventually own more explicit cache-policy helpers is still open (see Finding 16); whether `projectScope.ts` should move if it becomes feature-specific remains a watch item.

### Project slugs

- Current decision: slugs are cosmetic and should not be stored in the database.
- Should slugs update automatically when names change? Current implied behavior is yes because the slug is derived from name.
- How are stale slugs corrected? Resolved by ADR 0005 (#141): the project-scoped layout replaces a stale slug segment client-side via `CosmeticSlugReplacement`; there is no longer a server-side redirect.
- Should filenames use project slug, project id, or project name?

### Project identifiers

- Resolved by #51: `project.id` is the public id and `project.row_id` is the internal id.
- Route params should continue using public `project.id`.

### ADR 0002 relocation — resolved

- Question and assessment persistence were relocated out of `src/db` in sequential behavior-preserving commits within a single PR (#137), with domain/read-model types moving alongside their read/write modules.
- All cache-tag helpers (`cacheTags.ts`) stayed in `src/db` for now. Which feature commands should own their cache-policy calls is still open and tracked under Finding 16.

### Raw database types and feature-facing types

- How strict should the private boundary around `src/db/generated/db.ts` be enforced?
- Which persistence-internal helper types, if any, are allowed to leave `src/db`?
- Should feature read-model types be explicit definitions, inferred from loader return types, or a mix of both?
- How should tests guard against `row_id` leaking into UI/action/import/export contracts?

### Read models and cache boundaries

- Should grading page loaders return UI-ready models, or should cached server sections assemble local models?
- Which repeated reads are real problems, and which are acceptable cached boundaries?
- How much should loaders know about cache tags?

### Commands and transactions

- Current direction: mutation functions may accept an optional transaction object when needed.
- Caller-owned transactions must own post-commit cache invalidation.
- Should repositories expose factory functions bound to a transaction, or is optional `db` enough for now?

### Cache invalidation

- Should invalidation live inside standalone mutations, repositories, or separate cache-policy functions?
- How can cache policy remain visible during review?
- Which pages must be fresh immediately after each mutation?

### Import behavior

- Which import warnings should block writes, and which should remain non-blocking?
- Should missing submissions block assessment import?
- Should import preview be mandatory? This is a product/UI question, not a source-structure requirement.
- Should import support marks-only CSV columns or only assessment-value columns?
- Should imports overwrite existing assessments by default?

### Folder structure

- ADR 0002 compliance is now met: the relocation landed on 2026-06-02 as a single PR (#137), with UI-only shared components moving (`src/shared` -> `src/ui`) as the final commit in that PR.
- Should `rubrics` remain a shared domain folder even if rubric editing UI lives under `questions`? (Currently yes: `src/rubrics` owns rubric types and grading controls.)

## Non-goals

This investigation does not recommend:

- storing cosmetic project slugs in the database;
- a full rewrite;
- microservices;
- multiple packages;
- treating the current `src/db` location of question and assessment persistence as the final architecture;
- making `src/db/generated/db.ts` a general-purpose feature import surface;
- adding a thin generated-schema facade without a concrete need;
- exposing raw generated table rows as UI/action/import/export contracts;
- owning the import preview UI design;
- a strict clean architecture hierarchy;
- moving all code under `app/`;
- extracting every duplicated pattern immediately;
- manually deduping cached server component reads without first checking intended Next caching boundaries;
- optimizing every page before fixing the core grading and import/export seams.
- splitting files further before moving feature-owned persistence to the right owner;
- treating the reorganization plan as a request for repository/service layering;
- renaming assessment completion/progress concepts before the terminology investigations settle;
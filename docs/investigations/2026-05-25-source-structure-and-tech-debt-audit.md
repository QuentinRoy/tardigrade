# Investigation: source structure and technical debt audit

Status: Current investigation
Date: 2026-05-25
Last updated: 2026-06-21 (Finding 14 / Priority 7 extraction approach settled — plans/active/2026-06-21-grading-client-extractions.md; 2026-06-20: Finding 13 / Priority 6 and Finding 4 / Priority 8 resolved after #59 closed)
Related: #99, #59, #68, #110, #24, #26, #32; #115 (closed umbrella), #51 (closed)

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

This investigation focuses on concrete codebase findings rather than a final architecture decision. It originally informed the #115 umbrella; #115 closed on 2026-06-09, so each remaining backlog entry now needs its own implementation issue when picked up. It is not itself an ADR.

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
9. all three import flows (assessments, questions, students) have been restructured around explicit parse → load context → prepare → write seams, per the [import parse/prepare/write design](../design/2026-06-10-import-parse-prepare-write-seams.md) and `plans/completed/2026-06-10-import-parse-prepare-write-seams.md` (#146, #147, #148);
10. ADR 0007 now fixes the persistence layering this document previously left open: DB primitives take a required `Kysely<DB>` handle and do database work only; app-level wrappers own the global client, the transaction boundary, and post-commit cache invalidation. The 2026-06-09 primitives-vs-wrappers pass (#142, #143) applied it across feature persistence;
11. assessment mutation internals were reviewed (former Priority 4) and need no further split: `assessmentMutations.ts` is a single ADR 0007 primitive plus wrapper, integration-tested, with subtype writes as local helpers;
12. server action contracts (Finding 15) follow a consistent parse → wrapper → map-errors → typed-state pattern, with ADR 0007 owning the layering underneath;
13. the app shell (Finding 12) has been decomposed (`AppShell`, `AppShellTopBar`, `AppShellDrawerContent`, `AppShellNavigationShell`, `AppShellLoadingShell`, `AppShell.shared.ts`); only export-options extraction remains optional;
14. submission export internals (#152) are restructured: row grouping is a pure, unit-tested `submissionExportGrouping.ts` module; `ExportQuestionPlan` is derived from `loadQuestionRowsFromDb` via a stricter `toRubric` instead of a duplicated assembly; `createSubmissionExport` / `createCsvSubmissionExport` take a `Kysely<DB>` handle per ADR 0007; and both export routes share a `buildDatedFilename` helper for `YYYY-MM-DD` filenames.
15. assessment completion semantics are consolidated (#24 closed; `plans/completed/2026-06-11-assessment-completion-consolidation.md`): **Assessment Completion** is documented once in `CONTEXT.md` and implemented once in `buildAssessmentCompletion`, with `loadAssessmentCompletion.ts` replacing `assessmentsProgress.ts` / `submissionProgress.ts` and the client-side `summarizeQuestionSections` aligned with the same rule.

The highest-value remaining work:

1. grading-client duplication — extract the quick-jump shortcut/state hook; the save-error shaping stays inline (WET). Approach settled 2026-06-21 in `plans/active/2026-06-21-grading-client-extractions.md`.

Numeric rubric editing (#68; former item 1), cache-tag hygiene (former cache item), and the question-specific grading page cache-boundary review (former item 4) are resolved; see Findings 13, 4, and 16.

The recurring problem is no longer mixed ownership — that is solved — but duplicated domain logic across read models. The remaining seams below are local responsibility boundaries inside the owning feature folders.

## Status at a glance

This table is the single source of truth for each finding's status. The per-finding "Current status" sections defer to it and carry the explanation rather than restating the verdict, so status only has to be updated here.

| Finding | Status | Tracked in |
|---|---|---|
| 1. Project route context and slug handling | Resolved | ADR 0005, #141 |
| 2. Project-scoped pages repeat route resolution | Resolved | ADR 0005 |
| 3. Submission overview assessment loading too fragmented | Resolved | #145; Priority 1 |
| 4. Question-specific grading page cache boundaries | Resolved | Priority 8, #59 (closed), #182 |
| 5. Question definition persistence split and relocated | Resolved | ADR 0002, #137 |
| 6. Assessment reads and writes split and relocated | Resolved; follow-up review done, no further split | ADR 0002, ADR 0007, #137 |
| 7. Raw database types versus feature-facing types | Mostly resolved; submission type boundary remains | ADR 0002, #137 |
| 8. Question/rubric read-model assembly duplicated | Resolved | #152 |
| 9. Assessment completion semantics duplicated | Resolved; #26 stays open | `plans/completed/2026-06-11-assessment-completion-consolidation.md`, #24, #26, #59 (closed) |
| 10. Export submissions state machine needs smaller seams | Resolved | `plans/completed/2026-06-11-submission-export-internals.md`, #152 |
| 11. Import parse/prepare/write seams | Resolved | [design](../design/2026-06-10-import-parse-prepare-write-seams.md), `plans/completed/2026-06-10-import-parse-prepare-write-seams.md`, #146, #147, #148 |
| 12. App shell navigation mixes concerns | Mostly resolved; optional export-options extraction | Finding body |
| 13. Numeric rubric editing parses too eagerly | Resolved | Priority 6, #68 |
| 14. Grading clients duplicate workflow behavior | Open; approach settled, plan active | Priority 7, plans/active/2026-06-21-grading-client-extractions.md |
| 15. Server action contract boundaries | Resolved | ADR 0007, finding body |
| 16. Cache tags and invalidation scattered | Resolved | Priority 5, #59 (closed) |
| 17. `shared` bucket renamed to `src/ui` | Resolved | #137 |
| 18. Route handlers thinner; export internals remain | Resolved | #152 |
| 19. Reasonably split components — do not over-refactor | Guidance | — |
| 20. File reorganization establishes ownership | Resolved | ADR 0002, #137 |

## Relationship to other investigations

This document focuses on concrete source-code structure and technical debt. It intentionally does not own terminology, product positioning, offline architecture, or final caching strategy.

See [the investigation overlap audit](./2026-05-25-investigation-overlap-audit.md) for a fuller ownership map across ongoing investigations.

Important related documents:

- [Domain terminology audit](./2026-05-20-domain-terminology-audit.md) owns naming decisions such as `Project` versus `Assignment`, `Assessment` versus `Grading`, and `Rubric` versus `Criterion`.
- [Assessment target model](./2026-05-20-assessment-target-model.md) owns student/group/submission/assessment-target semantics.
- [Mark, grade and weighting model](./2026-05-20-mark-grade-weighting-model.md) owns grading output semantics such as mark, grade, score, and weighting.
- [Grading workflows and product positioning](./2026-05-22-grading-workflows-and-product-positioning.md) owns workflow and product-scope questions such as spreadsheet replacement, LMS integration, and explicit import/export operations.
- [Offline support](./2026-05-19-offline-support.md) owns local storage, command outbox, sync, and conflict strategy questions.
- ADR 0007 owns the persistence layering: DB primitives take a required handle; app-level wrappers own transactions and post-commit cache invalidation.
- #59 (closed) owned final loading, caching, revalidation, and route-boundary strategy; settled in ADR 0008 and `docs/investigations/2026-06-11-caching-loading-audit.md`.
- Reliability issues #24 (progress aggregation), #26 (rubric overview analytics), and #32 (export streaming) own the correctness semantics that Findings 9 and 10 touch; this document owns only the structural seams.

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

### Current status

Status in the [status table](#status-at-a-glance).

Resolved. #59 closed 2026-06-20 (`docs/investigations/2026-06-11-caching-loading-audit.md`, `plans/completed/2026-06-17-caching-loading-hardening.md`). The structural question this finding deferred to #59 — are the current cached sections the intended boundary — was answered in PR9 (#182, "avoid duplicate submission progress reads"): after sharing question rows (PR6) and removing the duplicate submissions reload, the page's two sections were re-checked and kept as-is, with no monolithic route loader introduced. The hand-built cache tag strings noted below were fixed in PR2 (#168, cache-tag centralization), tracked under Finding 16.

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

None structural. The follow-up review (former Priority 4) ran on 2026-06-10: `assessmentMutations.ts` is ~300 lines, shaped as one ADR 0007 primitive (`saveAssessmentInDb`) plus one wrapper (`saveAssessment`) that owns the transaction and post-commit invalidation, with subtype-specific writes as local helper functions and integration tests covering tag invalidation and rollback. Splitting validation, errors, or subtype writes into separate files would add indirection without improving tests or review. No further split is warranted.

Two non-structural notes for other trackers:

- the user-facing error strings in `assessmentErrors` belong to the message-centralization work in #86;
- the primitive runs its three context lookups (submission, question, rubric) sequentially and re-selects after each upsert; acceptable today, only worth touching if save latency becomes a measured problem.

### Transaction API requirement

Superseded by ADR 0007, which this module now follows: the primitive never opens a transaction or invalidates cache; the wrapper owns both, and invalidation runs only after commit.

## Finding 7: clarify raw database types versus feature-facing types

### Current status

Status in the [status table](#status-at-a-glance).

`src/db/types.ts` has been deleted and most feature-facing types now live in their owning feature folders (`src/questions/types.ts`, `src/assessments/types.ts`, `src/rubrics/types.ts`, and `src/submissions/types.ts`). This resolves the main structural problem: there is no longer a central `src/db/types.ts` bucket mixing generated-database-adjacent types with feature, UI, action, import, and export contracts.

The finding is not fully resolved, however. `src/submissions/types.ts` still imports generated database types and re-exports `SubmissionType` from `#db/generated/db.ts`. It also contains a FIXME noting that part of the submission display model may not belong there and that the `Submission` / `SubmissionSubmitter` split is awkward. As of the 2026-06-10 re-audit it additionally carries dead imports (`Selectable`, `Submission as DbSubmission`, `Student`, `Team`) that nothing in the file uses and lint does not flag. The remaining follow-up is therefore narrow: clarify submission-facing types so that public submission contracts are explicit feature types rather than re-exported generated schema types, and drop the unused imports along the way. This work overlaps with #136 (submission identity as assessment-target identity), which may reshape these types anyway; prefer doing the cleanup there.

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

### Current status

Status in the [status table](#status-at-a-glance).

Resolved by #152. The last real duplication — `loadQuestionPlan` in `src/export/submissionExport.ts` re-implementing the five-query question/rubric assembly that `loadQuestionRowsFromDb` in `src/questions/questions.ts` already owns — is gone: `createSubmissionExport` now derives `ExportQuestionPlan` directly from `loadQuestionRowsFromDb`, mapped through a stricter `toRubric`.

The other consumers remain fine as they were:

- the rubric overview already reuses `loadQuestionGrid`;
- the import context loaders (`assessmentImportContext.ts`, `questionImportContext.ts`) intentionally load minimal, workflow-specific projections (rubric ids/types/labels, assessed-pair keys) driven by the parsed input. Forcing them onto the full question read model would load more than they need and couple them to a shape they do not use.

### Caution

Do not force every consumer to share one giant type, and do not migrate the import context loaders onto the shared read model. The shared piece is the stable source data and rubric assembly; workflow-specific projections remain workflow-specific.

## Finding 9: assessment completion semantics are duplicated across projections

### Current status

Status in the [status table](#status-at-a-glance).

Resolved 2026-06-11 (`plans/completed/2026-06-11-assessment-completion-consolidation.md`, closes #24). The **Assessment Completion** rule is now defined once in `CONTEXT.md` and implemented once in the pure builder `buildAssessmentCompletion` (`src/assessments/assessmentCompletion.ts`). `loadAssessmentCompletion.ts` replaces `assessmentsProgress.ts` and `submissionProgress.ts` with a shared `loadAssessmentCompletionRowsFromDb` primitive and three thin loaders mapped through the builder: `loadAssessmentCompletionSummary` (was `loadGlobalAssessmentProgress`), `loadAssessmentCompletionBySubmission` (was `loadSubmissionOverviewProgress`), and `loadAssessedRubricCountsBySubmission` (was `loadSubmissionQuestionProgress`, sharing the least and keeping its own queries). Zero-rubric questions and empty-grouping vacuous truth are now handled identically across the summary, by-submission, and client-side `summarizeQuestionSections` projections. The original behavior described below is kept for context; its evidence path `src/assessment/progressAggregator.ts` was already stale.

#26 (rubric overview analytics) remains open and was not changed by this consolidation. #59 (caching audit) was open at the time but has since closed, addressed separately by `plans/completed/2026-06-17-caching-loading-hardening.md`.

### Original behavior

Confirmed and made concrete by the 2026-06-10 re-audit. The completion rule — a question is complete for a submission when its rubric-assessment count reaches the question's rubric count, with zero-rubric questions counted as complete — is implemented independently at least three times:

- `loadGlobalAssessmentProgressFromDb` in `src/assessments/assessmentsProgress.ts` (project-level: completed submissions, questions, and rubrics);
- `loadSubmissionOverviewProgressFromDb` in `src/assessments/submissionProgress.ts` (per-submission question completion). Its query set and the `zeroRubricQuestionCount` / `assessmentCount >= requiredRubrics` accumulation loop are near-copies of the global version;
- `summarizeQuestionSections` / `summarizeRubrics` in `src/assessments/assessmentSummary.ts` (client-side, over already-loaded rubrics), which uses "assessment attached" rather than counts but encodes the same completed-question rule.

These metrics are about assessment state. In the current app, assessment mostly means recorded grading values, but the term is broader than grading and may later encompass feedback or other evaluator-provided information. Submission, question, and project are grouping dimensions, not owners of the progress itself.

### Why this mattered

Completion semantics are business logic. If different pages compute them differently, the dashboard, assessment list, submission overview, and question-by-question assessment pages can disagree.

The naming should avoid implying that a submission “has progress”. A submission is the assessed artifact. Completion is derived from assessment records and grouped by submission, question, or project depending on the view.

## Finding 10: export submissions is a correctness-sensitive state machine that needs smaller seams

### Current status

Status in the [status table](#status-at-a-glance).

Resolved. The 2026-05-28 export stream refactor (`plans/completed/2026-05-28-submission-export-stream-refactor.md`) made CSV header/record building a pure, unit-tested module (`src/export/submissionExportCsv.ts`) with option parsing living with the route (`exportOptions.ts`). The 2026-06-11 internals refactor (#152, `plans/completed/2026-06-11-submission-export-internals.md`) closed the remaining seams:

- the row-grouping state machine is now a pure async-generator transform, `groupSubmissionRows` in `src/export/submissionExportGrouping.ts`, unit-tested over an input row iterable without a database (`submissionExportGrouping.test.ts`);
- `ExportQuestionPlan` is derived from `loadQuestionRowsFromDb` instead of a duplicated `loadQuestionPlan` assembly (Finding 8);
- `createSubmissionExport` and `createCsvSubmissionExport` now take a `Kysely<DB>` handle per ADR 0007 instead of closing over the global `db`;
- a characterization integration test (`submissionExport.integration.test.ts`) covers the end-to-end stream.

Correctness semantics for export streaming remain owned by #32.

### Tests added

- stream boundary occurs exactly at submission changes;
- last submission flushes correctly;
- submission with no assessments still exports;
- sparse assessment values export as empty cells;
- mixed rubric types export correctly;
- ordering is stable.

Include-options effects on headers/rows and marks-only export safeguards remain candidate additions if #32 surfaces gaps.

## Finding 11: import flows should expose parse, prepare, and write seams

### Current status

Status in the [status table](#status-at-a-glance).

Decisions are captured in [Import parse, prepare, and write seams](../design/2026-06-10-import-parse-prepare-write-seams.md); delivery is tracked in `plans/completed/2026-06-10-import-parse-prepare-write-seams.md` (#146 assessments, #147 questions, #148 students). The original finding and candidate rewrite below are kept for context.

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

### Current status

Status in the [status table](#status-at-a-glance).

Mostly resolved. The shell is now split along the lines this finding asked for: `AppShell.tsx`, `AppShellTopBar.tsx`, `AppShellDrawerContent.tsx`, `AppShellNavigationShell.tsx`, `AppShellLoadingShell.tsx`, and `AppShell.shared.ts` (which owns the `getProjectRouteContext` pathname parser). The previous slug-to-display-name concern is also resolved: the shell receives the real project name from the project-scoped layout.

### Remaining concern

`AppShellDrawerContent.tsx` (~300 lines) still owns export-options local storage, export URL query building, and the navigation item lists alongside rendering. That is acceptable at its current size. Extract `ExportOptionsPanel.tsx` / `useExportOptions.ts` only if export options grow beyond the current two checkboxes; do not split ahead of need. This finding no longer carries a backlog priority.

## Finding 13: numeric rubric editing parses too eagerly

### Current status

Status in the [status table](#status-at-a-glance).

Resolved 2026-06-20 (#68). See Priority 6 for what shipped.

### Original behavior

Narrowed by the 2026-06-10 re-audit to one component. `NumberField` in `src/questions/RubricEditorPaper.tsx` converted on every keystroke (`onChange={(event) => onChange(Number(event.target.value))}`), which broke natural intermediate states such as `-`, `-0`, `1.`, and `0.`. It was used for all numeric rubric editor inputs (boolean marks, ordinal marks, numerical min/max score and marks).

The root cause was not the keystroke-level parsing itself but the field being a *controlled* React input: forcing `value` back onto the DOM input on every render fights the user mid-edit (e.g. typing `-` reads as `NaN` and the component reasserts the last valid value, erasing the keystroke). A naive look at `<input type="number">`'s `.value` getter for incomplete text (it sanitizes to `""` for a lone `-`) can suggest the browser itself blocks these states regardless of controlled vs. uncontrolled — that is not the case: an *uncontrolled* `type="number"` input lets the user type and see `-`, `-0`, `1.`, etc. while editing; the DOM-level sanitization of the `.value` getter is invisible to the user as long as nothing forces the field's displayed text.

### Why not the `NumericalGradeControl` pattern

`src/rubrics/NumericalGradeControl.tsx` (string-backed draft, parse on blur/Enter, clamp to range) was the original candidate model, but it does not transfer cleanly: clamping requires a min/max range that rubric editor fields do not have (and adding one would silently coerce, not validate), and committing/reverting on blur is more intrusive during editing than necessary given the question editor already has a real submit flow with server-side validation.

### What shipped

`src/ui/NumberField.tsx` is now a small, promoted (not `src/questions`-local) uncontrolled numeric input:

- `defaultValue` instead of `value`, so the browser owns the displayed text while typing;
- `onChange` reports every edit, including `NaN` for an empty or unparseable draft, instead of skipping or reverting;
- validation happens at form submission, not on blur: an `error` prop renders server-side field errors from the existing (previously unused) `QuestionRubricFieldErrors` plumbing in `src/questions/errors.ts`.

`BooleanRubricEditorPaper.tsx` and `NumericalRubricEditorPaper.tsx` use it for all boolean/numerical numeric fields and wire `fieldErrors` through. `src/questions/schemas.ts` gives the numeric rubric fields meaningful Zod error messages (e.g. "Marks must be a valid number") so an emptied field is rejected with a clear error on submit rather than silently keeping its last valid value.

## Finding 14: grading clients duplicate stable workflow behavior

### Current status

Status in the [status table](#status-at-a-glance).

The extraction approach was settled by a 2026-06-21 grilling session and is recorded in `plans/active/2026-06-21-grading-client-extractions.md`: extract only the quick-jump hook and remove the redundant current-submission lookup; keep the save-error payload inline. Two deliberate changes from the candidate list below — the hook is named `useSubmissionQuickJump` because it owns the dialog open/close state (not just the shortcut), and `buildSaveErrorContext` is dropped because it reduces to an object literal and the WET-before-DRY principle favors leaving it inline.

### Current behavior

Re-confirmed 2026-06-10. Reuse already exists through `useAssessmentSession` (optimistic save state, pending tracking, navigation lookup via `getSubmissionNavigation` in `submissionNavigation.ts`). What remains duplicated between `SubmissionAssessmentClient.tsx` and `SubmissionOverviewAssessmentClient.tsx` is:

- the Cmd/Ctrl+K quick-jump keyboard shortcut `useEffect` — copied verbatim, including the input/textarea/contentEditable guard;
- quick-jump dialog open state and the current-submission label lookup around it;
- save-error context shaping (project/submission/question ids and labels assembled into the `SaveError` payload) inside each `saveRubric` callback.

The previous/next navigation toolbars are similar but intentionally different (different target paths, prefetch and completion-color behavior on the question page only), so unifying them is optional.

### Candidate extractions

Original candidates (superseded by the decision in **Current status**):

```txt
src/assessments/useSubmissionQuickJumpShortcut.ts   -> useSubmissionQuickJump (also owns open/close state)
src/assessments/buildSaveErrorContext.ts            -> dropped; save-error payload kept inline (WET)
```

A shared `SubmissionNavigation` component parameterized by a link builder is possible but lower value; the earlier `useCurrentSubmission` idea is already covered by `getSubmissionNavigation`.

Do not abstract the whole grading client into one mega-component. The overview-by-submission and question-by-question UIs are different. Extract the repeated workflow pieces only.

## Finding 15: server actions are colocated with workflows, but their contracts need clearer boundaries

### Current status

Status in the [status table](#status-at-a-glance).

Resolved. The action pattern this finding asked for is now consistently in place, and ADR 0007 owns the layering underneath it:

```txt
parse form/input
call command/service or mutation (an app-level wrapper per ADR 0007)
map domain/application errors to action state
return typed action result
```

Question actions (`src/questions/actions.ts`) parse payloads via `schemas.ts`, call the mutation wrappers, and map errors through `toQuestionsValidationError` into `QuestionsActionState`. Import actions (`src/import/*ImportAction.ts`) parse, call the transactional save wrappers, and map errors through `toImportErrorState` into `ImportState`. The assessment save action is a thin delegate to a wrapper that already returns a typed result.

No further work is planned. The standing rule for new actions: keep heavy business logic out of the action, delegate to an ADR 0007 wrapper, and return a typed action state.

## Finding 16: cache tags and invalidation are useful but scattered

### Current status

Resolved. `src/db/cacheTags.ts` is now the only tag-string factory (PR2, #168), the never-invalidated `questions:${questionId}` tag's fate was decided and applied, and the mutation-to-tag map is documented in `docs/reference/cache-invalidation-map.md` per ADR 0008 rule 7 (PR3, #170). See `docs/investigations/2026-06-11-caching-loading-audit.md` Finding 1/2/17 and `plans/completed/2026-06-17-caching-loading-hardening.md`.

### Current behavior

The foundation has improved since the original audit: `src/db/cacheTags.ts` owns the tag vocabulary (including the nested assessment scope from #145), and ADR 0007 settles where invalidation runs — app-level wrappers, after commit. Mutation wrappers (`assessmentMutations.ts`, `questionDefinitionMutations.ts`, import saves) follow it, and integration tests assert the invalidated tags.

The 2026-06-10 re-audit found the remaining problem is tag-string drift at read sites rather than invalidation policy:

- the question grading page (`app/.../questions/[questionId]/page.tsx`) hand-builds tag strings (`"questions"`, `` `questions:${questionId}` ``, `` `assessments:${submissionId}:${questionId}` ``, `` `assessments:question:${questionId}` ``, `"submissions"`) instead of using the `cacheTags.ts` helpers, and the assessments list page hard-codes `"assessments"`. A typo there silently breaks invalidation;
- the per-question `` `questions:${questionId}` `` tag is registered by that page and by `submissionQuestionProgressCacheTags`, but no mutation ever invalidates it — every write busts the coarse `questions` tag instead. It works only because every section that registers it also registers `questions`. Either invalidate it on question-definition writes or drop it;
- the tag vocabulary is split between the `CACHE_TAGS` constant, two helper functions, and these ad-hoc strings.

### Candidate direction

Make `cacheTags.ts` helpers the only way tag strings are produced — replace the hard-coded strings in `app/` pages with helper calls, and decide the fate of the never-invalidated per-question tag. Then document the mutation-to-tag map. Coordinate the map's content with #59, which owns the caching strategy.

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

### Current status

Status in the [status table](#status-at-a-glance).

Resolved by #152. The export internals split tracked by Finding 10 is done, and the filename inconsistency is fixed: both export routes now build filenames via the shared `buildDatedFilename` helper in `src/export/exportFilename.ts`, standardized on `YYYY-MM-DD`.

### Current behavior

Both export route handlers are thin: load project, parse options, call the export helper, build response headers, and call `buildDatedFilename` for the download filename. No split is needed there.

The previously sketched `src/export/http.ts` response helpers are not needed at two call sites.
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

This is the single actionable list for the open findings. It carries the sequencing the [status table](#status-at-a-glance) does not. The #115 umbrella issue is closed, so an item that gets picked up needs its own implementation issue; each entry's `Related` line lists the issues it should link to. When an item is actively picked up, create a dated `plans/active/` plan for it (as the resolved findings already did) rather than tracking execution detail here.

Priorities were renumbered in the 2026-06-10 re-audit: the former Priority 4 (assessment mutation split) closed with no action needed, the former Priority 6 (question/rubric read-model reuse) folded into the export work, and the former Priority 9 (app shell split) was dropped because the shell is already decomposed (Finding 12).

Priorities were renumbered again in the 2026-06-11 re-audit: Priority 4 (submission export remaining seams) is done (#152), and the former Priorities 5-9 shifted down to 4-8.

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

### Priority 4: submission export remaining seams — Done

Completed 2026-06-11 in #152 (`plans/completed/2026-06-11-submission-export-internals.md`).

Delivered:

- extracted the submission row-grouping generator from `createSubmissionExport` into a pure async-generator transform (`groupSubmissionRows` in `src/export/submissionExportGrouping.ts`), unit-tested for boundary, last-flush, sparse-value, and ordering cases;
- derived `ExportQuestionPlan` from `loadQuestionRowsFromDb` via a stricter `toRubric`, removing the duplicated `loadQuestionPlan` assembly (Finding 8);
- aligned `createSubmissionExport` / `createCsvSubmissionExport` with ADR 0007 by taking a `Kysely<DB>` handle instead of closing over the global `db`;
- unified the dated-filename format across both export routes via a shared `buildDatedFilename` helper, standardized on `YYYY-MM-DD` (Finding 18);
- added a characterization integration test for the export stream.

Related: Findings 8, 10, 18; #32, #152.

### Priority 4: assessment completion consolidation — Done

Completed 2026-06-11 (`plans/completed/2026-06-11-assessment-completion-consolidation.md`, closes #24).

Delivered:

- documented **Assessment Completion** in `CONTEXT.md`, including the zero-rubric and vacuous-truth rules;
- extracted one pure completion builder, `buildAssessmentCompletion` (`src/assessments/assessmentCompletion.ts`);
- replaced `assessmentsProgress.ts` and `submissionProgress.ts` with `loadAssessmentCompletion.ts` (shared `loadAssessmentCompletionRowsFromDb` primitive plus `loadAssessmentCompletionSummary`, `loadAssessmentCompletionBySubmission`, `loadAssessedRubricCountsBySubmission`);
- aligned `loadAssessmentCompletionSummary` with ADR 0007 (`{ db = defaultDb }` seam);
- aligned client-side `summarizeQuestionSections` with the documented rule (zero-rubric questions count as complete);
- added empty-project page-level guards on the dashboard and assessments page.

#26 (rubric overview analytics) remains open; no cache policy changes were made here. #59 (caching audit) was open at the time but has since closed (see Finding 9 status above).

Related: Finding 9; #24, #26, #59.

### Priority 5: cache-tag hygiene — Done

Completed 2026-06-20 in #168/#170, as part of `plans/completed/2026-06-17-caching-loading-hardening.md` (#59).

Delivered:

- replaced hard-coded tag strings in `app/` pages with `cacheTags.ts` helper calls;
- decided and applied the fate of the never-invalidated per-question `questions:{id}` tag;
- documented the mutation-to-tag map in `docs/reference/cache-invalidation-map.md` next to `cacheTags.ts`, per ADR 0008 rule 7.

Related: Finding 16; #59 (closed).

### Priority 6: numeric draft field

Completed 2026-06-20 (#68).

Delivered:

- promoted `NumberField` to `src/ui/NumberField.tsx` as an uncontrolled numeric input (`defaultValue`, not `value`), so the browser owns the displayed text while the user types intermediate states like `-`, `-0`, `1.`, `0.`;
- `onChange` reports every edit including `NaN` for an empty/unparseable draft, instead of skipping it or reverting to the last valid value;
- validation moved to form submission: `NumberField` gained an `error` prop wired to the existing `QuestionRubricFieldErrors` plumbing, and `src/questions/schemas.ts` gives the numeric rubric fields meaningful Zod error messages;
- Storybook play-function regression tests cover negative numbers, decimals, negative decimals, and the empty-field-reports-`NaN` case.

Related: Finding 13; #68.

### Priority 7: grading-client extractions

Approach settled 2026-06-21 in `plans/active/2026-06-21-grading-client-extractions.md`.

Why this is the remaining item:

- removes verbatim duplication (the quick-jump shortcut effect) between the two grading clients;
- small, mechanical, and keeps the two UIs independent.

Deliverables:

- extract `useSubmissionQuickJump` into `src/assessments` — it owns the Cmd/Ctrl+K listener (with the focus guard) plus the dialog open/close state;
- route each client's current-submission lookup through the shared `getSubmissionNavigation` and collapse the duplicated null guard;
- keep the save-error payload inline in each `saveRubric`; `buildSaveErrorContext` was evaluated and dropped (it reduces to an object literal — WET-before-DRY applies);
- cover the hook with one Storybook play harness (Cmd/Ctrl+K opens, input-focus guard, Escape/close), since the Node unit tier cannot exercise window/DOM code;
- leave the navigation toolbars separate unless a parameterized component falls out naturally.

A dedicated implementation issue is still needed when work starts (the #115 umbrella is closed); no existing issue tracks this (tangential: #30, #84, #86).

Related: Finding 14.

### Priority 8: question-specific grading page cache-boundary review — Done

Completed 2026-06-20 in #182, as part of `plans/completed/2026-06-17-caching-loading-hardening.md` (#59).

Delivered:

- confirmed the current cached-section split is correct after sharing question rows (PR6) and removing the duplicate submissions reload (Finding 7 of the caching audit);
- no monolithic route loader was introduced.

Related: Finding 4; #59 (closed).

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

### Commands and transactions — resolved

Settled by ADR 0007: DB primitives take a required `Kysely<DB>` handle as their first parameter (no optional-handle ambiguity, no transaction-bound factories); app-level wrappers own the global client and the transaction boundary. Caller-owned transactions own post-commit cache invalidation.

### Cache invalidation — resolved

- Where invalidation lives is resolved by ADR 0007: in the app-level wrapper, after commit, never in a primitive.
- The mutation-to-tag map is documented (Finding 16, Priority 5) in `docs/reference/cache-invalidation-map.md`, and read sites no longer hand-build tag strings.
- Per-tag-class freshness (which pages must be fresh immediately after each mutation) is settled by ADR 0008 and #59 (closed); see `docs/investigations/2026-06-11-caching-loading-audit.md`.

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
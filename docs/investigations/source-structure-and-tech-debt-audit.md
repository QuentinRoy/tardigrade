# Investigation: source structure and technical debt audit

Status: Current investigation
Date: 2026-05-25
Last updated: 2026-06-01
Related: #115, #99, #59, #51, #68, #110

## Table of contents

- [Question](#question)
- [Executive summary](#executive-summary)
- [Relationship to other investigations](#relationship-to-other-investigations)
- [Principles used in this audit](#principles-used-in-this-audit)
- [Finding 1: project route context and slug handling](#finding-1-project-route-context-and-slug-handling)
- [Finding 2: project-scoped pages repeat route resolution](#finding-2-project-scoped-pages-repeat-route-resolution)
- [Finding 3: submission overview assessment loading is too fragmented](#finding-3-submission-overview-assessment-loading-is-too-fragmented)
- [Finding 4: question-specific grading page cache boundaries need review](#finding-4-question-specific-grading-page-cache-boundaries-need-review)
- [Finding 5: question definition persistence has been split](#finding-5-question-definition-persistence-has-been-split)
- [Finding 6: assessment reads and writes have been split, but ADR 0002 relocation remains](#finding-6-assessment-reads-and-writes-have-been-split-but-adr-0002-relocation-remains)
- [Finding 7: domain types are mixed with generated database types](#finding-7-domain-types-are-mixed-with-generated-database-types)
- [Finding 8: question and rubric read-model assembly is duplicated](#finding-8-question-and-rubric-read-model-assembly-is-duplicated)
- [Finding 9: progress and analytics duplicate completion semantics](#finding-9-progress-and-analytics-duplicate-completion-semantics)
- [Finding 10: export submissions is a correctness-sensitive state machine that needs smaller seams](#finding-10-export-submissions-is-a-correctness-sensitive-state-machine-that-needs-smaller-seams)
- [Finding 11: import flows should move toward parse-preview-confirm](#finding-11-import-flows-should-move-toward-parse-preview-confirm)
- [Finding 12: app shell navigation mixes route parsing, navigation structure, local storage, and export behavior](#finding-12-app-shell-navigation-mixes-route-parsing-navigation-structure-local-storage-and-export-behavior)
- [Finding 13: numeric rubric editing parses too eagerly](#finding-13-numeric-rubric-editing-parses-too-eagerly)
- [Finding 14: grading clients duplicate stable workflow behavior](#finding-14-grading-clients-duplicate-stable-workflow-behavior)
- [Finding 15: server actions are colocated with workflows, but their contracts need clearer boundaries](#finding-15-server-actions-are-colocated-with-workflows-but-their-contracts-need-clearer-boundaries)
- [Finding 16: cache tags and invalidation are useful but scattered](#finding-16-cache-tags-and-invalidation-are-useful-but-scattered)
- [Finding 17: `shared` is too broad as an ownership bucket](#finding-17-shared-is-too-broad-as-an-ownership-bucket)
- [Finding 18: route handlers are thinner; export internals remain the main split candidate](#finding-18-route-handlers-are-thinner-export-internals-remain-the-main-split-candidate)
- [Finding 19: several components are reasonably split and should not be over-refactored](#finding-19-several-components-are-reasonably-split-and-should-not-be-over-refactored)
- [Candidate target shape](#candidate-target-shape)
- [Prioritized rewrite backlog](#prioritized-rewrite-backlog)
- [Follow-up issue candidates](#follow-up-issue-candidates)
- [Open questions](#open-questions)
- [Non-goals](#non-goals)

## Question

Which parts of the current source code should be rewritten, split, or reorganized to improve developer experience, reduce technical debt, improve performance where relevant, and make future changes safer?

This investigation focuses on concrete codebase findings rather than a final architecture decision. It should inform #115, but it is not itself an ADR.

## Executive summary

This document was originally written before several architecture cleanup PRs landed. The current source tree no longer matches all of the original findings.

Resolved or largely resolved since the first audit:

1. project identifier normalization is complete: `project.id` is the public id and `project.row_id` is the internal database key;
2. project path helpers have moved from `routes.ts` to `projectPaths.ts`;
3. project-scoped routes now have a layout-level existence gate;
4. stale project-slug redirects are centralized through `canonicalProjectRedirect`;
5. question definition reads and mutations have been split;
6. assessment reads and assessment writes have been split, with a transaction-friendly write API.

The highest-value remaining work is now concentrated around current seams:

1. submission overview assessment loading;
2. assessment import preview and unmatched-submission policy;
3. ADR 0002 follow-up: move question and assessment persistence out of `src/db` soon;
4. assessment mutation internals, if further seams are still useful before or during that move;
5. question-specific grading page cache-boundary review;
6. question/rubric read-model reuse;
7. submission export internals;
8. progress and overview semantics;
9. app shell decomposition;
10. numeric rubric editing.

The recurring problem is still mixed responsibility, but the concrete instances have changed. The recent question and assessment splits deliberately deferred ADR 0002 compliance so that the files could first be split by responsibility inside `src/db`. That deferral should not be read as a low-priority decision. Moving question and assessment persistence to their feature-owned modules remains important and should be planned soon, after the current split has stabilized enough to make the relocation mechanical and reviewable.

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

### Keep `src/db` as an accepted interim home, not the target state

ADR 0002 points toward `src/db` eventually becoming database infrastructure only, with features owning their read models, write commands, domain types, and validation schemas.

The recent question and assessment splits intentionally kept persistence under `src/db` as an interim step. That was a pragmatic sequencing decision, not a change in architectural direction. The current audit should distinguish two kinds of work:

1. near-term seam cleanup inside the current `src/db` modules when that reduces risk immediately;
2. soonish ADR 0002 follow-up work that relocates question and assessment persistence into feature-owned modules once the internal splits are stable.

For new work, avoid adding more feature logic to `src/db` unless it is part of the current interim split. For follow-up work, prefer moving already-split modules to feature ownership over doing more elaborate decomposition inside `src/db`.

## Finding 1: project route context and slug handling

### Current status

Mostly resolved.

Project path helpers have been renamed from `routes.ts` to `projectPaths.ts`. Project-scoped routes now have a layout-level existence gate, and the app shell receives the real project name instead of reconstructing it from the slug. Stale-slug redirects are centralized through `canonicalProjectRedirect`.

### Current behavior

Project-scoped routes still use URLs shaped roughly like:

```txt
/projects/[projectId]/[projectSlug]/...
```

The slug is derived from the project name in TypeScript. This is intentional. The canonical project identity is the public project id; the slug is cosmetic and improves URL readability.

### Remaining concern

New project-scoped pages can still forget to call `canonicalProjectRedirect`. This is a convention and testability concern, not a reason to persist slugs.

### Rejected direction: store `project.slug`

Do not store the project slug in the database.

The slug is cosmetic. The canonical project identity is the public project id. The slug exists only to make URLs and filenames more readable, and it can be derived from the project name when needed. Persisting it would make a cosmetic value look like domain state, add migration and backfill work, and force policy decisions around rename behavior that the app does not currently need.

### Recommendation

Keep the current model:

1. public project id is the canonical route identity;
2. slug is derived from project name;
3. `projectPaths.ts` remains the sole source of URL string construction;
4. `canonicalProjectRedirect` remains the central stale-slug redirect helper;
5. add tests or conventions for new project-scoped pages if missing canonicalization becomes a repeated problem.

## Finding 2: project-scoped pages repeat route resolution

### Current status

Mostly resolved.

The original audit observed that most project-scoped pages repeated project existence checks, null handling, slug comparison, and redirect target construction. That is no longer the current state.

### Current behavior

The project-scoped layout now owns user-facing project existence checks. Project pages can use `loadProjectByPublicId(projectId, { required: true })` when they need project data after the layout has already gated the route.

Slug redirect logic is no longer hand-written in each page. Pages declare a route kind and call `canonicalProjectRedirect`, which maps the route kind to the corresponding `projectPaths.ts` builder.

### Remaining concern

The redirect helper is still opt-in at each page. This is probably acceptable because each page knows its full route segments, but it means a brand-new page can forget canonicalization.

### Recommendation

Do not create a broader project route-context rewrite now. Keep this as a low-priority convention issue unless new route files repeatedly drift.

Possible light follow-up:

- add a checklist item for new project-scoped pages;
- add targeted tests around canonical path builders and redirect route kinds;
- consider a small helper or page template if more project-scoped pages are added.

## Finding 3: submission overview assessment loading is too fragmented

### Current behavior

The submission overview page loads project context, submissions, the question grid, submission overview progress, then one assessment load per question. The page maps questions to `loadAssessment(submissionId, questionId)` calls and attaches each result to the corresponding rubrics.

### Why this matters

The page is naturally a submission-level read model: it needs all questions and all rubric assessment values for one submission. Loading each question assessment separately is conceptually backwards for this route.

Potential costs:

- unnecessary DB round trips;
- more complicated cache behavior;
- page code does data assembly that belongs in a loader;
- harder tests for the full submission overview state;
- slower navigation between submissions.

### Candidate rewrite

Add a submission overview loader:

```ts
loadSubmissionAssessmentOverview({
  projectId,
  submissionId,
})
```

Return a UI-ready model containing the current submission, all submissions for navigation, progress by submission, and assessed questions/rubrics. Internally, this should load all assessment values for the submission in one query or one small query set.

### Tests to add

- submission with no assessments;
- submission with sparse question completion;
- mixed rubric types;
- zero-rubric questions;
- project isolation with duplicate question/rubric ids across projects;
- ordering matches question/rubric ordering.

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

## Finding 5: question definition persistence has been split

### Current status

Largely resolved as an internal split, but not resolved against ADR 0002.

The original audit described `src/db/questions.ts` as an overgrown mixed-responsibility module. That is no longer the right framing. Question definition reads and mutations have been split into the current question/question-definition modules.

### Current structure

The landed structure uses the current naming rather than the earlier planned `questionsManaged` name:

```txt
src/db/questions.ts
src/db/questionDefinitions.ts
src/db/questionDefinitionMutations.ts
src/questions/types.ts
src/questions/schemas.ts
src/questions/actions.ts
```

### Remaining concern

The current split is a useful intermediate state, but question definition persistence still lives under `src/db`. ADR 0002 compliance was deferred during the split and should remain a soonish follow-up.

Remaining checks should focus on whether the current seams are clear enough to make relocation straightforward:

- `questions.ts` owns general question/rubric read models;
- `questionDefinitions.ts` owns management-facing question definition reads;
- `questionDefinitionMutations.ts` owns save/delete/reorder mutations;
- `src/questions/*` owns UI-facing schemas, actions, and management UI.

### Recommendation

Do not keep the old broad split candidate as active work. Replace it with two follow-ups:

1. review the current question-definition split after a few changes have landed;
2. plan the ADR 0002 relocation of question persistence from `src/db` to feature-owned modules.

Further decomposition inside `src/db` should only happen if it reduces risk before the relocation. Otherwise, prefer making the relocation the next structural step.

## Finding 6: assessment reads and writes have been split, but ADR 0002 relocation remains

### Current status

Partially resolved as an internal split, but not resolved against ADR 0002.

The original audit described `src/db/assessments.ts` as mixing assessment loading, validation, persistence, command semantics, transaction support, and cache invalidation. That exact finding is stale. Assessment reads and writes have since been split, and the assessment write path has a transaction-friendly API.

### Current behavior

Assessment reads live separately from assessment mutations. The mutation path supports both standalone saves and caller-supplied transactions, which is needed by assessment import. This was the right first step.

### Remaining concern

Assessment persistence still lives under `src/db`. That was deliberately deferred when splitting the module, but it remains important and should be fixed soon. The remaining design question is whether to do more internal seam cleanup before relocation, or to make relocation to feature ownership the next structural step.

Potential reasons to split internals before or during the move:

- validation;
- user-facing error messages;
- assessment row upsert;
- subtype-specific writes;
- transaction handling;
- cache invalidation after standalone writes.

This may be acceptable if the current module is small and well-tested. Further splitting should be driven by actual review pain or test difficulty, not by a blanket rule that every command needs several files.

### Candidate internal split, if needed

```txt
src/db/assessmentMutations.ts
src/db/assessmentMutationValidation.ts
src/db/assessmentMutationErrors.ts
src/db/assessmentMutationRepository.ts
```

However, if ADR 0002 relocation is the next planned step, prefer doing this split in the feature-owned location rather than adding more permanent structure under `src/db`.

### Transaction API requirement

The existing transaction-friendly API is the right direction. Preserve the rule that cache invalidation does not run inside a caller-owned transaction. The transaction owner should invalidate after commit.

## Finding 7: domain types are mixed with generated database types

### Current behavior

`src/db/types.ts` re-exports generated DB types and also defines domain/application types such as `Submission`, `Rubric`, `AssessmentRubricValue`, `Question`, and `Grid`.

### Why this matters

Client code imports domain-looking types from `db/types`. This makes it look as if UI and domain code depend on the DB layer, even if the import is type-only.

It also makes it harder to tell whether a type is a generated DB row type, persistence projection, domain model, UI view model, or import/export DTO.

### Recommendation

This should be treated as part of ADR 0002 follow-up work, not as a low-priority cleanup. Start by creating new domain type modules that re-export the old types, then move definitions gradually.

Candidate target modules:

```txt
src/db/generated/db.ts
src/db/dbTypes.ts
src/rubrics/rubricTypes.ts
src/assessment/assessmentTypes.ts
src/submissions/submissionTypes.ts
src/questions/types.ts
```

## Finding 8: question and rubric read-model assembly is duplicated

### Current behavior

Question/rubric loading appears in multiple places:

- general question/rubric reads assemble questions, rubrics, and subtype data;
- export submission planning loads a similar structure;
- rubric overview loads questions and then assessment records;
- import assessment preparation loads rubric metadata for parsing.

Some duplication is expected because these flows need different projections. However, the multi-table rubric assembly logic is domain-stable and repeated enough to deserve a shared seam.

### Candidate direction

Introduce a canonical question/rubric read model loader or row assembly helper. If ADR 0002 relocation is imminent, prefer placing this under the relevant feature ownership rather than creating more permanent structure in `src/db`.

Export-specific code can transform the canonical grid into an export plan. Import-specific code can transform it into recognized assessment columns.

### Caution

Do not force every consumer to share one giant type. The shared piece should be the stable source data and rubric assembly. Workflow-specific projections should remain workflow-specific.

## Finding 9: progress and analytics duplicate completion semantics

### Current behavior

Progress/analytics logic appears in submission-question progress, submission-overview progress, global assessment progress, rubric overview analytics, and shared assessment summary helpers.

These modules compute related metrics:

- completed rubrics;
- total rubrics;
- completed questions;
- total questions;
- zero-rubric question behavior;
- completion percentages;
- class averages;
- per-student/submission rows.

### Why this matters

Completion semantics are business logic. If different pages compute them differently, the dashboard, assessment lists, and overview pages can disagree.

Some summary semantics are already centralized, which is good. The remaining issue is making sure DB progress loaders, dashboard summaries, and overview analytics share the same documented semantics.

### Candidate direction

Create or document a grading progress model around:

```txt
src/assessment/assessmentSummary.ts
src/db/submissionProgress.ts
src/db/assessmentProgress.ts
```

This should also be revisited during ADR 0002 follow-up because progress logic is feature logic, not database infrastructure.

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

## Finding 11: import flows should move toward parse-preview-confirm

### Current behavior

The import UI is a reusable textarea/drop form. The assessment import currently parses then writes in one server action.

Assessment import already has useful preparation behavior: recognized columns, batch submission resolution, value parsing, error accumulation, and transactional writes. However, missing submissions are still skipped rather than surfaced to the user as a previewable warning or error.

### Why this matters

Silent skips are dangerous for grading data. A user importing a CSV should know whether rows matched submissions and how many values will be written.

### Candidate rewrite

Use a two-step workflow:

```txt
parse -> preview -> confirm write
```

For assessment imports, preview should include:

- number of rows parsed;
- recognized assessment columns;
- ignored columns;
- missing/unmatched submissions;
- ambiguous submissions;
- invalid assessment cells;
- number of values to write;
- whether values will overwrite existing assessments.

Policy question: should missing submissions warn, block, or be configurable?

## Finding 12: app shell navigation mixes route parsing, navigation structure, local storage, and export behavior

### Current behavior

The app shell drawer parses project route context from `usePathname`, builds navigation items, owns export options local storage, builds export submission URL query parameters, and renders import/export/project navigation sections.

The previous slug-to-display-name concern is resolved: the shell now receives the real project name from the project-scoped layout.

### Candidate split

```txt
src/ui/app-shell/
  AppShell.tsx
  AppShellTopBar.tsx
  AppShellDrawer.tsx
  projectRouteContext.ts
  projectNavigationItems.ts
  ExportOptionsPanel.tsx
  useExportOptions.ts
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
src/assessment/useSubmissionQuickJumpShortcut.ts
src/assessment/SubmissionNavigation.tsx
src/assessment/useCurrentSubmission.ts
src/assessment/buildSaveErrorContext.ts
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

Keep cache helper modules visible to write paths and document mutation-to-tag behavior. This may remain infrastructure-adjacent even after ADR 0002 relocation, but feature commands should be explicit about which cache policy they invoke.

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

## Finding 17: `shared` is too broad as an ownership bucket

### Current behavior

`src/shared` contains app shell components, save error provider/display, links, code snippets, and shell-specific helpers.

### Candidate split

```txt
src/ui/app-shell/
src/ui/feedback/
src/ui/code/
src/ui/navigation/
```

or flatter if preferred:

```txt
src/ui/AppShell.tsx
src/ui/AppShellDrawer.tsx
src/ui/SaveErrorsProvider.tsx
src/ui/CodeSnippet.tsx
src/ui/MuiNextLink.tsx
```

Do this as a mechanical move after more important command/read-model splits, unless it blocks other work.

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

Not everything needs rewriting.

Examples that look reasonably scoped:

- `RubricEditorList` dispatches to rubric-type-specific editor components and owns list operations;
- `QuestionForm` mostly coordinates draft state, payload creation, errors, and form submission;
- type-specific rubric editor components are small;
- `BaseImportForm` is a reusable UI shell rather than a correctness-critical mixed persistence module.

The goal should be to split overloaded correctness-sensitive modules first, not to maximize the number of files.

## Candidate target shape

This is not a final decision. It is a concrete shape that reflects the current audit findings while treating `src/db` as interim for feature persistence.

```txt
src/
  assessment/
    assessmentSummary.ts
    assessmentTypes.ts
    assessmentReadModel.ts
    assessmentMutations.ts
    useAssessmentSession.ts
    useSubmissionQuickJumpShortcut.ts
    SubmissionNavigation.tsx
    SubmissionAssessmentClient.tsx
    SubmissionOverviewAssessmentClient.tsx
    RubricGradeList.tsx

  questions/
    types.ts
    schemas.ts
    actions.ts
    questionDefinitions.ts
    questionDefinitionMutations.ts
    QuestionsManagementClient.tsx
    QuestionForm.tsx
    RubricEditorList.tsx

  import/
    parseAssessments.ts
    prepareAssessmentImport.ts
    assessmentImportPreview.ts
    saveAssessments.ts
    AssessmentsImportForm.tsx
    BaseImportForm.tsx
    actionUtils.ts

  export/
    submissionExportOptions.ts
    submissionExportPlan.ts
    submissionAssessmentRows.ts
    groupSubmissionRows.ts
    submissionExportCsv.ts
    submissionExport.ts
    questionsExport.ts
    http.ts
    filenames.ts

  projects/
    canonicalProjectRedirect.ts
    projectPaths.ts

  rubrics/
    rubric.ts
    rubricMarking.ts
    rubricAssessment.ts

  submissions/
    getSubmissionLabel.ts
    submissionNavigation.ts
    quickJumpSearch.ts

  db/
    kysely.ts
    generated/
    migrations/
    cacheTags.ts
    projects.ts
```

The current code may keep already-split modules under `src/db` temporarily, but this target shape should remain visible so the interim state does not become permanent by accident.

## Prioritized rewrite backlog

### Priority 1: submission overview assessment read model

Why first:

- likely improves performance;
- simplifies a core grading page;
- establishes read-model pattern for grading pages;
- still clearly current after route-context cleanup.

Suggested deliverables:

- add `loadSubmissionAssessmentOverview` or equivalent;
- replace per-question `loadAssessment` calls if a single query or small query set is clearer;
- add integration tests for mixed rubric types and sparse assessments.

### Priority 2: assessment import preview and unmatched-submission policy

Why second:

- imports can change many grades at once;
- missing submissions are currently too easy to overlook;
- preview is a significant UX and correctness improvement.

Suggested deliverables:

- define preview model first;
- report unmatched submissions explicitly;
- decide whether unmatched submissions warn, block, or are configurable;
- separate parse/prepare from confirm/write.

### Priority 3: ADR 0002 relocation for question and assessment persistence

Why third:

- the internal splits have landed;
- the deferred architectural issue remains important;
- moving now or soon avoids making `src/db` the permanent feature-persistence home by inertia.

Suggested deliverables:

- decide target feature modules for question definitions and assessments;
- move read/write/domain type modules out of `src/db` with minimal behavior change;
- keep `src/db` focused on generated types, Kysely setup, migrations, cache tag infrastructure, and low-level database plumbing;
- preserve existing tests and import paths through mechanical updates rather than redesigning behavior at the same time.

### Priority 4: assessment mutation internal split, if still needed

Why fourth:

- central write path;
- shared by interactive grading and imports;
- current read/write split and transaction-friendly API have resolved part of the old finding.

Suggested deliverables:

- review current `assessmentMutations` after the completed split;
- split validation/errors/repository helpers only if that improves tests or reviewability;
- prefer doing the split in the feature-owned location if ADR 0002 relocation is underway;
- preserve caller-owned transaction behavior and post-commit invalidation.

### Priority 5: question-specific grading page cache-boundary review

Why fifth:

- core grading UX;
- current split may be correct under Next caching;
- avoid refactoring only to dedupe cached reads.

Suggested deliverables:

- check relevant caching plans and #59;
- document intended boundaries;
- only extract a loader if it clarifies semantics without fighting cache boundaries.

### Priority 6: question/rubric read-model reuse

Why sixth:

- repeated multi-table assembly remains;
- useful for import/export consistency;
- less urgent now that question definition persistence has been split.

Suggested deliverables:

- identify the stable shared source data;
- avoid one giant cross-workflow type;
- let import/export keep workflow-specific projections.

### Priority 7: submission export state-machine split

Why seventh:

- correctness-sensitive;
- splitting will make future export work safer;
- route handlers are already reasonably thin.

Suggested deliverables:

- split stream grouping from CSV formatting;
- add stream boundary tests;
- keep response helper extraction secondary.

### Priority 8: progress/read-model consolidation

Why eighth:

- repeated business semantics;
- important for consistency;
- interacts with caching audit #59.

Suggested deliverables:

- document completion semantics;
- build on existing summary helpers;
- align dashboard/list/overview calculations.

### Priority 9: app shell split

Why ninth:

- improves DX but not central correctness;
- slug-derived display name concern is already resolved;
- can be mechanical.

Suggested deliverables:

- extract export options hook/panel;
- extract navigation item builder;
- move shared shell files under `ui/app-shell`.

### Priority 10: numeric draft field

Why tenth:

- small focused UX win;
- low risk;
- addresses #68.

Suggested deliverables:

- add `NumericDraftField`;
- replace rubric numeric fields;
- test intermediate input states.

## Follow-up issue candidates

The following could be split out from #115 if smaller implementation issues are useful.

### Candidate issue: add submission assessment overview read model

Scope:

- replace per-question assessment loading on submission overview page if a consolidated loader is clearer;
- add integration tests;
- clarify cache tags.

Related: #59, #115.

### Candidate issue: design assessment import preview/confirmation flow

Scope:

- parse-preview-confirm flow;
- show ignored columns and unmatched submissions;
- decide missing-submission policy;
- preserve transactional writes.

Related: #110, #115.

### Candidate issue: move question and assessment persistence out of `src/db`

Scope:

- follow ADR 0002 now that internal read/write splits have landed;
- move question definition read/write modules to question-owned code;
- move assessment read/write modules and domain types to assessment-owned code;
- keep behavior changes out of this relocation unless required by import paths or tests.

Related: ADR 0002, #115.

### Candidate issue: review assessment mutation internals

Scope:

- review current assessment read/write split;
- split validation/errors/repository helpers only if useful;
- preserve transaction-friendly API.

Related: reliability audit, #115.

### Candidate issue: review question-specific grading cache boundaries

Scope:

- confirm current server component cache boundaries;
- document intended repeated cached reads;
- avoid unnecessary dedupe refactors.

Related: #59, #115.

### Candidate issue: reuse question/rubric assembly where stable

Scope:

- identify stable question/rubric source data;
- reduce duplicated subtype assembly in read/export/import flows;
- keep workflow-specific projections separate.

Related: #115.

### Candidate issue: split submission export state machine

Scope:

- split stream row grouping from CSV formatting;
- add tests for stream boundaries, sparse assessments, and ordering.

Related: reliability audit, #115.

### Candidate issue: extract grading progress semantics

Scope:

- document completed-question/completed-rubric semantics;
- extract or align pure builders;
- align dashboard/list/overview calculations.

Related: #59, #115.

### Candidate issue: split app shell drawer internals

Scope:

- extract export options hook/panel;
- extract navigation item builder;
- move shell files out of `shared` if desired.

Related: #115.

### Candidate issue: rewrite numeric rubric field editing

Scope:

- string-backed numeric draft field;
- replace eager numeric parsing;
- add regression tests.

Related: #68.

## Open questions

### Project slugs

- Current decision: slugs are cosmetic and should not be stored in the database.
- Should slugs update automatically when names change? Current implied behavior is yes because the slug is derived from name.
- Should old slugs redirect? Current behavior redirects stale slugs to the current derived slug.
- Should filenames use project slug, project id, or project name?

### Project identifiers

- Resolved by #51: `project.id` is the public id and `project.row_id` is the internal id.
- Route params should continue using public `project.id`.

### ADR 0002 relocation

- What is the smallest mechanical move that relocates question and assessment persistence out of `src/db`?
- Should domain types move first, or together with read/write modules?
- Which cache-tag helpers should remain in `src/db`, and which feature commands should own their cache policy calls?
- Should this be one PR for question persistence and one PR for assessment persistence?

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

- Should missing submissions block assessment import?
- Should import preview be mandatory?
- Should import support marks-only CSV columns or only assessment-value columns?
- Should imports overwrite existing assessments by default?

### Folder structure

- ADR 0002 compliance has been deferred during the internal splits, but remains important. What concrete trigger should start the relocation PRs?
- Should UI-only shared components move before or after read-model rewrites?
- Should `rubrics` remain a shared domain folder even if rubric editing UI lives under `questions`?

## Non-goals

This investigation does not recommend:

- storing cosmetic project slugs in the database;
- a full rewrite;
- microservices;
- multiple packages;
- treating the current `src/db` location of question and assessment persistence as the final architecture;
- a strict clean architecture hierarchy;
- moving all code under `app/`;
- extracting every duplicated pattern immediately;
- manually deduping cached server component reads without first checking intended Next caching boundaries;
- optimizing every page before fixing the core grading and import/export seams.

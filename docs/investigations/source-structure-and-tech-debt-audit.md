# Investigation: source structure and technical debt audit

Status: Current investigation
Date: 2026-05-25
Related: #115, #99, #59, #51, #68, #110

## Table of contents

- [Question](#question)
- [Executive summary](#executive-summary)
- [Relationship to other investigations](#relationship-to-other-investigations)
- [Principles used in this audit](#principles-used-in-this-audit)
- [Finding 1: project route context and slug handling](#finding-1-project-route-context-and-slug-handling)
- [Finding 2: project-scoped pages repeat route resolution](#finding-2-project-scoped-pages-repeat-route-resolution)
- [Finding 3: submission overview assessment loading is too fragmented](#finding-3-submission-overview-assessment-loading-is-too-fragmented)
- [Finding 4: question-specific grading page reloads context in multiple sections](#finding-4-question-specific-grading-page-reloads-context-in-multiple-sections)
- [Finding 5: `src/db/questions.ts` is an overgrown mixed-responsibility module](#finding-5-srcdbquestionsts-is-an-overgrown-mixed-responsibility-module)
- [Finding 6: `src/db/assessments.ts` mixes validation, persistence, command semantics, and cache invalidation](#finding-6-srcdbassessmentsts-mixes-validation-persistence-command-semantics-and-cache-invalidation)
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
- [Finding 18: route handlers contain export-specific infrastructure that could be factored](#finding-18-route-handlers-contain-export-specific-infrastructure-that-could-be-factored)
- [Finding 19: several components are reasonably split and should not be over-refactored](#finding-19-several-components-are-reasonably-split-and-should-not-be-over-refactored)
- [Candidate target shape](#candidate-target-shape)
- [Prioritized rewrite backlog](#prioritized-rewrite-backlog)
- [Follow-up issue candidates](#follow-up-issue-candidates)
- [Open questions](#open-questions)

## Question

Which parts of the current source code should be rewritten, split, or reorganized to improve developer experience, reduce technical debt, improve performance where relevant, and make future changes safer?

This investigation focuses on concrete codebase findings rather than a final architecture decision. It should inform #115, but it is not itself an ADR.

## Executive summary

The highest-value improvements are not only folder moves. The codebase would benefit from targeted rewrites around current seams:

1. project route context and slug handling;
2. project-scoped page loading patterns;
3. grading assessment read models;
4. question/rubric persistence and mutation logic;
5. assessment save commands;
6. progress and overview read models;
7. import/export pipelines;
8. app shell navigation;
9. numeric rubric editing.

The recurring problem is mixed responsibility. Several modules combine route resolution, DB queries, domain mapping, validation, cache invalidation, UI state, and user-facing error messages. Some duplication is acceptable for now, especially while the domain vocabulary is still evolving, but repeated rubric/question assembly and progress semantics look stable enough to justify shared helpers or read-model modules.

The preferred direction is still lightweight and colocated: keep related workflow code together, split large files by responsibility, and avoid deep architecture layers unless a folder becomes difficult to navigate.

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
- one-off labels or help content.

Likely extraction candidates:

- project route resolution;
- question/rubric row assembly;
- assessment command validation;
- progress completion semantics;
- submission navigation and quick-jump behavior.

### Keep `app/` as routing and composition

Next route files should remain in `app/`. Plain path builders such as project URL helpers can live in `src/projects/projectPaths.ts` or similar. To avoid confusion, `routes.ts` may be better renamed to `projectPaths.ts`.

### Keep `db/` as infrastructure

The current `src/db` contains many application operations. That makes it hard to distinguish database plumbing from workflow logic. A better convention:

```txt
src/db/
  kysely.ts
  generated/
  migrations/
  cacheTags.ts
```

Application logic that happens to use the DB should live near its workflow, for example:

```txt
src/grading/assessmentRepository.ts
src/questions/questionRepository.ts
```

## Finding 1: project route context and slug handling

### Current behavior

Project-scoped routes use URLs shaped roughly like:

```txt
/projects/[projectId]/[projectSlug]/...
```

The slug is derived from the project name in TypeScript rather than stored as a first-class database field. The project loader fetches the internal database id, public id, and name, then computes the slug from the name.

Many pages then repeat a pattern like:

```ts
const project = await loadProjectByPublicId(projectId);

if (project == null) {
  notFound();
}

if (project.slug !== projectSlug) {
  redirect(projectDashboardPath(project.publicId, project.slug));
}
```

This is visible in the project dashboard, assessments list, submission overview, question-specific grading pages, and export routes.

The app shell avoids loading the real project name by deriving a display name from the slug. That avoids a server fetch in the client shell, but only produces an approximate title.

### Why this matters

This is probably not a major raw performance problem by itself. Project lookup is small and can be cached.

The DX and maintenance problems are more important:

- route validation is repeated across pages;
- path builders require both project id and slug everywhere;
- pages need the internal numeric project id before loading project-scoped data;
- project display name and project slug can diverge in presentation;
- if the slug algorithm changes, route behavior depends on TypeScript code rather than persisted data;
- future project renames will need explicit canonical URL behavior.

### Candidate direction A: store `project.slug`

Add a stored slug column to the project table.

Possible model:

```txt
project.row_id  internal database key
project.id      stable public project id used in URLs
project.name    display name
project.slug    canonical URL/file slug
```

This overlaps with #51, which already questions identifier naming conventions.

Benefits:

- slug becomes a stable project property;
- route validation no longer recomputes slug from name everywhere;
- export filenames can use the same stored slug;
- future project rename behavior can be explicit.

Trade-offs:

- migrations and backfills required;
- need a policy for name changes: update slug automatically, keep old slug, or allow manual slug;
- possible uniqueness questions if slugs are user-visible but project ids remain primary route identifiers.

### Candidate direction B: use a generated/computed slug column

A generated column could keep the slug derived from name.

Benefits:

- avoids application-level slug drift;
- no manual write logic for slug updates.

Trade-offs:

- slug normalization becomes PostgreSQL-specific;
- sophisticated slug behavior can be awkward in SQL;
- changing the slug algorithm later can require DB migrations;
- it still does not remove page-level route-context boilerplate.

### Candidate direction C: remove slugs from canonical URLs

Use URLs like:

```txt
/projects/[projectId]/...
```

Benefits:

- no slug redirects;
- simpler path builders;
- simpler project route context;
- less coupling between project name and routing.

Trade-offs:

- less readable URLs;
- filenames and UI still need a slug-like helper;
- if users like readable URLs, this is a product regression.

### Candidate direction D: centralize project route context

Introduce a single loader/helper such as:

```ts
loadProjectRouteContext(params)
```

Possible return shape:

```ts
{
  rowId: number;
  publicId: string;
  slug: string;
  name: string;
  canonicalBasePath: string;
}
```

This helper could either:

- call `notFound()` / `redirect()` internally; or
- return a typed result that pages handle consistently.

### Recommendation

Prefer combining A and D:

1. store a canonical project slug explicitly;
2. introduce a central project route context loader;
3. remove repeated per-page slug validation;
4. rename `src/projects/routes.ts` to `src/projects/projectPaths.ts` to avoid confusion with Next `app/.../route.ts` handlers.

## Finding 2: project-scoped pages repeat route resolution

### Current behavior

Most project-scoped pages do a local version of:

1. await `params`;
2. load project by public id;
3. call `notFound()` if missing;
4. compare slug;
5. redirect if slug is not canonical;
6. pass `project.id`, `project.publicId`, and `project.slug` to loaders and path builders.

This pattern appears in pages and route handlers. It is not isolated to one feature.

### Why this matters

Even if the runtime cost is small, the repetition is a correctness and DX issue:

- every new page can forget slug canonicalization;
- every page has to know when to use internal id vs public id;
- redirects vary by destination depending on page type;
- cache tagging and project scoping are harder to centralize;
- a future auth/ownership layer will need to be added in many places unless this is centralized.

### Candidate rewrite

Add project-scoped route utilities:

```txt
src/projects/projectRouteContext.ts
src/projects/projectPaths.ts
```

Possible APIs:

```ts
loadProjectRouteContext(params)
loadProjectRouteContextOrNotFound(params)
canonicalizeProjectPath(context, currentPathKind)
```

or page-specific helpers:

```ts
loadDashboardRouteContext(params)
loadAssessmentsRouteContext(params)
loadSubmissionRouteContext(params)
```

The first option is probably better unless page-specific needs diverge.

### Follow-up consideration

This should be designed with future authentication in mind (#42). The same helper should eventually validate project ownership, not just existence and slug.

## Finding 3: submission overview assessment loading is too fragmented

### Current behavior

The submission overview page loads:

- project context;
- submissions;
- question grid;
- submission overview progress;
- then one assessment load per question.

The page maps questions to `loadAssessment(submissionId, questionId)` calls and then attaches each result to the corresponding rubrics.

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

Return shape:

```ts
{
  currentSubmission: Submission;
  submissions: Submission[];
  progressBySubmissionId: Record<string, ProgressMetric>;
  questions: Array<{
    questionId: string;
    questionLabel: string;
    rubrics: AssessedRubric[];
  }>;
}
```

Internally, this should load all assessment values for the submission in one query or one small query set.

### Tests to add

- submission with no assessments;
- submission with sparse question completion;
- mixed rubric types;
- zero-rubric questions;
- project isolation with duplicate question/rubric ids across projects;
- ordering matches question/rubric ordering.

## Finding 4: question-specific grading page reloads context in multiple sections

### Current behavior

The question-specific grading page splits loading across server component sections. Project context is loaded more than once inside the same page render path. Caching may hide some cost, but the structure is still hard to reason about.

### Why this matters

This page is core grading UX. It should have very clear data requirements:

- project context;
- question definition;
- current submission;
- all submissions for navigation;
- current assessment values;
- progress by submission.

Instead, the loading responsibilities are split across local page sections. That makes future work on loading boundaries and caching (#59) harder.

### Candidate rewrite

Add:

```ts
loadQuestionAssessmentPage({
  projectPublicId,
  projectSlug,
  submissionId,
  questionId,
})
```

Return shape:

```ts
{
  project;
  question;
  currentSubmission;
  submissions;
  assessedRubrics;
  progressBySubmissionId;
}
```

The page should call the loader once and render from the returned model.

### Loading-boundary implication

This does not mean everything must always block the full page. Once the loader boundaries are explicit, a future refactor can decide which data is stable parent context and which data is submission-specific.

## Finding 5: `src/db/questions.ts` is an overgrown mixed-responsibility module

### Current responsibilities

`src/db/questions.ts` currently appears to own:

- loading question rows;
- loading rubric rows;
- loading boolean/ordinal/numerical subtype rows;
- assembling domain `Question` and `Rubric` objects;
- defining managed question input types;
- normalizing optional text;
- validating duplicate ids;
- computing delete impact;
- saving a question;
- reconciling rubric row changes;
- reconciling subtype table changes;
- deleting stale rubrics and ordinal values;
- deleting questions;
- reordering questions;
- updating cache tags.

This is one of the clearest split candidates in the repository.

### Why this matters

This file is correctness-sensitive. Bugs here can corrupt or delete rubrics and assessments. The reliability audit already treats question/rubric mutation as Tier 0 risk.

Large mixed files make it difficult to:

- test behavior at the right granularity;
- review changes safely;
- reuse question/rubric loading in exports/imports;
- distinguish domain validation from persistence constraints;
- reason about cache invalidation.

### Candidate split

A flat split:

```txt
src/questions/
  questionTypes.ts
  questionReadModel.ts
  questionRepository.ts
  questionValidation.ts
  saveQuestion.ts
  deleteQuestion.ts
  reorderQuestions.ts
```

Alternative if this grows:

```txt
src/questions/
  readModel.ts
  repository.ts
  save.ts
  validation.ts
  actions.ts
  schemas.ts
```

### Suggested extraction sequence

1. Extract pure normalization and validation helpers.
2. Extract row-to-domain mapping helpers.
3. Extract read-only question/rubric loading.
4. Extract delete-impact logic.
5. Extract save orchestration into named steps.
6. Leave the old module as a compatibility facade temporarily, then delete it.

### Save orchestration target

`saveManagedQuestion` should read like a sequence of named operations:

```txt
normalize input
validate rubric ids and source ids
resolve existing question and conflicts
upsert question row
reconcile rubric rows
reconcile boolean subtype rows
reconcile numerical subtype rows
reconcile ordinal subtype rows and values
invalidate question and assessment caches
```

## Finding 6: `src/db/assessments.ts` mixes validation, persistence, command semantics, and cache invalidation

### Current responsibilities

`src/db/assessments.ts` owns:

- assessment loading;
- command parameter types;
- validating submission/question/rubric existence;
- validating rubric type compatibility;
- validating numerical bounds;
- validating ordinal labels;
- user-facing error messages;
- insert/update/delete behavior for assessment rows;
- subtype-specific write behavior;
- transaction support;
- cache invalidation;
- an exported helper used by assessment imports.

### Why this matters

Assessment saving is a central write path. It is also shared by interactive grading and import flows. Right now import depends on a helper from a DB module, which blurs the line between persistence internals and application commands.

### Candidate split

```txt
src/grading/
  assessmentTypes.ts
  assessmentErrors.ts
  assessmentValidation.ts
  assessmentRepository.ts
  saveAssessment.ts
  saveAssessment.action.ts
```

The repository should own SQL. The command/service should own workflow semantics and cache invalidation.

### Transaction API requirement

The import flow needs to save many assessments inside one transaction. The new API should support this explicitly, for example:

```ts
saveAssessment(command, { db: tx })
```

or:

```ts
createAssessmentWriter(tx).save(command)
```

The key is to avoid exporting a persistence-internal helper only because another workflow needs transaction reuse.

## Finding 7: domain types are mixed with generated database types

### Current behavior

`src/db/types.ts` re-exports generated DB types and also defines domain/application types such as `Submission`, `Rubric`, `AssessmentRubricValue`, `Question`, and `Grid`.

### Why this matters

Client code imports domain-looking types from `db/types`. This makes it look as if UI and domain code depend on the DB layer, even if the import is type-only.

It also makes it harder to tell whether a type is:

- a generated DB row type;
- a persistence projection;
- a domain model;
- a UI view model;
- an import/export DTO.

### Candidate split

```txt
src/db/generated/db.ts
src/db/dbTypes.ts
src/rubrics/rubricTypes.ts
src/grading/assessmentTypes.ts
src/submissions/submissionTypes.ts
src/questions/questionTypes.ts
```

or flatter:

```txt
src/rubrics/types.ts
src/grading/types.ts
src/submissions/types.ts
src/questions/types.ts
```

### Migration approach

Start by creating new domain type modules that re-export the old types. Then move definitions gradually. This keeps the refactor reviewable.

## Finding 8: question and rubric read-model assembly is duplicated

### Current behavior

Question/rubric loading appears in multiple places:

- `loadQuestionsFromDb` assembles questions, rubrics, and subtype data;
- export submission planning loads a similar structure;
- rubric overview loads questions and then assessment records;
- import assessment preparation loads rubric metadata for parsing.

Some duplication is expected because these flows need different projections. However, the multi-table rubric assembly logic is domain-stable and repeated enough to deserve a shared seam.

### Candidate direction

Introduce a canonical question/rubric read model loader:

```txt
src/questions/questionRubricRows.ts
src/questions/buildQuestionGrid.ts
src/questions/loadQuestionGrid.ts
```

Export-specific code can transform the canonical grid into an export plan:

```txt
src/exports/submissions/toSubmissionExportPlan.ts
```

Import-specific code can transform it into recognized assessment columns:

```txt
src/imports/assessments/buildRecognizedAssessmentColumns.ts
```

### Caution

Do not force every consumer to share one giant type. The shared piece should be the stable source data and rubric assembly. Workflow-specific projections should remain workflow-specific.

## Finding 9: progress and analytics duplicate completion semantics

### Current behavior

Progress/analytics logic appears in:

- submission-question progress;
- submission-overview progress;
- global assessment progress;
- rubric overview analytics.

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

### Candidate direction

Create a grading progress model:

```txt
src/grading/progressTypes.ts
src/grading/loadProgressInputs.ts
src/grading/buildSubmissionQuestionProgress.ts
src/grading/buildSubmissionOverviewProgress.ts
src/grading/buildGlobalAssessmentProgress.ts
```

or, if keeping progress separate:

```txt
src/progress/
  progressTypes.ts
  progressInputs.ts
  submissionProgress.ts
  globalProgress.ts
```

### Tests to add

- zero submissions;
- zero questions;
- zero-rubric questions;
- partial rubric completion;
- duplicate or stale rubric assessment protection;
- project isolation;
- progress after question/rubric deletion.

## Finding 10: export submissions is a correctness-sensitive state machine that needs smaller seams

### Current behavior

Submission export does many things in one area:

- assert submission invariants;
- load export question plan;
- build headers;
- stream joined DB rows;
- group rows by submission;
- map DB subtype values to assessment values;
- attach assessments to rubrics;
- build CSV rows.

Streaming is reasonable, but the state machine should be independently testable.

### Candidate split

```txt
src/exports/submissions/
  exportOptions.ts
  loadSubmissionExportPlan.ts
  streamSubmissionAssessmentRows.ts
  groupSubmissionRows.ts
  buildSubmissionExportRows.ts
  submissionExportCsv.ts
  createSubmissionExport.ts
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

The import UI is a reusable textarea/drop form. The assessment import help text states that missing submissions are silently skipped. Internally, assessment import already has useful preparation behavior: recognized columns, batch submission resolution, value parsing, error accumulation, and transactional writes.

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

For student imports, this overlaps with #110, which already proposes mapping and preview.

### Candidate modules

```txt
src/imports/assessments/
  parseAssessmentsCsv.ts
  prepareAssessmentImport.ts
  assessmentImportPreview.ts
  saveAssessmentImport.ts
  AssessmentsImportForm.tsx
  AssessmentImportPreview.tsx
```

### Policy question

Should missing submissions be:

- silently skipped;
- reported as warnings but still allow import;
- blocking errors;
- configurable per import?

The current behavior should probably be changed or at least surfaced loudly.

## Finding 12: app shell navigation mixes route parsing, navigation structure, local storage, and export behavior

### Current behavior

The app shell drawer:

- parses project route context from `usePathname`;
- derives display project name from slug;
- builds navigation items;
- owns export options local storage;
- builds export submission URL query parameters;
- renders import/export/project navigation sections.

### Why this matters

The drawer is not huge, but it mixes different reasons to change:

- project routing changes;
- navigation IA changes;
- export option changes;
- local-storage persistence changes;
- visual layout changes.

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

Longer term, the shell should receive real project context from a project layout or route context instead of deriving a project title from the slug.

### Trade-off

Do not over-design the shell too early. The split becomes more useful once project route context is centralized.

## Finding 13: numeric rubric editing parses too eagerly

### Current behavior

The rubric editor uses a number field that immediately applies `Number(event.target.value)` on every change.

This breaks natural intermediate states such as:

```txt
-
-0
1.
0.

```

### Why this matters

Rubric editing needs precise numeric input. Eager numeric coercion can fight the user and create accidental values.

This aligns with #68.

### Candidate rewrite

Introduce a string-backed numeric draft component:

```txt
src/ui/NumericDraftField.tsx
```

or colocated under questions/rubrics if only used there at first:

```txt
src/questions/NumericDraftField.tsx
```

Behavior:

- store draft text while focused;
- allow intermediate states;
- parse on blur or submit;
- show validation without rewriting text too early;
- preserve numeric value type in the submitted payload.

### Tests to add

- can type `-`;
- can type `-0`;
- can type `1.`;
- can type decimal values;
- invalid state blocks submit or shows validation;
- blur normalizes only when appropriate.

## Finding 14: grading clients duplicate stable workflow behavior

### Current behavior

The question-by-question grading client and the submission-overview grading client both handle:

- current submission lookup;
- previous/next submission navigation;
- quick-jump dialog state;
- keyboard shortcut for lookup;
- optimistic save state;
- save-error shaping;
- submission label lookup.

Some reuse already exists through `useAssessmentSession`, which is good. But more duplication appears stable enough to extract.

### Candidate extractions

```txt
src/grading/useSubmissionQuickJumpShortcut.ts
src/grading/SubmissionNavigation.tsx
src/grading/useCurrentSubmission.ts
src/grading/buildSaveErrorContext.ts
```

### Caution

Do not abstract the whole grading client into one mega-component. The overview-by-submission and question-by-question UIs are different. Extract the repeated workflow pieces only.

## Finding 15: server actions are colocated with workflows, but their contracts need clearer boundaries

### Current behavior

Question actions are close to question UI and schemas. Assessment save action is a thin wrapper around DB save. Import actions use shared import error utilities.

This is mostly good colocation.

The problem is that action contracts are not always explicit enough. Some actions return user-facing states, some thinly delegate to DB functions, and some rely on route/page refresh patterns.

### Candidate direction

Keep actions near their workflow, but make a consistent action pattern:

```txt
parse form/input
call command/service
map domain/application errors to action state
return typed action result
```

Avoid putting heavy business logic directly in actions. Avoid actions delegating straight into `db/*` modules that also own validation and cache invalidation.

### Example target

```txt
src/questions/actions.ts
src/questions/saveQuestion.ts
src/questions/questionErrors.ts
src/questions/questionSchemas.ts
```

The action should not know Kysely. The command should not know React action state.

## Finding 16: cache tags and invalidation are useful but scattered

### Current behavior

There is a cache tag helper module. Loaders use tags such as projects, questions, submissions, assessments, and question-scoped assessment tags. Mutations update tags.

This is a good foundation. The problem is that invalidation policy is spread across DB modules and actions rather than documented as a map.

### Why this matters

As the app grows, stale data bugs are likely unless cache invalidation is explicitly mapped. #59 already identifies this as an area needing audit.

### Candidate direction

Create a cache policy document or module:

```txt
src/cache/cacheTags.ts
src/cache/cacheInvalidation.ts
```

or keep the helper in `src/db` temporarily but document mutation-to-tag behavior.

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

save question
  -> questions
  -> assessments aggregate
  -> question-specific assessment tags

import students/submissions
  -> submissions
  -> progress and dashboard tags
```

### Caution

Do not hide cache invalidation too far away from writes. It should be centralized enough to be consistent but visible enough during write-path review.

## Finding 17: `shared` is too broad as an ownership bucket

### Current behavior

`src/shared` contains app shell components, save error provider/display, links, code snippets, and shell-specific helpers.

### Why this matters

`shared` is a low-information name. It tends to become a dumping ground.

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

### Caution

Do this as a mechanical move after more important command/read-model splits, unless it blocks other work.

## Finding 18: route handlers contain export-specific infrastructure that could be factored

### Current behavior

Export route handlers load project context, parse options, create export data, build CSV/YAML response bodies, and construct filenames.

The submissions export route also manually builds a `ReadableStream` and stringifies headers/rows.

### Why this matters

This is not terrible, but response-building behavior is repeated or likely to be repeated as exports grow.

### Candidate split

```txt
src/exports/http.ts
src/exports/filenames.ts
src/exports/submissions/routeSupport.ts
src/exports/questions/routeSupport.ts
```

Possible helpers:

```ts
csvStreamResponse({ filename, headers, rows })
yamlDownloadResponse({ filename, body })
buildDatedFilename({ prefix, slug, extension })
```

### Caution

Only extract this after export semantics are clearer. The export state machine is the more important rewrite.

## Finding 19: several components are reasonably split and should not be over-refactored

Not everything needs rewriting.

Examples that look reasonably scoped:

- `RubricEditorList` dispatches to rubric-type-specific editor components and owns list operations. This is acceptable.
- `QuestionForm` is not too large and mostly coordinates draft state, payload creation, errors, and form submission.
- Type-specific rubric editor components are small.
- `BaseImportForm` is somewhat broad, but it is a reusable UI shell rather than a correctness-critical mixed persistence module.

The goal should be to split overloaded correctness-sensitive modules first, not to maximize the number of files.

## Candidate target shape

This is not a final decision. It is a concrete shape that reflects the audit findings while staying relatively flat.

```txt
src/
  grading/
    assessmentTypes.ts
    assessmentErrors.ts
    assessmentValidation.ts
    assessmentRepository.ts
    saveAssessment.ts
    saveAssessment.action.ts
    loadSubmissionAssessmentOverview.ts
    loadQuestionAssessmentPage.ts
    progressTypes.ts
    buildSubmissionProgress.ts
    buildGlobalProgress.ts
    useAssessmentSession.ts
    useSubmissionQuickJumpShortcut.ts
    SubmissionNavigation.tsx
    SubmissionAssessmentClient.tsx
    SubmissionOverviewAssessmentClient.tsx
    RubricGradeList.tsx

  questions/
    questionTypes.ts
    questionReadModel.ts
    questionRepository.ts
    questionValidation.ts
    saveQuestion.ts
    deleteQuestion.ts
    reorderQuestions.ts
    actions.ts
    schemas.ts
    QuestionsManagementClient.tsx
    QuestionForm.tsx
    RubricEditorList.tsx

  imports/
    assessments/
      parseAssessmentsCsv.ts
      prepareAssessmentImport.ts
      saveAssessmentImport.ts
      assessmentImportPreview.ts
      AssessmentsImportForm.tsx
    students/
    questions/
    BaseImportForm.tsx
    actionUtils.ts

  exports/
    submissions/
      exportOptions.ts
      loadSubmissionExportPlan.ts
      streamSubmissionAssessmentRows.ts
      groupSubmissionRows.ts
      buildSubmissionExportRows.ts
      submissionExportCsv.ts
      createSubmissionExport.ts
    questions/
      questionsExport.ts
      routeSupport.ts
    http.ts
    filenames.ts

  projects/
    projectTypes.ts
    projectRepository.ts
    projectRouteContext.ts
    projectPaths.ts

  rubrics/
    rubricTypes.ts
    rubric.ts
    rubricMarking.ts
    rubricAssessment.ts

  submissions/
    submissionTypes.ts
    getSubmissionLabel.ts
    submissionNavigation.ts
    quickJumpSearch.ts

  db/
    kysely.ts
    generated/
    migrations/

  cache/
    cacheTags.ts
    cacheInvalidation.ts

  ui/
    app-shell/
    feedback/
    code/
    NumericDraftField.tsx
    MuiNextLink.tsx
```

This is intentionally flatter than a strict layered architecture. It colocates by workflow/domain while still making technical roles visible through filenames.

## Prioritized rewrite backlog

### Priority 1: project route context

Why first:

- affects most route files;
- needed for future auth/project ownership;
- reduces repeated slug/id/path boilerplate;
- aligns with #51.

Suggested deliverables:

- decide stored slug vs computed slug vs no slug;
- introduce `projectRouteContext` helper;
- rename path builder module if desired;
- migrate one or two pages as examples before bulk migration.

### Priority 2: submission overview loader

Why second:

- likely improves performance;
- simplifies a core grading page;
- establishes read-model pattern for grading pages.

Suggested deliverables:

- add `loadSubmissionAssessmentOverview`;
- replace per-question `loadAssessment` calls;
- add integration tests for mixed rubric types and sparse assessments.

### Priority 3: split question/rubric persistence

Why third:

- correctness-sensitive;
- large file;
- blocks clean import/export reuse;
- already identified by reliability audit.

Suggested deliverables:

- extract validation/mapping/read model first;
- then split save/delete/reorder commands.

### Priority 4: split assessment save path

Why fourth:

- central write path;
- shared by interactive grading and imports;
- currently DB module owns too much.

Suggested deliverables:

- extract assessment command validation;
- extract assessment repository;
- design transaction-friendly command API;
- keep tests green after each step.

### Priority 5: progress/read-model consolidation

Why fifth:

- repeated business semantics;
- important for consistency;
- interacts with caching audit #59.

Suggested deliverables:

- document completion semantics;
- extract pure builders;
- then adjust DB loaders around those builders.

### Priority 6: numeric draft field

Why sixth:

- small focused UX win;
- low risk;
- addresses #68.

Suggested deliverables:

- add `NumericDraftField`;
- replace rubric numeric fields;
- test intermediate input states.

### Priority 7: export stream split

Why seventh:

- correctness-sensitive but already has some test coverage;
- splitting will make future export work safer.

Suggested deliverables:

- split stream grouping from CSV formatting;
- add stream boundary tests.

### Priority 8: import preview model

Why eighth:

- large UX/design change;
- related to #110;
- should be designed carefully.

Suggested deliverables:

- define preview model first;
- apply to student import or assessment import as pilot.

### Priority 9: app shell split

Why ninth:

- improves DX but not central correctness;
- easier after project route context is redesigned.

Suggested deliverables:

- extract export options hook/panel;
- extract navigation item builder;
- move shared shell files under `ui/app-shell`.

## Follow-up issue candidates

The following could be split out from #115 if smaller implementation issues are useful.

### Candidate issue: redesign project route context and slug handling

Scope:

- decide whether to store slug;
- add project route context helper;
- reduce repeated route boilerplate;
- possibly rename `routes.ts` to `projectPaths.ts`.

Related: #51, #115.

### Candidate issue: add submission assessment overview read model

Scope:

- replace per-question assessment loading on submission overview page;
- add integration tests;
- clarify cache tags.

Related: #59, #115.

### Candidate issue: split question/rubric persistence module

Scope:

- split `src/db/questions.ts`;
- preserve behavior;
- improve tests around save/delete/reorder.

Related: reliability audit, #115.

### Candidate issue: split assessment save command from DB module

Scope:

- split `src/db/assessments.ts`;
- introduce transaction-friendly command API;
- preserve import behavior.

Related: reliability audit, #115.

### Candidate issue: extract grading progress semantics

Scope:

- document completed-question/completed-rubric semantics;
- extract pure builders;
- align dashboard/list/overview calculations.

Related: #59, #115.

### Candidate issue: rewrite numeric rubric field editing

Scope:

- string-backed numeric draft field;
- replace eager `Number(...)` parsing;
- add regression tests.

Related: #68.

### Candidate issue: split submission export state machine

Scope:

- split stream row grouping from CSV formatting;
- add tests for stream boundaries, sparse assessments, and ordering.

Related: reliability audit, #115.

### Candidate issue: design import preview/confirmation flow

Scope:

- parse-preview-confirm flow;
- show ignored columns and unmatched submissions;
- decide missing-submission policy.

Related: #110, #115.

## Open questions

### Project slugs

- Should project slugs be stored, computed, or removed from canonical URLs?
- Should slugs update when names change?
- Should old slugs redirect?
- Should slugs be user-editable?
- Should filenames use project slug, project id, or project name?

### Project identifiers

- Should `project.id` become the public id and `project.row_id` the internal id, aligning with #51?
- How should route params map to DB identifiers after that migration?

### Read models

- Should grading page loaders return UI-ready models, or should pages assemble domain objects?
- How much should loaders know about cache tags?
- Should read models live under `grading`, `questions`, or a generic `readModels` area?

### Commands and transactions

- What is the preferred pattern for commands that need to run both standalone and inside a larger import transaction?
- Should command functions accept an optional transaction object?
- Should repositories expose factory functions bound to a transaction?

### Cache invalidation

- Should invalidation live inside commands, repositories, or separate cache-policy functions?
- How can cache policy remain visible during review?
- Which pages must be fresh immediately after each mutation?

### Import behavior

- Should missing submissions block assessment import?
- Should import preview be mandatory?
- Should import support marks-only CSV columns or only assessment-value columns?
- Should imports overwrite existing assessments by default?

### Folder structure

- Is the proposed flat module shape enough, or do some modules need `domain/server/ui` subfolders?
- Should UI-only shared components move before or after command/read-model rewrites?
- Should `rubrics` remain a shared domain folder even if rubric editing UI lives under `questions`?

## Non-goals

This investigation does not recommend:

- a full rewrite;
- microservices;
- multiple packages;
- a strict clean architecture hierarchy;
- moving all code under `app/`;
- extracting every duplicated pattern immediately;
- optimizing every page before fixing the core grading and import/export seams.

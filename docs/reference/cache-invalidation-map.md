# Cache invalidation map

This map is the canonical record of which mutations invalidate which cache tags, and which cached scopes register each tag. It is maintained alongside `src/db/cacheTags.ts` and `src/db/cacheInvalidation.ts` as required by ADR 0008 rule 7: any PR that adds, removes, or renames a tag helper, a semantic invalidation helper, a cached scope, or a mutation's invalidation call must update this document in the same change.

See `docs/adr/0008-cache-tags-lifetimes-and-invalidation.md` for the rules that govern tag helpers, lifetimes, invalidation primitives, and the policy classes. See `docs/guides/nextjs-caching.md` for the four-layer model.

## Tag scopes

| Helper | Tag string | Scope |
|---|---|---|
| `projectListCacheTag()` | `projects` | All projects |
| `projectCacheTag(id)` | `projects:{id}` | One project, by public Project ID |
| `questionListCacheTag()` | `questions` | All questions in scope |
| `submissionListCacheTag()` | `submissions` | All submissions in scope |
| `assessmentAggregateCacheTag()` | `assessments` | All assessments in scope (busted by every save) |
| `assessmentImportCacheTag()` | `assessments:all` | Import-level aggregate (busted by imports and definition changes, not individual saves) |
| `assessmentForSubmissionCacheTag(sub)` | `assessments:{sub}` | All questions for one submission |
| `assessmentForSubmissionQuestionCacheTag({sub, q})` | `assessments:{sub}:{q}` | Exact submission/question pair |
| `assessmentProgressForQuestionCacheTag(q)` | `assessments:question:{q}` | One question's progress across all submissions |

## Mutations → tags invalidated

Each mutation calls exactly one semantic helper from `src/db/cacheInvalidation.ts` after its transaction commits (ADR 0008 rule 6). The helper picks the primitive per tag class: `updateTag` (read-your-own-writes) expires the entry immediately and is used for the tags of the entity just edited, so the editor sees its own change; `revalidateTag("max")` serves stale data while refreshing in the background and is used for coarse aggregate and derived projection tags, so a save never blocks the next navigation on recomputing project-wide completion.

| Mutation | Helper | `updateTag` (read-your-writes) | `revalidateTag` (stale-while-revalidate) | Source |
|---|---|---|---|---|
| `saveAssessment` | `invalidateAssessmentSave` | `assessments:{sub}:{q}`, `assessments:{sub}` | `assessments`, `assessments:question:{q}` | `src/assessments/assessmentMutations.ts` |
| `saveQuestionDefinition` | `invalidateQuestionDefinitionSave` | `questions` | `assessments`, `assessments:all`, `assessments:question:{id}` (+ `assessments:question:{originalId}` when id changes) | `src/questions/questionDefinitionMutations.ts` |
| `deleteQuestionDefinition` | `invalidateQuestionDefinitionDelete` | `questions` | `assessments`, `assessments:all`, `assessments:question:{id}` | `src/questions/questionDefinitionMutations.ts` |
| `reorderQuestions` | `invalidateQuestionReorder` | `questions` | (none) | `src/questions/questionDefinitionMutations.ts` |
| `createProject` | `invalidateProjectCreate` | (none) | `projects`, `projects:{id}` | `src/projects/projects.ts` |
| `saveAssessments` (import) | `invalidateAssessmentImport` | (none) | `assessments`, `assessments:all` | `src/import/saveAssessments.ts` |
| `saveQuestions` (import) | `invalidateQuestionImport` | (none) | `questions`, `assessments`, `assessments:all` | `src/import/saveQuestions.ts` |
| `saveStudents` (import) | `invalidateStudentImport` | (none) | `submissions`, `assessments`, `assessments:all` | `src/import/saveStudents.ts` |

Import helpers and `invalidateProjectCreate` run from request-scoped actions (import actions, the create-project action). `revalidateTag` throws outside request scope, so these helpers must not be called from background jobs.

## Readers → tags registered

Page-level sections inherit `cacheLife` from inner cached functions; the lifetime column reflects the innermost explicit declaration.

| Cached scope | Tags registered | `cacheLife` | Source |
|---|---|---|---|
| `loadProjectList` | `projects` | 60 s | `src/projects/projects.ts` |
| `loadProjectByPublicId` | `projects`, `projects:{id}` | 60 s | `src/projects/projects.ts` |
| `loadQuestionRows` | `questions` | 1 h | `src/questions/questions.ts` |
| `loadQuestionGrid` | `questions` | **none** (Finding 3; fix in PR5) | `src/questions/questions.ts` |
| `loadSubmissions` | `submissions` | **none** (Finding 3; fix in PR5) | `src/submissions/submissions.ts` |
| `loadQuestionAssessment` | `assessments:{sub}:{q}`, `assessments:all` | **none** (Finding 3; fix in PR5) | `src/assessments/assessments.ts` |
| `loadSubmissionAssessments` | `assessments:{sub}`, `assessments:all` | **none** (Finding 3; fix in PR5) | `src/assessments/assessments.ts` |
| `loadAssessmentCompletionBySubmission` | `submissions`, `questions`, `assessments` | 60 s | `src/assessments/loadAssessmentCompletion.ts` |
| `loadAssessedRubricCountsBySubmission` | `submissions`, `questions`, `assessments:question:{q}`, `assessments:all` | 60 s | `src/assessments/loadAssessmentCompletion.ts` |
| `loadAssessmentCompletionSummary` | `submissions`, `questions`, `assessments` | 60 s | `src/assessments/loadAssessmentCompletion.ts` |
| `loadRubricOverviewData` | `questions`, `submissions`, `assessments` | 60 s | `src/assessments/rubricOverview.ts` |
| `QuestionHeaderSection` (page) | `projects:{id}`, `questions` | inherits | `app/.../questions/[questionId]/page.tsx` |
| `SubmissionRubricSection` (page) | `projects:{id}`, `questions`, `submissions`, `assessments:{sub}:{q}`, `assessments:question:{q}`, `assessments:all` | inherits | `app/.../questions/[questionId]/page.tsx` |
| `ProjectAssessmentPageContent` (page) | `projects:{id}`, `questions`, `submissions`, `assessments` | inherits | `app/.../assessments/page.tsx` |

## Maintenance rule

Any PR that:
- adds or removes a tag helper in `src/db/cacheTags.ts`,
- adds, removes, or changes a semantic invalidation helper in `src/db/cacheInvalidation.ts`,
- changes which tags a cached scope registers, or
- changes which tags or primitive a mutation invalidates

**must** update this map in the same PR. Reviewers reject caching changes with a missing or stale map entry (ADR 0008 rule 7).

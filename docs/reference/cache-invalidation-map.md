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
| `loadQuestionRows` (shared by `loadQuestionGrid`, `loadQuestion`, which derive from it) | `questions` | 1 h (`definitions`) | `src/questions/questions.ts` |
| `loadQuestionDefinitions` (composes `loadQuestionRows` + assessment counts) | `questions`, `assessments` | 60 s (`projection`; counts track the coarse aggregate) | `src/questions/questionDefinitions.ts` |
| `loadSubmissions` | `submissions` | 1 h (`roster`) | `src/submissions/submissions.ts` |
| `loadQuestionAssessment` | `assessments:{sub}:{q}`, `assessments:all` | 5 min (`values`) | `src/assessments/assessments.ts` |
| `loadSubmissionAssessments` | `assessments:{sub}`, `assessments:all` | 5 min (`values`) | `src/assessments/assessments.ts` |
| `loadAssessmentCompletionRows` (shared by `loadAssessmentCompletionBySubmission` and `loadAssessmentCompletionSummary`, plain derivers that compose it) | `submissions`, `questions`, `assessments` | 60 s | `src/assessments/loadAssessmentCompletion.ts` |
| `loadRubricAssessmentsCount` (composed by `loadAssessmentCompletionSummary` alongside `loadAssessmentCompletionRows`) | `assessments` | 60 s | `src/assessments/loadAssessmentCompletion.ts` |
| `loadAssessedRubricCountsBySubmission` | `submissions`, `questions`, `assessments:question:{q}`, `assessments:all` | 60 s | `src/assessments/loadAssessmentCompletion.ts` |
| `loadRubricOverviewData` | `questions`, `submissions`, `assessments` | 60 s | `src/assessments/rubricOverview.ts` |
| `QuestionHeaderSection` (page) | `projects:{id}`, `questions` | inherits | `app/.../questions/[questionId]/page.tsx` |

`SubmissionRubricSection` and `ProjectAssessmentPageContent` have no page-level `"use cache"` wrapper: each calls already-cached loaders directly. The per-submission progress used by the on-demand lookup dialog (or, on the assessments index, the inline progress badges) still comes from those cached loaders (`loadAssessedRubricCounts`, `loadAssessmentCompletionBySubmission` — both deriving from the cached entries in the table above) — only the page-level `await` is removed, so the *page render* doesn't block on it; it streams in under Suspense instead of blocking navigation on a project-wide completion recompute (Finding 19, PR10).

## Maintenance rule

Any PR that:
- adds or removes a tag helper in `src/db/cacheTags.ts`,
- adds, removes, or changes a semantic invalidation helper in `src/db/cacheInvalidation.ts`,
- changes which tags a cached scope registers, or
- changes which tags or primitive a mutation invalidates

**must** update this map in the same PR. Reviewers reject caching changes with a missing or stale map entry (ADR 0008 rule 7).

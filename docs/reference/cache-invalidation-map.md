# Cache invalidation map

This map is the canonical record of which mutations invalidate which cache tags, and which cached scopes register each tag. It is maintained alongside `src/db/cacheTags.ts` and `src/db/cacheInvalidation.ts` as required by ADR 0008 rule 7: any PR that adds, removes, or renames a tag helper, a semantic invalidation helper, a cached scope, or a mutation's invalidation call must update this document in the same change.

See `docs/adr/0008-cache-tags-lifetimes-and-invalidation.md` for the rules that govern tag helpers, lifetimes, invalidation primitives, and the policy classes. See `docs/guides/nextjs-caching.md` for the four-layer model.

## Tag scopes

| Helper | Tag string | Scope |
|---|---|---|
| `projectListCacheTag()` | `projects` | All projects |
| `projectCacheTag(id)` | `projects:{id}` | One project, by public Project ID |
| `rubricListCacheTag()` | `rubrics` | All rubrics in scope |
| `gradeTargetListCacheTag()` | `grade-targets` | All grade targets in scope |
| `assessmentAggregateCacheTag()` | `assessments` | All assessments in scope (busted by every save) |
| `assessmentImportCacheTag()` | `assessments:all` | Import-level aggregate (busted by imports and definition changes, not individual saves) |
| `assessmentForGradeTargetCacheTag(target)` | `assessments:{target}` | All rubrics for one grade target |
| `assessmentForGradeTargetRubricCacheTag({target, rubric})` | `assessments:{target}:{rubric}` | Exact grade-target/rubric pair |
| `assessmentProgressForRubricCacheTag(rubric)` | `assessments:rubric:{rubric}` | One rubric's progress across all grade targets |

## Mutations → tags invalidated

Each mutation calls exactly one semantic helper from `src/db/cacheInvalidation.ts` after its transaction commits (ADR 0008 rule 6). The helper picks the primitive per tag class: `updateTag` (read-your-own-writes) expires the entry immediately and is used for the tags of the entity just edited, so the editor sees its own change; `revalidateTag("max")` serves stale data while refreshing in the background and is used for coarse aggregate and derived projection tags, so a save never blocks the next navigation on recomputing project-wide completion.

| Mutation | Helper | `updateTag` (read-your-writes) | `revalidateTag` (stale-while-revalidate) | Source |
|---|---|---|---|---|
| `saveAssessment` | `invalidateAssessmentSave` | `assessments:{target}:{rubric}`, `assessments:{target}` | `assessments`, `assessments:rubric:{rubric}` | `src/assessment-capture/assessmentMutations.ts` |
| `saveRubricDefinition` | `invalidateRubricDefinitionSave` | `rubrics` | `assessments`, `assessments:all`, `assessments:rubric:{id}` (+ `assessments:rubric:{previousId}` when id changes) | `src/rubric-management/rubricDefinitionMutations.ts` |
| `deleteRubricDefinition` | `invalidateRubricDefinitionDelete` | `rubrics` | `assessments`, `assessments:all`, `assessments:rubric:{id}` | `src/rubric-management/rubricDefinitionMutations.ts` |
| `reorderRubrics` | `invalidateRubricReorder` | `rubrics` | (none) | `src/rubric-management/rubricDefinitionMutations.ts` |
| `createProject` | `invalidateProjectCreate` | (none) | `projects`, `projects:{id}` | `src/projects/projects.ts` |
| `saveAssessments` (import) | `invalidateAssessmentImport` | (none) | `assessments`, `assessments:all` | `src/imports/assessments/saveAssessments.ts` |
| `saveRubrics` (import) | `invalidateRubricImport` | (none) | `rubrics`, `assessments`, `assessments:all` | `src/imports/rubrics/saveRubrics.ts` |
| `saveStudents` (import) | `invalidateStudentImport` | (none) | `grade-targets`, `assessments`, `assessments:all` | `src/imports/students/saveStudents.ts` |

Import helpers and `invalidateProjectCreate` run from request-scoped actions (import actions, the create-project action). `revalidateTag` throws outside request scope, so these helpers must not be called from background jobs.

## Readers → tags registered

Page-level sections inherit `cacheLife` from inner cached functions; the lifetime column reflects the innermost explicit declaration.

| Cached scope | Tags registered | `cacheLife` | Source |
|---|---|---|---|
| `loadProjectList` | `projects` | 60 s | `src/projects/projects.ts` |
| `loadProjectByPublicId` | `projects`, `projects:{id}` | 60 s | `src/projects/projects.ts` |
| `loadRubricRows` (shared by `loadRubricsById`, `loadRubric`, which derive from it) | `rubrics` | 1 h (`definitions`) | `src/rubrics/rubrics.ts` |
| `loadRubricDefinitions` (composes `loadRubricRows` + assessment counts) | `rubrics`, `assessments` | 60 s (`projection`; counts track the coarse aggregate) | `src/rubric-management/rubricDefinitions.ts` |
| `loadGradeTargets` | `grade-targets` | 1 h (`roster`) | `src/grade-targets/gradeTargets.ts` |
| `loadRubricAssessment` | `assessments:{target}:{rubric}`, `assessments:all` | 5 min (`values`) | `src/assessment-capture/assessments.ts` |
| `loadGradeTargetAssessments` | `assessments:{target}`, `assessments:all` | 5 min (`values`) | `src/assessment-capture/assessments.ts` |
| `loadAssessmentCompletionRows` (shared by `loadAssessmentCompletionByTarget` and `loadAssessmentCompletionSummary`, plain derivers that compose it) | `grade-targets`, `rubrics`, `assessments` | 60 s | `src/assessment-completion/loadAssessmentCompletion.ts` |
| `loadCriterionAssessmentsCount` (composed by `loadAssessmentCompletionSummary` alongside `loadAssessmentCompletionRows`) | `assessments` | 60 s | `src/assessment-completion/loadAssessmentCompletion.ts` |
| `loadAssessedCriterionCountsByTarget` | `grade-targets`, `rubrics`, `assessments:rubric:{rubric}`, `assessments:all` | 60 s | `src/assessment-completion/loadAssessmentCompletion.ts` |
| `loadResultsData` | `rubrics`, `grade-targets`, `assessments` | 60 s (`projection`) | `src/results/loadResults.ts` |
| `RubricHeaderSection` (page) | `projects:{id}`, `rubrics` | inherits | `app/.../rubrics/[rubricId]/page.tsx` |

`GradeTargetCriterionSection` and `ProjectGradesPageContent` have no page-level `"use cache"` wrapper: each calls already-cached loaders directly. The per-target progress used by the on-demand lookup dialog (or, on the grades index, the inline progress badges) still comes from those cached loaders (`loadAssessedCriterionCounts`, `loadAssessmentCompletionByTarget` — both deriving from the cached entries in the table above) — only the page-level `await` is removed, so the *page render* doesn't block on it; it streams in under Suspense instead of blocking navigation on a project-wide completion recompute (Finding 19, PR10).

## Maintenance rule

Any PR that:
- adds or removes a tag helper in `src/db/cacheTags.ts`,
- adds, removes, or changes a semantic invalidation helper in `src/db/cacheInvalidation.ts`,
- changes which tags a cached scope registers, or
- changes which tags or primitive a mutation invalidates

**must** update this map in the same PR. Reviewers reject caching changes with a missing or stale map entry (ADR 0008 rule 7).

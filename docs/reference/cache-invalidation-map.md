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
| `gradeAggregateCacheTag()` | `grades` | All grades in scope (busted by every save) |
| `gradeImportCacheTag()` | `grades:all` | Import-level aggregate (busted by imports and definition changes, not individual saves) |
| `gradeForGradeTargetCacheTag(target)` | `grades:{target}` | All rubrics for one grade target |
| `gradeForGradeTargetRubricCacheTag({target, rubric})` | `grades:{target}:{rubric}` | Exact grade-target/rubric pair |
| `gradeCompletionForRubricCacheTag(rubric)` | `grades:rubric:{rubric}` | One rubric's completion across all grade targets |

Scoping caveat: `{target}` and `{rubric}` are public ids, unique only within a grid, so the three id-keyed tags above collide across grids (e.g. `t-1` in two grids shares `grades:t-1`). The effect is over-invalidation — an extra rebuild in the other grid — never stale data. Grid-scoping these tags is folded into the Project→Grid stage of the terminology sweep (`plans/2026-07-06-terminology-sweep.md`, stage 6).

## Mutations → tags invalidated

Each mutation calls exactly one semantic helper from `src/db/cacheInvalidation.ts` after its transaction commits (ADR 0008 rule 6). The helper picks the primitive per tag class: `updateTag` (read-your-own-writes) expires the entry immediately and is used for the tags of the entity just edited, so the editor sees its own change; `revalidateTag("max")` serves stale data while refreshing in the background and is used for coarse aggregate and derived projection tags, so a save never blocks the next navigation on recomputing project-wide completion.

| Mutation | Helper | `updateTag` (read-your-writes) | `revalidateTag` (stale-while-revalidate) | Source |
|---|---|---|---|---|
| `saveCriterionGrade` | `invalidateGradeSave` | `grades:{target}:{rubric}`, `grades:{target}` | `grades`, `grades:rubric:{rubric}` | `src/grading/gradeMutations.ts` |
| `saveRubricDefinition` | `invalidateRubricDefinitionSave` | `rubrics` | `grades`, `grades:all`, `grades:rubric:{id}` (+ `grades:rubric:{previousId}` when id changes) | `src/rubric-management/rubricDefinitionMutations.ts` |
| `deleteRubricDefinition` | `invalidateRubricDefinitionDelete` | `rubrics` | `grades`, `grades:all`, `grades:rubric:{id}` | `src/rubric-management/rubricDefinitionMutations.ts` |
| `reorderRubrics` | `invalidateRubricReorder` | `rubrics` | (none) | `src/rubric-management/rubricDefinitionMutations.ts` |
| `createProject` | `invalidateProjectCreate` | (none) | `projects`, `projects:{id}` | `src/projects/projects.ts` |
| `saveGrades` (import) | `invalidateGradeImport` | (none) | `grades`, `grades:all` | `src/imports/grades/saveGrades.ts` |
| `saveRubrics` (import) | `invalidateRubricImport` | (none) | `rubrics`, `grades`, `grades:all` | `src/imports/rubrics/saveRubrics.ts` |
| `saveStudents` (import) | `invalidateStudentImport` | (none) | `grade-targets`, `grades`, `grades:all` | `src/imports/students/saveStudents.ts` |

Import helpers and `invalidateProjectCreate` run from request-scoped actions (import actions, the create-project action). `revalidateTag` throws outside request scope, so these helpers must not be called from background jobs.

## Readers → tags registered

Page-level sections inherit `cacheLife` from inner cached functions; the lifetime column reflects the innermost explicit declaration.

| Cached scope | Tags registered | `cacheLife` | Source |
|---|---|---|---|
| `loadProjectList` | `projects` | 60 s | `src/projects/projects.ts` |
| `loadProjectByPublicId` | `projects`, `projects:{id}` | 60 s | `src/projects/projects.ts` |
| `loadRubricRows` (shared by `loadRubricsById`, `loadRubric`, which derive from it) | `rubrics` | 1 h (`definitions`) | `src/rubrics/rubrics.ts` |
| `loadRubricDefinitions` (composes `loadRubricRows` + grade counts) | `rubrics`, `grades` | 60 s (`projection`; counts track the coarse aggregate) | `src/rubric-management/rubricDefinitions.ts` |
| `loadGradeTargets` | `grade-targets` | 1 h (`roster`) | `src/grade-targets/gradeTargets.ts` |
| `loadRubricGrade` | `grades:{target}:{rubric}`, `grades:all` | 5 min (`values`) | `src/grading/grades.ts` |
| `loadGradeTargetGrades` | `grades:{target}`, `grades:all` | 5 min (`values`) | `src/grading/grades.ts` |
| `loadGradeCompletionRows` (shared by `loadGradeCompletionByTarget` and `loadGradeCompletionSummary`, plain derivers that compose it) | `grade-targets`, `rubrics`, `grades` | 60 s | `src/grade-completion/loadGradeCompletion.ts` |
| `loadCriterionGradesCount` (composed by `loadGradeCompletionSummary` alongside `loadGradeCompletionRows`) | `grades` | 60 s | `src/grade-completion/loadGradeCompletion.ts` |
| `loadGradedCriterionCountsByTarget` | `grade-targets`, `rubrics`, `grades:rubric:{rubric}`, `grades:all` | 60 s | `src/grade-completion/loadGradeCompletion.ts` |
| `loadResultsData` | `rubrics`, `grade-targets`, `grades` | 60 s (`projection`) | `src/results/loadResults.ts` |
| `RubricHeaderSection` (page) | `projects:{id}`, `rubrics` | inherits | `app/.../rubrics/[rubricId]/page.tsx` |

`GradeTargetCriterionSection` and `ProjectGradesPageContent` have no page-level `"use cache"` wrapper: each calls already-cached loaders directly. The per-target completion used by the on-demand lookup dialog (or, on the grades index, the inline completion badges) still comes from those cached loaders (`loadGradedCriterionCounts`, `loadGradeCompletionByTarget` — both deriving from the cached entries in the table above) — only the page-level `await` is removed, so the *page render* doesn't block on it; it streams in under Suspense instead of blocking navigation on a project-wide completion recompute (Finding 19, PR10).

## Maintenance rule

Any PR that:
- adds or removes a tag helper in `src/db/cacheTags.ts`,
- adds, removes, or changes a semantic invalidation helper in `src/db/cacheInvalidation.ts`,
- changes which tags a cached scope registers, or
- changes which tags or primitive a mutation invalidates

**must** update this map in the same PR. Reviewers reject caching changes with a missing or stale map entry (ADR 0008 rule 7).

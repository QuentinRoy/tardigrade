# Cache invalidation map

This map is the canonical record of which mutations invalidate which cache tags, and which cached scopes register each tag. It is maintained alongside `src/db/cacheTags.ts` and `src/db/cacheInvalidation.ts` as required by ADR 0008 rule 7: any PR that adds, removes, or renames a tag helper, a semantic invalidation helper, a cached scope, or a mutation's invalidation call must update this document in the same change.

See `docs/adr/0008-cache-tags-lifetimes-and-invalidation.md` for the rules that govern tag helpers, lifetimes, invalidation primitives, and the policy classes. See `docs/guides/nextjs-caching.md` for the four-layer model.

## Tag scopes

Every tag except `allGridsTag` is grid-scoped under the `grids:{gridId}:…` namespace (ADR 0008 rule 8), so a mutation in one grid never invalidates another grid's reads. Author-chosen ids (grade target, rubric) always sit behind a literal discriminator (`target:`, `rubric:`), so no two tag shapes can alias. Every helper takes a named-object argument.

| Helper | Tag string | Scope |
|---|---|---|
| `allGridsTag()` | `grids` | All grids (the only grid-unscoped tag) |
| `gridTag({gridId})` | `grids:{gridId}` | One grid, by public Grid ID |
| `allRubricsTag({gridId})` | `grids:{gridId}:rubrics` | All rubrics in the grid |
| `allTargetsTag({gridId})` | `grids:{gridId}:grade-targets` | All grade targets in the grid |
| `allGradesTag({gridId})` | `grids:{gridId}:grades` | All grades in the grid (busted by saves, imports, and definition changes) |
| `allTargetGradesTag({gridId, targetId})` | `grids:{gridId}:grades:target:{targetId}` | All rubrics for one grade target |
| `allTargetRubricGradesTag({gridId, targetId, rubricId})` | `grids:{gridId}:grades:target:{targetId}:rubric:{rubricId}` | All grade rows for one grade-target/rubric cohort |
| `gradeCompletionByRubricTag({gridId, rubricId})` | `grids:{gridId}:grades:rubric:{rubricId}` | One rubric's completion across the grid's grade targets |

## Mutations → tags invalidated

In the tables below, `…` abbreviates the `grids:{gridId}` prefix that scopes every mutation and read to a single grid; the leading `grids`/`grids:{gridId}` tags are shown in full.

Each mutation calls exactly one semantic helper from `src/db/cacheInvalidation.ts` after its transaction commits (ADR 0008 rule 6). The helper picks the primitive per tag class: `updateTag` (read-your-own-writes) expires the entry immediately and is used for the tags of the entity just edited, so the editor sees its own change; `revalidateTag("max")` serves stale data while refreshing in the background and is used for coarse aggregate and derived projection tags, so a save never blocks the next navigation on recomputing grid-wide completion.

| Mutation | Helper | `updateTag` (read-your-writes) | `revalidateTag` (stale-while-revalidate) | Source |
|---|---|---|---|---|
| `saveCriterionGrade` | `invalidateGradeSave` | `…:grades:target:{targetId}:rubric:{rubricId}`, `…:grades:target:{targetId}` | `…:grades`, `…:grades:rubric:{rubricId}` | `src/grading/gradeMutations.ts` |
| `saveRubricDefinition` | `invalidateRubricDefinitionSave` | `…:rubrics` | `…:grades`, `…:grades:rubric:{rubricId}` (+ `…:grades:rubric:{previousRubricId}` when id changes) | `src/rubric-management/rubricDefinitionMutations.ts` |
| `deleteRubricDefinition` | `invalidateRubricDefinitionDelete` | `…:rubrics` | `…:grades`, `…:grades:rubric:{rubricId}` | `src/rubric-management/rubricDefinitionMutations.ts` |
| `reorderRubrics` | `invalidateRubricReorder` | `…:rubrics` | (none) | `src/rubric-management/rubricDefinitionMutations.ts` |
| `createGrid` | `invalidateGridCreate` | (none) | `grids`, `grids:{gridId}` | `src/grids/grids.ts` |
| `saveGrades` (import) | `invalidateGradeImport` | (none) | `…:grades` | `src/imports/grades/saveGrades.ts` |
| `saveRubrics` (import) | `invalidateRubricImport` | (none) | `…:rubrics`, `…:grades` | `src/imports/rubrics/saveRubrics.ts` |
| `saveStudents` (import) | `invalidateStudentImport` | (none) | `…:grade-targets`, `…:grades` | `src/imports/students/saveStudents.ts` |

Import helpers and `invalidateGridCreate` run from request-scoped actions (import actions, the create-grid action). `revalidateTag` throws outside request scope, so these helpers must not be called from background jobs.

## Readers → tags registered

Page-level sections inherit `cacheLife` from inner cached functions; the lifetime column reflects the innermost explicit declaration.

| Cached scope | Tags registered | `cacheLife` | Source |
|---|---|---|---|
| `loadGrids` | `grids` | 60 s | `src/grids/grids.ts` |
| `loadGridByPublicId` | `grids`, `grids:{gridId}` | 60 s | `src/grids/grids.ts` |
| `loadRubricRows` (shared by `loadRubricsById`, `loadRubric`, which derive from it) | `…:rubrics` | 1 h (`definitions`) | `src/rubrics/rubrics.ts` |
| `loadRubricDefinitions` (composes `loadRubricRows` + grade counts) | `…:rubrics`, `…:grades` | 60 s (`projection`; counts track the coarse aggregate) | `src/rubric-management/rubricDefinitions.ts` |
| `loadGradeTargets` | `…:grade-targets` | 1 h (`roster`) | `src/grade-targets/gradeTargets.ts` |
| `loadRubricGrade` | `…:grades:target:{targetId}:rubric:{rubricId}`, `…:grades` | 5 min (`values`) | `src/grading/grades.ts` |
| `loadGradeTargetGrades` | `…:grades:target:{targetId}`, `…:grades` | 5 min (`values`) | `src/grading/grades.ts` |
| `loadGradeCompletionRows` (shared by `loadGradeCompletionByTarget` and `loadGradeCompletionSummary`, plain derivers that compose it) | `…:grade-targets`, `…:rubrics`, `…:grades` | 60 s | `src/grade-completion/loadGradeCompletion.ts` |
| `loadCriterionGradesCount` (composed by `loadGradeCompletionSummary` alongside `loadGradeCompletionRows`) | `…:grades` | 60 s | `src/grade-completion/loadGradeCompletion.ts` |
| `loadGradedCriterionCountsByTarget` | `…:grade-targets`, `…:rubrics`, `…:grades:rubric:{rubricId}`, `…:grades` | 60 s | `src/grade-completion/loadGradeCompletion.ts` |
| `loadResultsData` | `…:rubrics`, `…:grade-targets`, `…:grades` | 60 s (`projection`) | `src/results/loadResults.ts` |
| `RubricHeaderSection` (page) | `grids:{gridId}`, `…:rubrics` | inherits | `app/.../rubrics/[rubricId]/page.tsx` |

`GradeTargetCriterionSection` and `GridGradesPageContent` have no page-level `"use cache"` wrapper: each calls already-cached loaders directly. The per-target completion used by the on-demand lookup dialog (or, on the grades index, the inline completion badges) still comes from those cached loaders (`loadGradedCriterionCounts`, `loadGradeCompletionByTarget` — both deriving from the cached entries in the table above) — only the page-level `await` is removed, so the *page render* doesn't block on it; it streams in under Suspense instead of blocking navigation on a grid-wide completion recompute (Finding 19, PR10).

## Maintenance rule

Any PR that:
- adds or removes a tag helper in `src/db/cacheTags.ts`,
- adds, removes, or changes a semantic invalidation helper in `src/db/cacheInvalidation.ts`,
- changes which tags a cached scope registers, or
- changes which tags or primitive a mutation invalidates

**must** update this map in the same PR. Reviewers reject caching changes with a missing or stale map entry (ADR 0008 rule 7).

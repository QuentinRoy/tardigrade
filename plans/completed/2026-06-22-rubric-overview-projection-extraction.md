Status: Done — #210
Date: 2026-06-22
Source: `docs/investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md` §0/§5 (remaining Phase C scope); `plans/completed/2026-05-17-reliability-hardening.md` R-008
PRs: closes #26, implemented in #210

# Rubric overview projection extraction (R-008)

## Purpose

Bring `src/assessments/rubricOverview.ts` up to the ADR 0007 primitive/wrapper
shape that `loadAssessmentCompletion.ts` already demonstrates for R-007, and
expand the unit test matrix on the pure builder `buildRubricOverviewData`. This
is the last open item in the read-write-separation investigation; once it
lands, that investigation moves from "largely implemented" to fully closed.

The investigation and the R-008 tracker row both currently claim
`rubricOverview.ts`/`rubricOverviewBuilder.ts` "already follow the ADR 0007
shape" and only need test-hardening. That claim does not match the code:
`loadRubricOverviewData` closes over the global `db` directly, has no
`...FromDb`-suffixed primitive, no `db` test seam, and no integration test.
This plan corrects that gap as well as the test matrix.

## Guidance Consulted

- `AGENTS.md`, `CONTEXT.md`
- `docs/adr/0007-db-primitives-take-a-handle-wrappers-own-transactions-and-cache.md` (the shape being adopted)
- `docs/reference/testing-conventions.md` (co-located tests, integration tier via Testcontainers)
- `plans/completed/2026-06-11-assessment-completion-consolidation.md` (the R-007 precedent this mirrors)
- `docs/investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md`
- `plans/completed/2026-05-17-reliability-hardening.md` (R-008 row)

## Agreed Decisions (and why)

1. **Full extraction, not test-only.** Give `loadRubricOverviewData` a
   `Kysely<DB>`-handle-taking primitive for its raw query and an ADR 0007 cached
   wrapper with a `db` test seam, rather than leaving the global-`db` closure in
   place. (Granularity of the primitive is decision 3.) The tracker's claim that
   the shape was already adopted is wrong; fixing it now avoids leaving a stale
   "done" claim in two docs.

2. **Rename to mirror R-007's file naming.** `src/assessments/rubricOverview.ts`
   (primitive + wrapper) is renamed to `src/assessments/loadRubricOverview.ts`,
   matching `loadAssessmentCompletion.ts`. `rubricOverviewBuilder.ts` (pure
   builder) keeps its name unchanged. Update the one caller that imports the
   wrapper (`app/projects/[projectId]/[projectSlug]/assessments/overview/page.tsx`);
   other importers (`RubricAnalyticsTable.tsx`, `StudentMatrix.tsx`,
   `RubricDetailsTooltip.tsx`) only use builder *types* from
   `rubricOverviewBuilder.ts` and are unaffected.

3. **Extract only the rubric-assessment query into the primitive (Design B).**
   The current `loadRubricOverviewData` does not run one combined query — it
   composes the cached `loadSubmissions` and cached `loadQuestionGrid` wrappers
   plus one raw rubric-assessment query. Only that raw query is
   rubric-overview-specific and schema-sensitive (the three-way `leftJoin`
   across `booleanRubricAssessment`/`ordinalRubricAssessment`/
   `numericalRubricAssessment`), and it is the only part with no existing test.
   So the primitive extracts **just that query**; the wrapper keeps composing the
   two cached reads, preserving their shared cache entries (ADR 0008 rule 5).

   Rejected alternative (Design A): folding submissions + question grid + the
   raw query into one `loadRubricOverviewRowsFromDb` primitive. That would mirror
   `loadAssessmentCompletion`'s literal shape but drop the shared cache entries
   for submissions/question-rows, re-implement composition that already exists,
   and is not behavior-preserving at the caching layer — for no R-008 benefit.

   ```ts
   // loadRubricOverview.ts
   // db may be the global client or a caller-supplied transaction.
   export async function loadRubricAssessmentRecordsFromDb(
     db: Kysely<DB>,
     { projectId }: { projectId: string },
   ): Promise<RubricOverviewAssessmentRecord[]> {
     // exactly the existing raw query body, run on the passed handle:
     // selectFrom("rubricAssessment")
     //   .innerJoin assessment / rubric, project-scoped by projectId,
     //   .leftJoin the three subtype tables,
     //   .select submissionId, rubric.id as rubricId, type, passed,
     //           selectedLabel, score
   }

   export async function loadRubricOverviewData(
     { projectId }: { projectId: string },
     options?: { db?: Kysely<DB> },
   ): Promise<RubricOverviewData> {
     "use cache";
     cacheTags(...rubricOverviewCacheTags());
     cacheLife("projection");
     const [submissions, questionGrid, assessmentRecords] = await Promise.all([
       loadSubmissions({ projectId }, options),   // forwarded unchanged
       loadQuestionGrid({ projectId }, options),  // forwarded unchanged
       loadRubricAssessmentRecordsFromDb(options?.db ?? defaultDb, { projectId }),
     ]);
     return buildRubricOverviewData({ submissions, questionGrid, assessmentRecords });
   }
   ```

   **Seam shape matters.** The wrapper forwards its `db` seam into the cached
   `loadSubmissions`/`loadQuestionGrid` wrappers, so it must use
   `options?: { db?: Kysely<DB> }` and forward `options` **unchanged** (never
   resolve a default), exactly like `loadQuestionGrid` and
   `loadAssessmentCompletionRows`. Using `{ db = defaultDb } = {}` here would
   resolve a real handle on the runtime no-args path and break cache-entry
   sharing / risk the `Cannot serialize class instance` throw (ADR 0007 rule 14,
   ADR 0008 rule 5). For the raw primitive call, pass `options?.db ?? defaultDb`.

   The wrapper's external call changes from positional
   `loadRubricOverviewData(project.id)` to the named-object form
   `loadRubricOverviewData({ projectId: project.id })`, per
   `docs/guides/typescript-api-design.md`.

4. **Extract the cache-tag helper.** Per ADR 0007 rule 15, add
   `rubricOverviewCacheTags(): string[]` returning
   `[questionListCacheTag(), submissionListCacheTag(), assessmentAggregateCacheTag()]`,
   with a direct unit test, mirroring `assessmentCompletionRowsCacheTags` in
   `loadAssessmentCompletion.test.ts`.

5. **Expanded unit test matrix on `buildRubricOverviewData`.** Rename the
   existing `rubricOverview.test.ts` to `rubricOverviewBuilder.test.ts` so its
   stem matches the source it tests (`rubricOverviewBuilder.ts`) and
   `pnpm test:unit rubricOverviewBuilder` selects it — after this PR there is no
   `rubricOverview.ts` for the old name to match. (Pre-existing minor
   mismatch; cleaned up here since we are already rewriting the file. The new
   `loadRubricOverview.test.ts` covers the wrapper-side helper, see decision 4.)
   Cover all four gaps identified during grilling:
   - Duplicate assessment records for the same `(submissionId, rubricId)` pair
     — assert the existing first-wins skip is locked in (no double-counting
     into `marksSum`/`assessedCount`).
   - Partial/null-field records per rubric type — boolean (`passed: null`),
     ordinal (`selectedLabel: null`), numerical (`score: null`; already
     covered). Today only the numerical null case is implicitly exercised.
   - Records referencing an unknown `rubricId` or `submissionId` — assert the
     lookup-miss `continue` branches are covered.
   - Mixed rubric-type distributions at the summary level — a grid with
     boolean + ordinal + numerical rubrics assessed at different rates, to
     check `classAverageMarks`/`completionPercent` aggregate correctly across
     heterogeneous `maxMarks`, beyond the current boolean+numerical pairing.

6. **New integration test** for the primitive only (not a full wrapper
   end-to-end characterization), in
   `src/assessments/loadRubricOverview.integration.test.ts`. Target is
   `loadRubricAssessmentRecordsFromDb` directly:
   - seeds one project with a boolean, an ordinal, and a numerical rubric, plus
     submissions and one assessment of each type, and asserts the primitive
     returns records with the correct per-type value column populated
     (`passed` for boolean, `selectedLabel` for ordinal, `score` for numerical;
     the other two null), with `rubricId` = the rubric's business id and
     `submissionId` = the submission's integer id. This locks the three-way
     `leftJoin` value-column mapping — the exact schema-drift risk R-008 names,
     which the unit matrix cannot catch because it feeds records directly,
     bypassing the SQL.
   - seeds a second project and asserts its assessment records are excluded
     (project-isolation check, mirroring the R-005 overlap this investigation
     calls out).

   New seeding helpers are required: the existing
   `loadAssessmentCompletion.integration.test.ts` only seeds **boolean**
   rubrics/assessments. This test needs ordinal seeding (`rubric` +
   `ordinalRubric` + `ordinalRubricValue` rows, then `rubricAssessment` +
   `ordinalRubricAssessment`) and numerical seeding (`rubric` +
   `numericalRubric`, then `rubricAssessment` + `numericalRubricAssessment`).
   See "Schema and fixture notes" below.

7. **Single PR.** The change is behavior-preserving at both the output and the
   caching layer (Design B keeps the existing cache topology): two file renames,
   one new primitive, one new cache-tag helper, expanded/added tests, one
   call-site signature update. No need to sequence into separate structural and
   test PRs.

8. **Investigation closure happens now, ahead of implementation.** The
   investigation's job was to propose the read/write-separation direction and
   get it accepted — that's done, and its remaining direction is now fully
   captured in this plan. So as part of this grilling session (not deferred
   until the PR merges), move
   `docs/investigations/2026-05-26-read-write-separation-and-schema-change-resilience.md`
   from "Technical architecture investigations" to "Completed investigations"
   in `docs/index.md`, and update the investigation's own Status line to point
   at this plan as the executing reference. R-008 itself stays Open in the
   tracker until this plan's PR actually lands and is promoted to Verified —
   only the investigation doc's lifecycle moves now, not the tracker row.

## Schema and fixture notes (for the implementer)

- `Submission.id` is a `Generated<number>` integer surrogate PK. Unlike
  `Project`/`Question`/`Rubric`/`Student`, submissions have **no** business-id /
  `rowId` split. `loadSubmissions` returns each as `id: String(submission.id)`,
  and `buildRubricOverviewData` matches assessment records via
  `String(record.submissionId)`. So `RubricOverviewAssessmentRecord.submissionId`
  is the integer PK, and the integration test must use the seeded submission's
  returned integer `id` — do not invent a string business id for submissions.
- `Assessment.submissionId` FKs `Submission.id`; `RubricAssessment.assessmentId`
  FKs `Assessment.id`; the subtype tables (`booleanRubricAssessment`,
  `ordinalRubricAssessment`, `numericalRubricAssessment`) FK
  `RubricAssessment.id`. Seed in that order.
- Test infrastructure to reuse (from `loadAssessmentCompletion.integration.test.ts`):
  `createTestDb()` and `buildTestId(prefix)` from `#test/dbIntegration.ts`,
  `createProject(db, name)` (disposable, returns `{ id, rowId, name }`) from
  `#test/projects.ts`. Mock `next/cache` (`vi.mock("next/cache", ...)`) if the
  test exercises the cached wrapper; the primitive itself needs no mock.
- Boolean seeding already exists as a pattern in that file (`createQuestion` with
  a `rubricId`, `addAssessment`). The new ordinal/numerical helpers follow the
  same shape but write their subtype rows: ordinal needs `ordinalRubric` +
  `ordinalRubricValue` (labels→marks) then `ordinalRubricAssessment.selectedLabel`;
  numerical needs `numericalRubric` (min/max score+marks) then
  `numericalRubricAssessment.score`. `Numeric` columns are written as numbers.

## Implementation Steps

1. Rename `src/assessments/rubricOverview.ts` → `src/assessments/loadRubricOverview.ts`
   (preserve `import "server-only"` and `cacheLife("projection")`).
2. Extract `loadRubricAssessmentRecordsFromDb(db, { projectId })` from the
   existing raw `assessmentQuery` in the wrapper (Design B); thread `db` through
   instead of closing over the global client. Return
   `RubricOverviewAssessmentRecord[]`.
3. Rework `loadRubricOverviewData` to the `options?: { db?: Kysely<DB> }` seam:
   forward `options` unchanged to `loadSubmissions`/`loadQuestionGrid`, pass
   `options?.db ?? defaultDb` to the primitive, then `buildRubricOverviewData`.
   Convert its domain parameter to `{ projectId }`.
4. Extract `rubricOverviewCacheTags()` and use it in the wrapper.
5. Update the one caller
   (`app/projects/[projectId]/[projectSlug]/assessments/overview/page.tsx`) for
   the rename and the named-object call shape
   (`loadRubricOverviewData({ projectId: project.id })`).
6. Add `loadRubricOverview.test.ts` covering `rubricOverviewCacheTags()`
   (mirrors `loadAssessmentCompletion.test.ts`).
7. Add `loadRubricOverview.integration.test.ts` per decision 6 (all three rubric
   types + project isolation; write the ordinal/numerical seeding helpers).
8. Rename `rubricOverview.test.ts` → `rubricOverviewBuilder.test.ts` and expand
   it with the four scenario groups from decision 5.
9. Simplify pass over modified files (`.agents/skills/simplify/SKILL.md`).
10. Run `pnpm run check --fix`, `pnpm run check-types`,
    `pnpm test:unit rubricOverviewBuilder loadRubricOverview`,
    `pnpm test src/assessments/loadRubricOverview.integration.test.ts`.
11. Update R-008 in `plans/completed/2026-05-17-reliability-hardening.md` to
    Verified with evidence links; add a Change Log entry; move this plan to
    `plans/completed/`.

Note: the investigation closure (decision 8: `docs/index.md` + the
investigation's Status line) was already done during the grilling session that
produced this plan, ahead of implementation — see the investigation doc's own
Status line. The implementer does not repeat it.

## Out of Scope

- No changes to `RubricAnalyticsTable.tsx`, `StudentMatrix.tsx`, or
  `RubricDetailsTooltip.tsx` beyond what the rename/signature change forces;
  no UI behavior changes.
- No cache policy or tag-scope changes beyond the helper extraction (tags
  named, not re-scoped).
- No changes to `assessmentCompletion.ts`/`loadAssessmentCompletion.ts` (R-007,
  already Verified).
- No terminology decisions; existing `RubricOverview*` naming is kept as-is.

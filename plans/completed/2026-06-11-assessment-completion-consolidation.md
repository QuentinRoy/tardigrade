# Assessment completion consolidation

Status: Completed
Date: 2026-06-11
Source: `docs/investigations/2026-05-25-source-structure-and-tech-debt-audit.md` Priority 4 (Finding 9; #24, #26, #59)
PRs: closes #24

## Guidance consulted

- `CONTEXT.md` — gained **Assessment** and **Assessment Completion** during grilling.
- ADR 0007 (primitives take a handle), ADR 0004/0006 (no barrels, flat modules).
- `docs/reference/testing-conventions.md` (test selection, disposable fixtures).
- `.agents/skills/tdd/SKILL.md` — vertical red→green slices; characterization pinned before refactors.
- `docs/guides/typescript-api-design.md` (named-object parameters).
- `docs/guides/issue-and-pr-conventions.md`, `docs/guides/commit-message-conventions.md`.

## Decisions made while grilling

1. The three implementations do not just duplicate the completion rule — they disagree. Zero-rubric questions count as complete per submission, but never on the global question axis, and never client-side. All disagreement is resolved in this plan, not deferred to #24/#26.
2. Canonical rule (**Assessment Completion** in `CONTEXT.md`): the assessment of a question for a submission is complete when every rubric has a recorded value; a question with no rubrics is complete; completion is vacuously true without exception — empty groupings (no submissions, no questions) are complete, not zero. No per-view exceptions, no behavior flags.
3. Empty-project display is a presentation concern: minimal page-level guards on the dashboard and assessments page replace misleading vacuous figures. The full "guide users through setup" onboarding flow is a separate follow-up issue.
4. One pure builder, `buildAssessmentCompletion`, in `src/assessments/assessmentCompletion.ts` (no `server-only`). Inputs mirror the existing query row sets; outputs cover both grouping axes plus derived aggregates, so the vacuous-truth rule lives in the builder, not in callers. Agreed contract sketch (final types may be refined during implementation, semantics may not):

   ```ts
   buildAssessmentCompletion({
   	submissionIds: string[],
   	questions: Array<{ id: string; rubricCount: number }>,
   	assessmentCounts: Array<{ submissionId: string; questionId: string; assessmentCount: number }>,
   }): {
   	totalSubmissions: number,
   	totalQuestions: number,
   	completedQuestionCountBySubmissionId: Map<string, number>,  // by-submission loader + summary submissions metric
   	completedSubmissionCountByQuestionId: Map<string, number>,  // summary questions metric
   	completedSubmissions: number,  // vacuous-truth rule applied here
   	completedQuestions: number,    // and here
   }
   ```

   The summary's rubrics metric (straight count clamp) stays outside the builder.
5. One shared DB primitive, `loadAssessmentCompletionRowsFromDb(db, { projectId })`, feeds the summary and by-submission loaders. `projectId` is required — the whole-database mode of the current loaders is dead code (every call site passes a project). The summary loader keeps its extra rubric-assessment count query alongside.
6. Three thin loaders over the shared parts; no merged or parameterized mega-loader. A merged signature would be a mode switch (an optional `questionId` silently changing the counted unit, cache tags, and query scope). `loadAssessedRubricCountsBySubmission` shares the least (raw rubric counts, question-scoped query and cache tags) and keeps its own queries.
7. Naming anchored on the counted unit and the grouping; "assessment vs rubric assessment" is a persistence artifact, not two domain concepts (the `assessment` row is a payload-free container):
   - `loadGlobalAssessmentProgress` → `loadAssessmentCompletionSummary` (type `GlobalAssessmentProgress` → `AssessmentCompletionSummary`);
   - `loadSubmissionOverviewProgress` → `loadAssessmentCompletionBySubmission`;
   - `loadSubmissionQuestionProgress` → `loadAssessedRubricCountsBySubmission`;
   - `SubmissionProgressMetric` → `CompletionMetric` (lives with the builder);
   - cache-tag helpers follow their loaders;
   - `assessmentsProgress.ts` + `submissionProgress.ts` merge into `loadAssessmentCompletion.ts` (loaders + primitive); the pure builder lives in `assessmentCompletion.ts`.
8. Client-side `summarizeQuestionSections` drops its `rubrics.length > 0` guard so zero-rubric questions count as fully assessed; `assessmentSummary.ts` names are kept (they summarize marks too).
9. `loadAssessmentCompletionSummary` aligns with ADR 0007 (gains the `{ db = defaultDb }` seam; currently closes over the global `db`).
10. This PR closes #24 (its acceptance criteria are the builder's edge-case tests; its evidence path `src/assessment/progressAggregator.ts` is stale). #26 (rubric overview) and #59 (caching audit) stay open; no cache policy changes here.

## TDD cycles

Each step is RED → GREEN unless marked refactor (under green).

### Pure builder (`src/assessments/assessmentCompletion.ts` + `assessmentCompletion.test.ts`)

1. Tracer: one submission, one question, one assessed rubric → complete on both axes, aggregates complete.
2. Partial: assessed count below rubric count → not counted on either axis.
3. Zero-rubric question → complete on both axes (per submission and on the question axis).
4. Vacuous, no submissions → `completedQuestions === totalQuestions`.
5. Vacuous, no questions → `completedSubmissions === totalSubmissions`.
6. Robustness: submission with no assessment rows stays at zero (plus zero-rubric credit); overshooting counts clamp.

### By-submission loader rewire (`submissionProgress.integration.test.ts`)

7. RED: integration case — project with one zero-rubric question expects it counted complete per submission and consistently with the summary; GREEN: extract `loadAssessmentCompletionRowsFromDb` and map the overview loader through the builder.

### Summary loader rewire (first-ever coverage)

8. Characterization: happy-path integration test against current behavior (mixed completion) — pins queries before touching them.
9. RED: zero-rubric question complete on the question axis; empty-project vacuous aggregates; GREEN: map the summary loader through the same primitive + builder, add the ADR 0007 `db` seam.

### Client summary (`assessmentSummary.test.ts`, new)

10. Pin marks/maxMarks accumulation (unchanged behavior).
11. RED: zero-rubric question counts toward `completedQuestions`; GREEN: drop the `rubrics.length > 0` guard.

### Renames (refactor under green)

12. Apply decision 7: symbols, types, cache-tag helpers, files, call sites in `app/`, test files (`submissionProgress.test.ts` cache-tag expectations move with their helpers). No behavior change; tests stay green throughout.

### Empty-state guards (page-level, `app/`)

13. Dashboard: when `questions.total === 0` or `submissions.total === 0`, render a prompt ("No questions yet — add questions to start assessing." / "No submissions yet — import submissions to start assessing.", button to the relevant page) instead of `GlobalAssessmentSummary`.
14. Assessments page: same "no questions yet" prompt instead of the submission list when the project has no questions. Verified manually (page-level composition; no page test convention).

### Wrap-up

15. Simplify pass over modified code; `pnpm run check --fix`; `pnpm run check-types`; `pnpm test:unit assessmentCompletion assessmentSummary`; `pnpm test src/assessments/`.
16. Update Finding 9 status (body + status table) in the investigation; move this plan to `plans/completed/`; file the onboarding follow-up issue; PR closes #24 noting the stale evidence path.

## Non-goals

- No cache policy or tag-scope changes (#59 owns the caching audit; tags are renamed, not re-scoped).
- No changes to `rubricOverviewBuilder` / rubric overview analytics (#26).
- No onboarding/redirect flow (follow-up issue).
- No merged or parameterized loader; the three loaders stay separate.
- No renames of UI components (`GlobalAssessmentSummary` etc.) or of `summarizeRubrics` / `summarizeQuestionSections`.

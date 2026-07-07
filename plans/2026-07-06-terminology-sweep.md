# Terminology sweep: apply the settled vocabulary across code, DB, routes, and UI

- **Status:** Active
- **Created:** 2026-07-06
- **Origin:** #99 terminology convergence; `CONTEXT.md`, `docs/reference/lexicon.md`
- **Tracked by:** #99 (and #136 for the submission → Grade Target portion)

The vocabulary is settled in `CONTEXT.md` (internal domain glossary) and `docs/reference/lexicon.md` (user-facing). This plan applies those decisions to the implementation. No terminology decisions remain — this is mechanical application, staged so each step is independently reviewable and shippable.

## State of the code (2026-07-06, after the MUI → Mantine merge #242)

The Mantine migration independently and **partially** adopted some of the new vocabulary, leaving the tree in a mixed state the sweep must reconcile — not a clean single-direction rename from the old terms:

- Already renamed toward the target: `src/rubrics/{Boolean,Numerical,Ordinal}GradeControl.tsx` (Grade), `src/rubrics/RubricCriterion.tsx` (was `RubricGradeRow`), `src/assessment-capture/RubricGradeList.tsx`.
- Still old, sometimes beside the renamed files: `src/rubrics/AssessmentStatus.tsx` (sits next to the `*GradeControl` files), and all of `SubmissionMatrix`, `RubricAnalyticsTable`, `QuestionDetailsTooltip`, the `assessment-*` / `submission*` / `Question*` names, plus the entire schema.

So a few "old term" starting points below have already moved, and the sweep additionally has to make the half-migrated component names internally consistent (e.g. `AssessmentStatus` → a Grade-named equivalent; confirm `RubricCriterion` reads correctly once the leaf is `Criterion`).

## Decided renames

| Old | New | Surfaces |
| --- | --- | --- |
| Project | Grid | table, `id`/`row_id`, routes (`/projects` → `/grids`), cache tags, code identifiers, UI |
| Question | Rubric | table, FKs, code, UI, YAML import (`questions:` → `rubrics:`) |
| Rubric (leaf) | Criterion | tables (`*_rubric*`), FKs, code, UI, CSV columns |
| Team | Group | table, FKs, code, UI, students CSV (`team` → `group`) |
| Submission | Grade Target | table, FKs, `id`/`row_id`, code; **not** user-facing (UI/URLs name the Student or Group; `[targetId]` param only) |
| Assessment (record + act) | Grade | tables (`assessment`, `rubric_assessment`, `*_rubric_assessment`), `saveAssessment`, code, UI |
| Assessment Completion | Grade Completion | code, projections |
| Submission Matrix | Grade Matrix (internal) / "Grades" (UI) | component, aria-label, UI |
| Rubric Analytics | Criterion Analytics / "Analytics" (nav) | component, UI |
| Marks (aggregate) | Total | export columns (`grand_total_marks` → `final_total`), code |
| progress (as a synonym for completion) | Completion | `progress`/`progressPromise`/`progressLabel` props, `CompletionProgress` component, UI copy — unify on Completion (the concept `CONTEXT.md` settled) |
| boolean / ordinal / numerical (criterion types) | Check / Options / Number | `criterion_type` DB enum (was `rubric_type`), subtype tables (`boolean_rubric*` → `check_criterion*` etc.), code, YAML `type:` values, UI type selector — one vocabulary end to end, no internal/external split |

Value pipeline is **Grade → Mark → Total** for every criterion type; a grade's recorded content varies by subtype (a pass, a label, or — for numerical criteria only — a score). `grade` is the record and the act, distinct from its worth (a numerical grade is itself a number, but never the marks value); `score` names a numerical grade's payload and the input axis of its configuration (`minScore..maxScore`), not a pipeline stage. `Points` remains avoided.

## Routes (final shape)

```
/grids/[gridId]/[gridSlug]/rubrics/
/grids/[gridId]/[gridSlug]/grades/
/grids/[gridId]/[gridSlug]/grades/[targetId]/[targetSlug]/
/grids/[gridId]/[gridSlug]/grades/[targetId]/[targetSlug]/rubrics/[rubricId]/
/grids/[gridId]/[gridSlug]/analytics/
/grids/[gridId]/[gridSlug]/import/...
```

## CSV columns

- students: `team` → `group`.
- grades: `submission_type` → `kind` (`individual`/`group`), `submitter` → `name`, assessment columns `questionId:rubricId` → `rubricId:criterionId`, `grand_total_marks` → `final_total`, per-question totals → per-rubric `rubricId:total`.

## Staging

Each stage is one or more PRs, own migration where schema changes, Kysely types regenerated, tests updated. Order minimizes cross-stage churn (rename leaf-inward and identifier-outward). Per `docs/reference/database-migrations.md`, committed migrations are not rewritten — every schema rename is a new migration.

1. **`rubric-analytics/` module** — self-contained, TypeScript-only (no schema/route change): `SubmissionMatrix` → `GradeTargetMatrix` (aria-label/UI "Grades"), `RubricAnalyticsTable` → `CriterionAnalyticsTable`, internal fields (`submissionId`/`submissionLabel` → `gradeTargetId`/`label`, `questionId`/`questionLabel` → `rubricId`/`rubricLabel`, leaf `rubricId` → `criterionId`, `assessedRubrics`/`totalRubrics` → `assessedCriteria`/`totalCriteria`), folder rename. Two confirmed label bugs to fix here: (a) the Grades table's per-row "Average" column renders `marks/maxMarks` — a target's **Total**, not a mean — relabel to **Total**; the Criterion Analytics "Average" column is a real per-criterion mean and stays. (b) the overview's **"Class average"** stat (`app/.../assessments/overview/page.tsx`, from `classAverageMarks`/`classAverageMaxMarks`) is the grid-wide mean of target totals — relabel to **Average total** and rename the `classAverage*` identifiers to `averageTotal*` (a grid is not always a class).
2. **Question → Rubric / Rubric → Criterion** — schema (tables, FKs, triggers), Kysely types, code, YAML import, UI. Largest leaf rename; do before the submission and grade renames so those build on final names.
3. **Team → Group** — schema, code, students CSV, UI.
4. **Submission → Grade Target** — schema (`submission` → `grade_target`, generated numeric `id` → `row_id`, new public `id` scoped by grid per #136), FKs to `_row_id`, routes (`/assessments/submissions/[submissionId]` → `/grades/[targetId]`), cache tags, exports, `kind`/`name` CSV columns. This is the #136 core.
5. **Assessment → Grade** — schema (`assessment`/`rubric_assessment`/subtype tables), `saveAssessment` and the whole `assessment-*` module set, cache tags, UI, Grade Completion.
6. **Project → Grid** — schema (`project` → `grid`, already on `id`/`row_id`), all FKs, routes (`/projects` → `/grids`), cache tags, code, UI. Done last: it touches the most files and is the outermost identifier, so doing it after the inner renames avoids re-touching.
7a. **App name** — replace the stale `"BonPoint"` title fallbacks (`src/app-shell/AppShellTopBar.tsx`, `AppShellLoadingShell.tsx`) and the `app/layout.tsx` metadata description ("Simple assessment helper for rubric-based evaluation") with **Tardigrade** copy. Public-facing name only; repository, package, and technical identifiers stay `grading` (#106).

7b. **Score → Value in user-facing surfaces** — the Number criterion's input is user-facing "Value", not "score": editor labels `Min score`/`Max score` → `Min value`/`Max value` (`NumericalRubricEditorPaper.tsx`), grade-entry placeholder `"Score"` → `"Value"` (`NumericalGradeControl.tsx`), and the `"Enter a valid score"` / `"Enter a score of at least…"` messages → value wording. "score" stays only as an internal code/DB identifier (`minScore`/`maxScore`); it is not a user-facing word. Chosen over "score" because a Number criterion can be reversed (higher input → fewer marks), where "score" is semantically wrong but "value" stays correct.

7. **UI copy audit and contract docs** — sweep every user-facing string against `docs/reference/lexicon.md`: "Grades"/"Analytics"/"Name" labels, error messages, empty states, headings. Add any missing Lexicon entries surfaced during the audit (the Lexicon is a dictionary only — word: definition; contracts don't live there). Document the implemented URL tree and import/export column sets durably: README Import Formats plus a reference doc for URL conventions — this plan's "Routes" and "CSV columns" sections above are the spec until then.

## Out of scope

- Structural model changes deferred by the investigations: unifying Student/Group under a singleton-Group persistence model (assessment target model investigation), the aggregate-Total computation itself (mark/grade/weighting investigation — Total is named but unbuilt), dynamic target creation (#61), draft/unresolved target state.
- Cross-grid aggregation of a real-world event split across grids (documented limitation, not a defect).

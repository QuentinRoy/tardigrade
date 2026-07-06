# Terminology sweep: apply the settled vocabulary across code, DB, routes, and UI

- **Status:** Active
- **Created:** 2026-07-06
- **Origin:** #99 terminology convergence; `CONTEXT.md`, `docs/reference/lexicon.md`
- **Tracked by:** #99 (and #136 for the submission → Grade Target portion)

The vocabulary is settled in `CONTEXT.md` (internal domain glossary) and `docs/reference/lexicon.md` (user-facing). This plan applies those decisions to the implementation, which still uses the old terms throughout. No terminology decisions remain — this is mechanical application, staged so each step is independently reviewable and shippable.

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

Value pipeline stays **Score → Mark → Total**; `grade` is the atomic record and the act, never a number. `Points` remains avoided.

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

1. **`rubric-analytics/` module** — self-contained, TypeScript-only (no schema/route change): `SubmissionMatrix` → `GradeTargetMatrix` (aria-label/UI "Grades"), `RubricAnalyticsTable` → `CriterionAnalyticsTable`, internal fields (`submissionId`/`submissionLabel` → `gradeTargetId`/`label`, `questionId`/`questionLabel` → `rubricId`/`rubricLabel`, leaf `rubricId` → `criterionId`, `assessedRubrics`/`totalRubrics` → `assessedCriteria`/`totalCriteria`), folder rename. Verify the "Average" column: it renders `marks/maxMarks`, which is a **Total**, not a mean — relabel accordingly if the computation confirms it.
2. **Question → Rubric / Rubric → Criterion** — schema (tables, FKs, triggers), Kysely types, code, YAML import, UI. Largest leaf rename; do before the submission and grade renames so those build on final names.
3. **Team → Group** — schema, code, students CSV, UI.
4. **Submission → Grade Target** — schema (`submission` → `grade_target`, generated numeric `id` → `row_id`, new public `id` scoped by grid per #136), FKs to `_row_id`, routes (`/assessments/submissions/[submissionId]` → `/grades/[targetId]`), cache tags, exports, `kind`/`name` CSV columns. This is the #136 core.
5. **Assessment → Grade** — schema (`assessment`/`rubric_assessment`/subtype tables), `saveAssessment` and the whole `assessment-*` module set, cache tags, UI, Grade Completion.
6. **Project → Grid** — schema (`project` → `grid`, already on `id`/`row_id`), all FKs, routes (`/projects` → `/grids`), cache tags, code, UI. Done last: it touches the most files and is the outermost identifier, so doing it after the inner renames avoids re-touching.
7. **UI copy audit** — sweep every user-facing string against `docs/reference/lexicon.md`: "Grades"/"Analytics"/"Name" labels, error messages, empty states, headings. Add any missing Lexicon entries surfaced during the audit.

## Out of scope

- Structural model changes deferred by the investigations: unifying Student/Group under a singleton-Group persistence model (assessment target model investigation), the aggregate-Total computation itself (mark/grade/weighting investigation — Total is named but unbuilt), dynamic target creation (#61), draft/unresolved target state.
- Cross-grid aggregation of a real-world event split across grids (documented limitation, not a defect).

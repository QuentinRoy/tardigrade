# Investigation: the `assessment` container table — why it exists, whether to drop it

- **Status:** Completed
- **Created:** 2026-07-12
- **Resolution:** Option B accepted (2026-07-12) — drop the container in a preliminary PR (stage 5b of `plans/2026-07-06-terminology-sweep.md`) before the assessment → grade rename. Also decided while grilling: **bundle** the partial-commit fix (validate before the first write) and **drop the redundant `criterion_assessment.kind` column** (derivable from the always-joined, immutable `criterion.kind`; no trigger depends on it, only two readers select it and both already join `criterion`).
- **Related:** #99 (terminology sweep), `plans/2026-07-06-terminology-sweep.md` (stages 5b, 5c), `CONTEXT.md` (Grade)

## Question

The `assessment` table holds one row per (grade target × rubric) pair and carries no evaluation content — only FKs and timestamps. Stage 5 of the terminology sweep (assessment → grade) forces it to be *named*, and no grade-family name fits: it is not a grade (nothing was judged) and not a total (nothing is stored). Why does this table exist, why was it introduced, and is it safe to delete before stage 5 rather than rename it?

## Executive summary

The container is a **day-one historical artifact**, not a load-bearing design. In the very first schema (commit `003c30e`, 2026-05-07) the app's routing was `app/[questionId]/[paperId]/page.tsx` — one page per question×paper — and `Assessment` was that page's entity. The page structure changed long ago; the table survived every subsequent rename unexamined. Today every reader joins *through* it and none reads anything *from* it. Dropping it is safe, mechanical, and shrinks stage 5; it also removes an unguarded integrity redundancy and surfaces (though does not by itself fix) a latent partial-commit bug. **Recommendation: drop it in a preliminary PR before stage 5.**

## History

- `003c30e` (2026-05-07, "startup db backend") — original Prisma schema: `Paper`, `Question`, `Rubric` (leaf), `Assessment (paperId, questionId)`, `RubricScore (assessmentId, rubricId, score)`. The UI graded one paper×question per page; `Assessment` was the record backing that screen. Note the two-path redundancy existed from day one: `RubricScore` carried both `assessmentId` and `rubricId` while `Rubric` already knew its `questionId`.
- `cb67a08` (2026-05-12, "big grading to assessment refactor") — the codebase's *original* words were grading-family; they were renamed **to** "assessment". Stage 5 reverses that rename.
- Every later migration (kysely, projects, rekeying, criterion/rubric/group/grade-target renames) carried the container along without reconsidering it.

## What it is today

```
assessment: { id, project_id, grade_target_row_id, rubric_id, created_at, updated_at }
            UNIQUE (grade_target_row_id, rubric_id)

criterion_assessment: { id, assessment_id, criterion_id, kind, created_at, updated_at }
            UNIQUE (assessment_id, criterion_id)
            └─ 1:1 kind subtype: check_/options_/number_criterion_assessment (payload)
```

The container groups one target's criterion grades under their rubric. It stores no judgment and no aggregate (marks and totals are computed at read time, never persisted — CONTEXT **Mark**/**Total**). Only `criterion_assessment` references it.

## Current uses — and what each becomes without the container

| Use | Today | Without the container |
| --- | --- | --- |
| Save path ([`src/assessment-persistence/assessmentMutations.ts`](../../src/assessment-persistence/assessmentMutations.ts)) | get-or-create container, then upsert criterion grade under it | single upsert on `UNIQUE (grade_target_row_id, criterion_row_id)`; one round-trip fewer |
| Capture load ([`src/assessment-capture/assessments.ts`](../../src/assessment-capture/assessments.ts)) | join `assessment` → `criterion_assessment` → subtypes | join `criterion_assessment` → `criterion` (rubric via `criterion.rubric_id`) |
| Results ([`src/results/loadResults.ts`](../../src/results/loadResults.ts)) | join through container for `gradeTargetRowId` | read `grade_target_row_id` directly off the grade row |
| Completion ([`src/assessment-completion/loadAssessmentCompletion.ts`](../../src/assessment-completion/loadAssessmentCompletion.ts)) | `count(criterion_assessment.id)` grouped by container's (target, rubric) | same count grouped by (`grade_target_row_id`, `criterion.rubric_id`) |
| Import context ([`src/imports/assessments/assessmentImportContext.ts`](../../src/imports/assessments/assessmentImportContext.ts)) | joins container to build assessed-pair keys | join grade row → criterion directly |
| Delete-impact count ([`src/rubric-management/rubricDefinitions.ts`](../../src/rubric-management/rubricDefinitions.ts)) | `count(assessment.id)` per rubric = "targets that *started* grading this rubric" | `count(DISTINCT grade_target_row_id)` over grades joined via criterion — see semantics note below |
| Export ([`src/export/gradeTargetExport.ts`](../../src/export/gradeTargetExport.ts)) | joins through container; orders by `assessment.id, criterion_assessment.id` | order by `criterion_assessment.id` alone (creation order; the grouping module reshapes by public ids anyway — verify against the ordering note in `gradeTargetExportGrouping.ts`) |
| Test fixtures (`src/test/rubrics.ts`, `src/test/mixedCriterionAssessmentFixture.ts`) | insert container rows explicitly | insert grade rows directly; less fixture plumbing |

Nothing reads the container's `created_at`/`updated_at` (verified by grep — zero readers).

## Integrity analysis

**The container creates redundancy the DB does not police.** A criterion grade's rubric is derivable two ways — `criterion_assessment → assessment.rubric_id` and `criterion_assessment → criterion.rubric_id` — and no constraint or trigger forces agreement (all twelve triggers are criterion-kind enforcement; none touch `assessment`). Only app code guards it. Keyed directly on (target, criterion), the rubric is derivable exactly one way and the inconsistency becomes unrepresentable. The denormalized `assessment.project_id` has the same character.

**Latent partial-commit bug (found during this investigation, exists with or without the container):** `saveAssessmentInDb` *returns* domain failures rather than throwing, and the interactive wrapper's `db.transaction().execute()` commits unless the callback throws. A first-time save that fails subtype validation (invalid option label, out-of-range score — reachable via a concurrent criterion edit) therefore **commits** the container plus a kind-only `criterion_assessment` with no payload row. Completion counts `criterion_assessment` rows, so this empty grade counts as graded (capture's `toCriterionValue` tolerantly maps it to null, but the completion projection over-counts). The container-drop rewrite of the save path is the natural moment to also sequence validation before any write.

**Delete-impact semantics change:** counting containers counts "gradings started" including empty ones (possible via the bug above, or a container whose grades were never written); counting distinct targets over real grade rows counts actual grades. The new semantics are more truthful; the UI copy ("N linked …") needs no change.

**`criterion_assessment.kind` is also redundant** (criterion kind is immutable by trigger, and saves enforce kind match), but dropping it is a separable question — noted here, not bundled.

## Options considered

### Option A — keep the container, name it in stage 5 (e.g. `rubric_grading`)

- Pros: stage 5 stays a pure rename; no structural migration.
- Cons: names a table whose only meaning is "join plumbing"; every candidate name is awkward precisely because the domain has no concept for it (CONTEXT deliberately calls it "a container, not a second kind of grade"); if the simplification happens later the table is migrated twice and the name dies with it; the integrity redundancy persists.

### Option B — drop the container in a preliminary PR, then run stage 5 (recommended)

- Pros: stage 5 shrinks (one fewer table, the naming question dissolves); integrity redundancy removed; save path loses a round-trip; fixtures simplify; the awkward-name problem never exists.
- Cons: a structural migration (backfill `grade_target_row_id` onto `criterion_assessment`, rekey its unique constraint, rewrite ~7 query sites) lands before a rename stage — more total work up front; touches the same files stage 5 will touch again (accepted second-touch, same as stages 2a/2b/4).

### Option C — rename in stage 5 now, drop later

- Strictly worse than B: does the migration work twice and commits a name that is planned to disappear.

## Migration sketch (Option B)

1. Add `criterion_assessment.grade_target_row_id` (nullable), backfill from the parent container, set `NOT NULL`, FK to `grade_target(row_id)`.
2. Replace `UNIQUE (assessment_id, criterion_id)` with `UNIQUE (grade_target_row_id, criterion_id)`.
3. Drop `assessment_id` and the `assessment` table.
4. Rewrite the seven query sites per the table above; move save-path validation ahead of the first write.
5. `down` recreates the container from `(grade_target_row_id, criterion.rubric_id)` distinct pairs (empty containers are not recoverable — acceptable: they are the bug state).

No `project_id` on the grade row: project scoping resolves via `grade_target.project_id` or `criterion.project_id`, per the Grid Resolution Strategy's in-query resolution posture.

## Recommendation

Option B. The container answers to no domain concept, guards nothing, and is read by nothing — it is the fossil of a 2026-05-07 page structure. Dropping it first makes stage 5 a cleaner rename and removes the one table the settled vocabulary cannot name.

## Resolved questions (grilling, 2026-07-12)

- **Partial-commit fix:** bundled into 5b (the drop PR rewrites that exact write path; validate-before-first-write is a statement-order choice in code already being rewritten).
- **`criterion_assessment.kind` column:** dropped in 5b. No trigger reads it (the `*_kind_match` triggers are on the *criterion* subtype tables; the grade-subtype triggers key on `criterion_assessment_id` + criterion config). Only two readers select it (`loadResults.ts`, `assessment-capture/assessments.ts`), both already join `criterion`, so they switch to `criterion.kind` for free. The save-time guard compares the incoming payload's kind, not the stored column, and stays.
- **Export ordering:** confirmed safe to drop `ORDER BY assessment.id`. `groupGradeTargetRows` only needs rows contiguous per grade target (ordered by `gradeTarget.rowId`); the intra-target order feeds a `Map` keyed by `rubricId:criterionId` and is never consumed.

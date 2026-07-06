# Domain terminology investigation

- **Status:** Completed
- **Created:** 2026-05-20
- **Related:** #99
- **Resolution:** Vocabulary converged and recorded in `CONTEXT.md` (internal domain glossary) and `docs/reference/lexicon.md` (user-facing). Decided: Project → Grid, Question → Rubric, leaf Rubric → Criterion, Team → Group, Submission → Grade Target (code-only), Assessment → Grade, aggregate value → Total; Score/Mark kept, Points avoided. Application to code/DB/routes/UI is staged in `plans/2026-07-06-terminology-sweep.md`. This document stays as the exploration record.

## Document role

Source of truth by artifact type:

- Issue -> problem statement and discussion entry point
- Investigation -> evolving reasoning, observations and hypotheses
- ADR -> decisions
- Code and tests -> implemented behavior

Presence in an investigation does not imply adoption.

## Reading conventions

Distinguish:
- Observed facts: things currently true in implementation or behavior
- Working assumptions: useful current model, not yet decided
- Potential directions: candidate future changes
- Rejected or deferred: intentionally avoided unless evidence changes

Confidence labels:
- High: strong evidence and low expected churn
- Medium: coherent direction with limited implementation evidence
- Low: speculative or incomplete

This document is the broad terminology audit. It should preserve the exploration space, including candidate terms that are not currently favored. More focused investigations may extract deeper reasoning for specific areas.

---

## Related investigations

- [Assessment target model](./2026-05-20-assessment-target-model.md)
- [Mark, grade and weighting model](./2026-05-20-mark-grade-weighting-model.md)

---

## Broad terminology audit

Status: Investigation
Confidence: Low
Decision owner: TBD

This section captures terminology tensions that should not be lost while the domain model evolves. It is intentionally broader than the current implementation and broader than the terms currently used in the UI.

The goal is not to decide all names immediately. The goal is to preserve alternatives, trade-offs, and reasons for discomfort so future refactors can converge deliberately.

### Terminology map

| Concept | Current term | Candidate terms | Notes |
| --- | --- | --- | --- |
| Top-level grading entity | Project | Assignment, Assessment, Exam, Activity, Evaluation | `Project` may be too software-oriented and may not fit exams, quizzes, labs, or imported LMS assignments. |
| Grading process | Assessment | Grading, Marking, Evaluation | `Assessment` is broad and process-oriented, but the app currently does not support annotation or feedback-only review. |
| Assessment target | Student / Team | Group, Submission target, Assessed unit | `Group` remains promising because it can represent one or many students without splitting persistence models. |
| Submitted work | Submission | Attempt, Hand-in, Deliverable | `Submission` is clear for LMS imports, but may not cover oral exams or manually entered targets as naturally. |
| Work item | Question | Exercise, Task, Item, Rubric | `Question` is clear for exams, but may be too narrow for assignments, exercises, and criterion-based grading. |
| Rubric container | Question | Rubric, Exercise, Assessment item | If a question mostly groups grading criteria, `Rubric` or `Exercise` may be more accurate, but possibly less obvious. |
| Rubric item | Rubric | Criterion, Check, Requirement | The current `Rubric` concept may be closer to an assessment criterion. |
| Rubric result | Score | Mark, Raw score, Observed value | Focused investigation currently leans toward `mark` for rubric output and `raw score` only for measured numerical inputs. |
| Aggregate result | Grade | Final grade, Total, Result | `Grade` should probably refer to an aggregate result, not an individual criterion value. |
| Weighting concept | Rubric value / points | Weight, Scale, Max mark | Weighting needs clearer separation from raw values, marks, and aggregation. |

### Project versus assignment, exam, activity, or assessment

Status: Investigation
Confidence: Low

Current concern:
`Project` may not be the right top-level term. It is generic in software, but may be misleading in a grading app.

Problems with `Project`:
- sounds like a software/project-management concept;
- does not naturally describe exams, quizzes, oral assessments, or small exercises;
- may not align with LMS terminology;
- may imply long-lived collaborative work when the app also needs short-lived grading sessions.

Candidate directions:
- `Assignment`: likely better for the current submission-centered product shape, especially with LMS imports, but less natural for exams.
- `Exam`: clear for exam grading, but too narrow as the generic top-level term.
- `Activity`: broad and educational, but possibly too vague.
- `Assessment`: broad, but conflicts with the process/session concept and may overstate current support for non-grading workflows.

Working direction:
Keep `Project` under suspicion. `Assignment` may be a better candidate for the current product shape, but it should be tested against exams, lab exercises, imported Moodle assignments, and future non-submission workflows before adoption.

Open questions:
- What is the top-level thing users believe they are creating?
- Should imported Moodle assignments map directly to this concept?
- Should the internal model use a neutral term while the UI presents `Assignment`, `Exam`, or `Activity` depending on context?

### Assessment versus grading, marking, and evaluation

Status: Investigation
Confidence: Low

Current concern:
`Assessment` is broad. It can include feedback, annotation, qualitative review, formative evaluation, peer review, and grading. The app currently does not support annotations, comments, or feedback-only review, so `assessment` may overstate the current product capabilities.

Observed current scope:
- selecting or entering values for rubrics/criteria;
- computing marks and aggregate grades;
- tracking grading progress;
- importing submissions and exporting results.

Candidate directions:
- `Grading`: accurately reflects the current app behavior, but may be too narrow for future feedback or peer-review workflows.
- `Marking`: focuses on criterion-level mark assignment, but may be less idiomatic in some UI contexts.
- `Evaluation`: broad and familiar in French educational contexts, but can be ambiguous in English UI.

Potential distinction:
- `Assessment`: broad process of evaluating submitted work, possibly including feedback in the future.
- `Grading`: assigning marks and grades.
- `Marking`: criterion-level act of assigning marks.

Open questions:
- Should UI navigation say `Assessments`, `Grading`, or something else?
- Should code keep `assessment` for domain breadth while UI says `grading`?
- Would switching to `grading` make future feedback workflows harder to name?
- Is `assessment session` still the right term if the session only records marks?

### Question versus exercise, item, rubric, and criterion

Status: Investigation
Confidence: Low

Current concern:
The current model appears to use `Question` as a container for multiple `Rubric` entries. This is understandable for exams, but may not fit assignments, reports, projects, or criterion-based evaluation grids.

Current conceptual shape:

- Project
  - Question
    - Rubric
      - Rubric value

Possible educational shape:

- Assignment
  - Exercise
    - Criterion
      - Assessment value

Possible rubric-centered shape:

- Assignment
  - Rubric
    - Criterion
      - Assessment value

Candidate directions:
- keep `Question` where the assessed work is genuinely question-like;
- consider `Exercise` as a broader course-facing term;
- consider `Task`, `Item`, or `Section` if the container is not always student-facing;
- consider reserving `Rubric` for a grading grid rather than an individual criterion;
- consider renaming current `Rubric` entries to `Criterion`.

Working direction:
Do not collapse `Question` into `Rubric` too quickly. A plausible future model is `Assignment -> Question / Exercise / Section -> Criterion -> Assessment value`. In that model, `Rubric` might describe the full grading grid, while `Criterion` describes current rubric entries.

Open questions:
- Is the current `Question` always student-facing, or sometimes only assessor-facing?
- Should the app distinguish student-facing work items from assessor-facing grading sections?
- Is `Exercise` a better default than `Question` for the UGA/MIASHS use case?
- Should `Rubric` name the whole grading grid, one section of it, or not be a core entity name?
- Should current `Rubric` become `Criterion` in code, UI, or both?

### Student, team, group, submission, and target

Status: Proposed in focused investigation
Confidence: Medium

The focused [assessment target model](./2026-05-20-assessment-target-model.md) currently leans toward `Group` over `Team`, with singleton groups representing individual assessment targets.

Broad audit concern:
The app needs terms for at least three related but distinct concepts:
- the people being assessed;
- the submitted work being assessed;
- the unit the grading workflow targets.

Potential terms:
- `Student`: a person imported or created in the app.
- `Group`: one or more students treated as a unit.
- `Submission`: a piece of submitted work, possibly attached to a group.
- `Assessment target`: the entity currently being graded, possibly a group, submission, or both.

Risk:
Do not use `submission` when the target is really a group, and do not use `group` when the important object is the submitted work.

Open questions:
- Does each group have exactly one submission per assignment?
- Can one group have multiple submissions or attempts?
- Can one submission belong to multiple grading targets?
- Should the main matrix be organized by group, submission, or assessment target?

---

## Candidate follow-ups

- Add a glossary once decisions start converging.
- Audit current code and UI for `project`, `assessment`, `question`, `rubric`, `score`, `mark`, and `grade` usage.
- Decide whether `Project` should be renamed before the term becomes more deeply embedded.
- Investigate whether `Question` should become `Exercise`, `Section`, or remain unchanged.
- Investigate whether current `Rubric` should become `Criterion`.
- Extract ADRs only after terminology decisions become stable enough to guide implementation.

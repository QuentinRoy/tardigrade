# Lexicon: user-facing vocabulary

A dictionary of the words this product shows users: UI labels, headings, button text, empty states, error messages, export column headers, and URL path segments. One concept gets exactly one preferred term — never introduce a second word for a concept that already has an entry, and never reuse an entry's word for a different concept. Prefer plain, jargon-free language; plain and consistent language is also the foundation for future translation.

This is not [CONTEXT.md](../../CONTEXT.md), the internal domain glossary — the two are related but may deliberately diverge when a friendlier word serves users better (each entry's _Maps to_ line records the link). Some internal terms must **never** appear in UI copy: say "this student" or "this group", never "target" or "grade target"; say "Grades", never "matrix". Before writing copy that names a concept, check for its entry here; if the concept has no entry yet, add one (alphabetically) in the same change rather than inventing copy ad hoc. Shipped copy may lag a recent decision here — that's a follow-up task, not a reason to keep this file describing stale vocabulary. Larger word-built contracts (the URL tree, import/export column sets) are specified in `plans/2026-07-06-terminology-sweep.md` until implemented, then documented in the README and reference docs.

---

**Criterion**:
One graded item within a rubric.
_Maps to_: Criterion (`CONTEXT.md`)
_Avoid_: rubric (when meaning a single graded item)

**Criterion Analytics**:
The overview table showing each criterion's average marks and completion across students and groups. Navigation may shorten it to **Analytics** where the context is already a grid.
_Maps to_: Criterion Analytics (`CONTEXT.md`)
_Avoid_: rubric analytics

**Grade**:
The recorded evaluation of one criterion; also the general word for the act of producing it ("grading").
_Maps to_: Grade (`CONTEXT.md`)
_Avoid_: assessment, assess, evaluation

**Grades** (table):
The overview table showing every student's or group's marks for every criterion, with totals and completion. Its first column is headed **Name**.
_Maps to_: Grade Matrix (`CONTEXT.md`) — a deliberate divergence: "matrix" is precise internally but jargon in UI copy
_Avoid_: matrix, submission matrix, gradebook

**Grid**:
The container an instructor creates to grade a set of students or groups against a set of rubrics.
_Maps to_: Grid (`CONTEXT.md`)
_Avoid_: project, test, exam, assignment

**Group**:
One or more students graded as a single unit.
_Maps to_: Group (`CONTEXT.md`)
_Avoid_: team

**Kind** (`kind`):
In grade CSV files, whether a row is graded as an `individual` or a `group`.
_Maps to_: Grade Target (`CONTEXT.md`) — the internal unification the file deliberately keeps visible, because the distinction still matters to a person reading it
_Avoid_: submission_type, type

**Mark**:
The value a single criterion contributes to a grade.
_Maps to_: Mark (`CONTEXT.md`)
_Avoid_: points, score (mark is the per-criterion output only)

**Name** (`name`):
The student's or group's display label — as the Grades table's first column header and as the `name` CSV column. A fixed word, so it stays correct whether a grid contains individuals, groups, or both.
_Maps to_: Grade Target (`CONTEXT.md`) display label
_Avoid_: student, group, submission (as a header), submitter

**Rubric**:
The grading grid for one exercise or section: its criteria, and how each one is scored.
_Maps to_: Rubric (`CONTEXT.md`)
_Avoid_: question, exercise (a rubric's own label may read "Exercise 3" when quoting source material, but the product's own chrome says "rubric")

**Score**:
A measured input value entered for a numerical criterion (for example "12 subnets identified"), before it's converted to a mark.
_Maps to_: Score (`CONTEXT.md`)
_Avoid_: mark, points (score is the measured input only, never the graded output)

**Student**:
A person being graded, individually or as part of a group.
_Maps to_: Student (`CONTEXT.md`)
_Avoid_: participant, user

**Total**:
The summed value across a rubric's criteria (a rubric total) or across a whole grid (a final total).
_Maps to_: Total (`CONTEXT.md`)
_Avoid_: grade (when meaning the aggregate — grade names the individual record, not the sum), sum

# Lexicon: user-facing vocabulary

The vocabulary shown to users: UI labels, headings, button text, empty states, error messages, and export column headers. Distinct from [CONTEXT.md](../../CONTEXT.md), which is the precise internal domain glossary for contributors and agents. The two are related but not required to match — a user-facing word may be friendlier or more familiar than the internal term when that serves the user better. Any such divergence should be a deliberate choice recorded here, not an accident.

This file records the *decided* target vocabulary. Shipped UI copy may still lag behind a recent decision here, the same way code identifiers can lag behind a `CONTEXT.md` rename — that's a follow-up implementation task, not a reason to leave this file describing stale terminology.

## Rule

**One concept, one preferred term.** If a UI-facing word is already used for a different concept, that's a conflict to resolve before shipping new copy — never give an existing word a second meaning, and never introduce a second word for a concept that already has one.

Prefer plain, jargon-free language over technical or internal terminology. This isn't just clarity for its own sake: plain, consistent language is also the foundation for future translation — content that's easy to read is easy to localize. This file doesn't carry translated terms yet (the app has no i18n infrastructure), but it's written so that work has one clear source to translate from.

## How to use this file

- Before writing new user-facing copy that names a concept, check whether it already has an entry here.
- If the concept exists but has no entry, add one instead of inventing UI copy ad hoc.
- If two existing UI strings name the same concept differently, that's a defect in this lexicon or in the copy — fix it, don't add a third option.
- Entries are grouped to mirror `CONTEXT.md`'s section headings, so the two files stay easy to cross-reference term-by-term.

## Rubric authoring

**Rubric**:
The grading grid for one exercise or section: its criteria, and how each one is scored.
_Maps to_: Rubric (`CONTEXT.md`)
_Avoid_: question, exercise (a rubric's own label may read "Exercise 3" when quoting the source material, but the product's own chrome — buttons, navigation, generic headings — says "rubric", not "exercise")

**Criterion**:
One graded item within a rubric.
_Maps to_: Criterion (`CONTEXT.md`)
_Avoid_: rubric (when meaning a single graded item)

## Grid

**Grid**:
The container an instructor creates to grade a set of submissions against a set of rubrics.
_Maps to_: Grid (`CONTEXT.md`)
_Avoid_: project, test, exam, assignment

## Criterion overview

**Grades** (table):
The overview table showing every student's or group's marks for every criterion, with totals and completion. Its first column is headed **Name** (the student's or group's display label) — never "Student", "Group", or "Submission", so the header stays correct whether a grid contains individuals, groups, or both.
_Maps to_: Grade Matrix (`CONTEXT.md`) — a deliberate divergence: "matrix" is precise internally but is jargon in UI copy
_Avoid_: matrix, submission matrix, gradebook

**Criterion Analytics**:
The per-criterion overview table showing average marks and completion across students and groups. The navigation label may shorten to **Analytics** where the context is already a grid.
_Maps to_: Criterion Analytics (`CONTEXT.md`)
_Avoid_: rubric analytics

## Grade

**Grade**:
The recorded evaluation of one criterion; also the general word for the act of producing it ("grading").
_Maps to_: Grade (`CONTEXT.md`)
_Avoid_: assessment, assess, evaluation

**Score**:
A measured input value entered for a numerical criterion (for example "12 subnets identified"), before it's converted to a mark.
_Maps to_: Score (`CONTEXT.md`)
_Avoid_: mark, points (score is the measured input only, never the graded output)

**Mark**:
The value a single criterion contributes to a grade.
_Maps to_: Mark (`CONTEXT.md`)
_Avoid_: points, score (mark is the per-criterion output only)

**Total**:
The summed value across a rubric's criteria (a rubric total) or across a whole grid (a final total).
_Maps to_: Total (`CONTEXT.md`)
_Avoid_: grade (when meaning the aggregate — grade names the individual record, not the sum), sum

## URL segments

URLs are user-facing: users read, type, and bookmark them, so every segment is a Lexicon word (never a code-only term like "target" or "matrix"). The identifier convention is `[gridId]`/`[targetId]` resolving identity, with an optional cosmetic slug segment for readability (identity resolves from the id, not the slug — see `CONTEXT.md`'s Grid Slug).

```
/grids/[gridId]/[gridSlug]/rubrics/                               author rubrics and their criteria
/grids/[gridId]/[gridSlug]/grades/                                the Grades table (see everyone; start grading)
/grids/[gridId]/[gridSlug]/grades/[targetId]/[targetSlug]/        grade one student or group
/grids/[gridId]/[gridSlug]/grades/[targetId]/[targetSlug]/rubrics/[rubricId]/   grade one on one rubric
/grids/[gridId]/[gridSlug]/analytics/                             Criterion Analytics
/grids/[gridId]/[gridSlug]/import/...                             import students, rubrics, grades
```

Rule: an id segment (`[gridId]`, `[targetId]`) is only ever followed by static sub-resource segments, never by a static segment sitting beside a bare dynamic sibling — so no route ever depends on Next.js static-vs-dynamic match precedence, and an id can never accidentally collide with a reserved word. The per-target Grades matrix and per-criterion Analytics are separate top-level destinations, not sub-views of a shared "overview" wrapper, so either can grow without collision.

## Import / export columns

CSV column headers are user-facing and follow the Lexicon.

| Column | Meaning | Replaces |
| --- | --- | --- |
| `kind` | `individual` or `group` — how a grade row is composed | `submission_type` |
| `name` | the student's or group's display label | `submitter` |
| `<rubricId>:<criterionId>` | a recorded grade for one criterion | `<questionId>:<rubricId>` |
| `<rubricId>:<criterionId>:marks` | the mark a criterion contributed (export-only, ignored on import) | `<questionId>:<rubricId>:marks` |
| `<rubricId>:total` | a rubric's total (export-only) | per-question total |
| `final_total` | the grid-wide total (export-only) | `grand_total_marks` |

`kind` keeps `individual`/`group` even though the code unifies both as a Grade Target, because the distinction still matters to a person reading or writing the file.

## Deliberately not user-facing

Some `CONTEXT.md` concepts exist for code and persistence reasons only and should never surface as their own word in UI copy. Recorded here so a future contributor doesn't "fix" the missing entry.

- **Grade Target** (`CONTEXT.md`): the row of a Grid, currently backed by a Student or a Group. UI copy names the Student or Group directly — a table column, a page heading, or an error message says "this student" or "this group," never "this target" or "this grade target." In URLs the identifier is `[targetId]`, but the word "target" never appears as a path segment.
- **Grade Matrix**, **Matrix** (`CONTEXT.md`): the internal name for the Grades table. UI copy and aria-labels say "Grades", never "matrix".

## Growing this file

Not every `CONTEXT.md` concept has a user-facing surface yet, and this file grows alongside it as terminology decisions are made and as existing UI copy is audited against them.

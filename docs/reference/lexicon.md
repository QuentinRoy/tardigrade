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

**Submission Matrix**:
The per-submission overview table on a grid's overview page, showing each submission's mark for every criterion.
_Maps to_: Submission Matrix (`CONTEXT.md`)

**Criterion Analytics**:
The per-criterion overview table on a grid's overview page, showing average marks and completion across submissions.
_Maps to_: Criterion Analytics (`CONTEXT.md`)

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

## Growing this file

Not every `CONTEXT.md` concept has a user-facing surface yet, and this file grows alongside it as terminology decisions are made and as existing UI copy is audited against them.

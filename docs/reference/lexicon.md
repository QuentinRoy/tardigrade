# Lexicon: user-facing vocabulary

A dictionary of the words this product shows users: UI labels, headings, button text, empty states, error messages, export column headers, and URL path segments. One concept gets exactly one preferred term — never introduce a second word for a concept that already has an entry, and never reuse an entry's word for a different concept. Prefer plain, jargon-free language; plain and consistent language is also the foundation for future translation.

This is not [CONTEXT.md](../../CONTEXT.md), the internal domain glossary — the two are related but may deliberately diverge when a friendlier word serves users better; when they do, the internal glossary's entry records the mapping (its audience is the one that needs it). Some internal terms must **never** appear in UI copy: say "this student" or "this group", never "target" or "grade target"; say "Grades", never "matrix". Before writing copy that names a concept, check for its entry here; if the concept has no entry yet, add one (alphabetically) in the same change rather than inventing copy ad hoc. Shipped copy may lag a recent decision here — that's a follow-up task, not a reason to keep this file describing stale vocabulary. Larger word-built contracts (the URL tree, import/export column sets) are documented with the features that own them, not here — this file only owns the words they're built from.

---

**Criterion**:
One graded item within a rubric.
_Avoid_: rubric (when meaning a single graded item)

**Criterion Analytics**:
The overview table showing each criterion's average marks and completion across students and groups. Navigation may shorten it to **Analytics** where the context is already a grid.
_Avoid_: rubric analytics

**Grade**:
The recorded evaluation of one criterion — what was judged (passed, a chosen label, a score) — and the general word for the act of producing it ("grading"). A grade is a judgment, not a number: the number it's worth is its **mark**. Grades survive changes to a criterion's marks configuration; the marks recompute.
_Avoid_: assessment, assess, evaluation, mark (when meaning the recorded judgment)

**Grades** (table):
The overview table showing every student's or group's marks for every criterion, with totals and completion. Its first column is headed **Name**.
_Avoid_: matrix, submission matrix, gradebook

**Grid**:
The container an instructor creates to grade a set of students or groups against a set of rubrics.
_Avoid_: project, test, exam, assignment

**Group**:
One or more students graded as a single unit.
_Avoid_: team

**Kind** (`kind`):
In grade CSV files, whether a row is graded as an `individual` or a `group`.
_Avoid_: submission_type, type

**Mark**:
The numeric value a **grade** is worth, computed from the criterion's configuration (as on an exam paper: "[4 marks]"). Marks sum into **totals**; the judgment they're computed from is the grade.
_Avoid_: points, score (mark is the derived per-criterion number only), grade (when meaning the number)

**Name** (`name`):
The student's or group's display label — as the Grades table's first column header and as the `name` CSV column. A fixed word, so it stays correct whether a grid contains individuals, groups, or both.
_Avoid_: student, group, submission (as a header), submitter

**Rubric**:
The grading grid for one exercise or section: its criteria, and how each one is scored.
_Avoid_: question, exercise (a rubric's own label may read "Exercise 3" when quoting source material, but the product's own chrome says "rubric")

**Score**:
A measured input value entered for a numerical criterion (for example "12 subnets identified"), before it's converted to a mark.
_Avoid_: mark, points (score is the measured input only, never the graded output)

**Student**:
A person being graded, individually or as part of a group.
_Avoid_: participant, user

**Total**:
The summed value across a rubric's criteria (a rubric total) or across a whole grid (a final total).
_Avoid_: grade (when meaning the aggregate — grade names the individual record, not the sum), sum

---

## References

The word-list shape and rules this file follows:

- [GOV.UK style guide A to Z](https://www.gov.uk/guidance/style-guide/a-to-z) — the canonical public-sector word list; alphabetical entries with usage guidance.
- [Writing for GOV.UK](https://www.gov.uk/guidance/content-design/writing-for-gov-uk) — "choose one way to describe each idea and use it consistently"; the one-concept-one-term rule.
- [Mailchimp Content Style Guide: Word List](https://styleguide.mailchimp.com/word-list/) — a product word list with terse entries and explicit words-to-avoid.
- [Microsoft Writing Style Guide](https://learn.microsoft.com/en-us/style-guide/welcome/) — its A–Z word list pairs each term with a directive and an alternative; also the source of "easy to read is easy to localize".
- [Atlassian content design glossary template](https://www.atlassian.com/software/confluence/templates/content-design-glossary) — a team-glossary template for product terminology.
- [ISO/IEC Directives, Part 2](https://www.iso.org/sites/directives/current/part2/index.xhtml) — formal terminology rules: one term per concept, one definition per entry, no circular definitions.
- [Nielsen Norman Group: UX Writing study guide](https://www.nngroup.com/articles/ux-writing-study-guide/) — why consistency matters: users scan, and every synonym taxes re-parsing.

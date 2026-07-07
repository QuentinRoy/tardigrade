# Lexicon: user-facing vocabulary

A dictionary of the words this product shows users: UI labels, headings, button text, empty states, error messages, export column headers, and URL path segments. One concept gets exactly one preferred term — never introduce a second word for a concept that already has an entry, and never reuse an entry's word for a different concept. Prefer plain, jargon-free language; plain and consistent language is also the foundation for future translation.

This is not [CONTEXT.md](../../CONTEXT.md), the internal domain glossary — the two are related but may deliberately diverge when a friendlier word serves users better; when they do, the internal glossary's entry records the mapping (its audience is the one that needs it). Some internal terms must **never** appear in UI copy: say "this student" or "this group", never "target" or "grade target"; say "Grades", never "matrix". Before writing copy that names a concept, check for its entry here; if the concept has no entry yet, add one (alphabetically) in the same change rather than inventing copy ad hoc. Shipped copy may lag a recent decision here — that's a follow-up task, not a reason to keep this file describing stale vocabulary. Larger word-built contracts (the URL tree, import/export column sets) are documented with the features that own them, not here — this file only owns the words they're built from.

---

**Average**:
A single criterion's mean mark across all students and groups — the Criterion Analytics column. A per-criterion mean, distinct from a **Total** (one student's or group's summed marks) and an **Average total** (the grid-wide mean of totals).
_Avoid_: using "Average" for one student's total (that is a **Total**)

**Average total**:
The grid-wide mean of students' and groups' totals. Distinct from an **Average** (one criterion's mean) and a **Total** (one student's or group's sum). Not currently surfaced anywhere — a named concept awaiting a home once **Total** is built.
_Avoid_: class average (a grid is not always a class)

**Check**:
A criterion kind: a yes/no question whose two answers each carry their own marks — either answer may be worth more, so there is no built-in "pass" or "fail". One of the three criterion kinds (with **Options** and **Number**); the word shown in the kind selector and the YAML `kind:` field. Its two answers are labelled **Yes** and **No**.
_Avoid_: boolean (as the kind name); pass/fail, true/false (as answer labels — use Yes/No)

**Completion**:
How much grading is done: the share of a grouping's criteria that have a recorded grade, shown as a count and a bar. A rubric, student, group, or grid is "fully graded" when its completion is whole.
_Avoid_: progress ("75% progress"), assessed

**Criterion**:
One graded item within a rubric.
_Avoid_: rubric (when meaning a single graded item)

**Criterion Analytics**:
The table showing each criterion's average marks and completion across students and groups. Shown as the **Analytics** section of the **Results** page.
_Avoid_: rubric analytics

**Grade**:
The recorded evaluation of one criterion — what was judged (a Yes/No answer, a chosen label, or a number such as 12) — and the general word for the act of producing it ("grading"). A grade is distinct from its worth: even when the grade is itself a number, the **mark** it earns is computed from it. Grades survive changes to a criterion's marks configuration; the marks recompute.
_Avoid_: assessment, assess, evaluation, mark (when meaning the recorded judgment)

**Grades** (table):
The overview of all grading in a grid: one row per student or group, one cell per criterion's grade — rendered as the **mark** it earns, since marks are the one representation comparable across criterion kinds — plus totals and completion. Named for what the cells are (grades), not the unit they display, like an Orders table showing amounts. Its first column is headed **Name**.
_Avoid_: matrix, submission matrix, gradebook, marks (as the table name)

**Grid**:
The container an instructor creates to grade a set of students or groups against a set of rubrics.
_Avoid_: project, test, exam, assignment

**Group**:
One or more students graded as a single unit.
_Avoid_: team

**Kind**:
The word for every "which of several sorts" choice, so the app never mixes "kind" and "type". A **Criterion**'s kind is **Check**, **Options**, or **Number** (the kind selector and the YAML `kind:` field). A grade row's kind, in the grades CSV `kind` column, is `individual` or `group`.
_Avoid_: type (use "kind" for every such choice), submission_type

**Mark**:
The numeric value a **grade** is worth, computed from the criterion's configuration (as on an exam paper: "[4 marks]"). Marks sum into **totals**; the judgment they're computed from is the grade.
_Avoid_: points, value (a mark is the worth, not the entered value), grade (when meaning the number)

**Name** (`name`):
The student's or group's display label — as the Grades table's first column header and as the `name` CSV column. A fixed word, so it stays correct whether a grid contains individuals, groups, or both.
_Avoid_: student, group, submission (as a header), submitter

**No**:
One of the two answers to a **Check** criterion (the other is **Yes**). Each answer carries its own marks; No may be worth more than Yes — a Check has no built-in "fail".
_Avoid_: false, fail

**Number**:
A criterion kind: the grader enters a value that maps to marks by a configured range. One of the three criterion kinds (with **Check** and **Options**); the word shown in the kind selector and the YAML `kind:` field.
_Avoid_: numerical, numeric

**Options**:
A criterion kind: the grader picks one of several labels the author defines, each worth some marks. The labels are unordered and may share marks. One of the three criterion kinds (with **Check** and **Number**); the word shown in the kind selector and the YAML `kind:` field.
_Avoid_: ordinal, scale, rating, levels (imply an order Options does not have)

**Overview**:
A grid's home page: its grading progress at a glance and the links to start grading, manage rubrics, and import. The status-and-navigation page, distinct from **Results**, which shows the grades themselves.
_Avoid_: dashboard

**Results**:
The page showing a grid's outcomes: the **Grades** table (every student or group against every criterion) and the **Analytics** breakdown (each criterion's averages). Distinct from **Overview**, which shows progress and navigation but no result tables.
_Avoid_: analytics (as the page name — Analytics is a section within Results), rubric overview, submission matrix (as the page name)

**Rubric**:
The grading grid for one exercise or section: its criteria, and how each one is graded.
_Avoid_: question, exercise (a rubric's own label may read "Exercise 3" when quoting source material, but the product's own chrome says "rubric")

**Student**:
A person being graded, individually or as part of a group.
_Avoid_: participant, user

**Total**:
The summed marks across a rubric's criteria (a rubric total) or across a whole grid (a final total). A single student's or group's aggregate — the Grades table's rightmost column — is a Total, not an "Average" (see **Average**, **Average total**).
_Avoid_: grade (when meaning the aggregate — grade names the individual record, not the sum), value (when meaning the aggregate), sum, "Average" (for one target's total)

**Value**:
The number a grader enters on a **Number** criterion (a count or a measurement), which maps to marks. Its allowed range is set by the criterion's Min value and Max value.
_Avoid_: score (fully retired — it read as a good-thing tally, wrong for reversed criteria where a higher value earns fewer marks)

**Yes**:
One of the two answers to a **Check** criterion (the other is **No**). Each answer carries its own marks; Yes is not inherently the higher-marked or "pass" answer.
_Avoid_: true, pass

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

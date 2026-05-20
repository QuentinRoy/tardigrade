# Domain terminology investigation

Related issue: #99

## Status

This document is the entry point for current investigation results around terminology and domain modeling.

It is intentionally not exhaustive or final. It contains observations, hypotheses, and candidate directions. Presence here does not imply adoption.

Purpose:
- preserve rationale
- track evolving thinking
- avoid issue descriptions becoming design documents
- provide a reference for contributors and coding agents
- distinguish ideas, assumptions and decisions
- record rejected or deferred alternatives so the same discussions do not need to be repeated

Future work and discoveries are expected.

---

## How to read investigation documents

Status labels:
- Working assumption: currently useful model, not yet formally decided
- Proposed: likely direction, but not yet implemented or recorded as an ADR
- Investigation: open area requiring more evidence
- Rejected for now: intentionally avoided unless future evidence changes

Confidence labels:
- High: strong evidence and low expected churn
- Medium: reasonable current direction, but still needs validation
- Low: speculative or incomplete

These documents are not ADRs. When a direction becomes stable enough, implemented, or referenced as policy by code or documentation, extract it into a focused decision record and leave a summary here.

---

## Related investigations

- [Assessment target model](./assessment-target-model.md)
- [Mark, grade and weighting model](./mark-grade-weighting-model.md)

---

## Current working model

Status: Working assumption
Confidence: Medium
Decision owner: TBD

Question -> Rubric -> Mark -> Question grade -> Final grade

Current understanding:
- Question appears to be the main container.
- Rubric appears to represent a single grading dimension.
- A rubric produces a mark.
- Marks contribute to grades.
- Grades can exist at multiple levels.

Potential interpretation:

Question
- contains several rubrics
- receives a question grade after aggregating rubric marks

Rubric
- evaluates one grading dimension
- can be boolean, ordinal, numerical, etc.
- produces one mark

Mark
- rubric-level result

Grade
- aggregate result

Open questions:
- Is question always the correct term?
- Should users see question for reports, peer review, project grading or other non-exam workflows?
- Is rubric understandable enough for users?
- Should the UI use terms like grille, barème, critère d'évaluation or note depending on context?

### Conventional model intentionally avoided for now

Status: Rejected for now
Confidence: Medium

Many grading systems use:

Rubric -> Criterion -> Level

or:

Rubric -> Rubric row -> Rubric item

Current project understanding appears different:

Question -> Rubric

In this project, a rubric may already be what many systems call a criterion, row or grading item.

Avoid introducing these terms unless an actual additional hierarchy exists:
- criterion
- criteria
- rubric row
- rubric item
- rubric entry

Reasoning:
Introducing conventional terminology without a matching structure risks creating an artificial hierarchy and confusing contributors, users and coding agents.

Future reconsideration:
If nested grading dimensions or a true rubric container appear later, revisit the terminology.

---

## User-facing versus developer terminology

Status: Investigation
Confidence: Medium
Decision owner: TBD

Goal:
Prefer alignment between developer and user terminology where practical.

Principle:
If terminology differs between UI and implementation, the difference should be intentional and documented.

Helpful divergence may be acceptable:

Developer term -> User-facing term
- ImportedStudentIdentifier -> Student number
- RubricAssessment -> Evaluation
- InternalId -> not shown

Unhelpful drift should be avoided:

Same concept described as:
- code: project
- UI: assignment
- help text: workspace
- docs: grading session

This kind of drift makes it harder for users, future contributors and agents to know whether terms refer to the same concept or subtly different concepts.

Audit questions:
- Where do UI and implementation vocabulary diverge?
- Which divergences help users?
- Which divergences create confusion?
- Which terms should be canonical in code?
- Which terms should be canonical in the UI?
- Which terms should be documented as legacy or discouraged synonyms?

---

## Glossary structure

Status: Proposed
Confidence: Medium
Decision owner: TBD

A future `docs/domain-glossary.md` should not be a vague dictionary. It should encode decisions and discourage ambiguous usage.

Suggested entry structure:

Term: Mark

Developer term:
Mark

Preferred user-facing term:
TBD, possibly note depending on language/context

Definition:
Value produced by a rubric.

Use for:
- rubric-level grading value
- value that contributes to question grade

Do not use for:
- raw observed value before rubric conversion
- final aggregate grade

Discouraged synonyms:
- score, when referring to a rubric-produced grading value
- grade, when referring to a rubric-level value

Examples:
- Numerical rubric maps 12 identified networks to mark 4.
- Boolean rubric maps true to mark 2.

Incorrect examples:
- Final mark = 15/20, if the project uses grade for final aggregate results.

Each glossary entry should ideally include:
- canonical developer term
- preferred user-facing term, when relevant
- discouraged or legacy synonyms
- definition
- correct examples
- incorrect examples
- notes about intentionally different UI terminology

---

## Project terminology

Status: Investigation
Confidence: Low
Decision owner: TBD

Open questions:
- Does project mean app workspace?
- Can project conflict with student projects?
- Should users see project, course, grading session, assignment or something else?
- Is project too generic once auth, sharing or multiple courses exist?

Potential risk:
A user might understand project as the students' submitted project, while the app may use project as the grading workspace.

Potential alternatives:
- Course
- Assignment
- Grading project
- Grading session
- Workspace

No recommendation yet.

---

## Identifiers

Status: Investigation
Confidence: Medium
Decision owner: TBD

Open questions:
- Which identifiers are internal?
- Which identifiers are imported?
- Which identifiers are public?
- Which identifiers should users see?

Potential categories:
- internal database IDs
- imported Moodle identifiers
- imported student identifiers
- future public URL identifiers
- natural keys scoped to a project/group/course

Principle:
Avoid using `id` names for imported or external identifiers when they can be confused with database primary keys.

Potential examples:
- StudentId: internal database identifier
- ImportedStudentIdentifier: external identifier from imported data
- PublicProjectId: URL-safe public identifier, if introduced later

Open questions:
- Which identifiers should appear in exports?
- Which identifiers should appear in URLs?
- Which identifiers should appear in user-facing conflict resolution screens?

---

## Agent implications

Status: Proposed
Confidence: High
Decision owner: TBD

Coding agents may import conventional assumptions when terminology is underspecified.

Observed failure mode:
The term rubric led to the assumption of a conventional hierarchy:
Rubric -> Criterion

This does not appear to match the current project model.

Other likely assumptions:
- team means a persistent collaborative team
- score, mark and grade are synonyms
- project means a submitted student project
- question always means exam question
- imported identifiers are database IDs

Implication:
Terminology should be explicit enough to reduce inferred assumptions.

Recommended future agent guidance:
- check the glossary before introducing a domain term
- do not introduce conventional terms unless the project model uses them
- distinguish raw observations, rubric marks and aggregate grades
- distinguish internal IDs from imported identifiers
- distinguish UI wording from persistence concepts

---

## Rejected or deferred alternatives

Status: Working assumption
Confidence: Medium
Decision owner: TBD

Rejected or deferred for now:

- criterion as a project term
- rubric row
- rubric item
- rubric entry
- team as canonical terminology
- score as the generic rubric output
- score and grade as interchangeable terms
- normalization-first weighting model
- persistence-level individual/group split, unless proven necessary

These are not permanently rejected. They should be reconsidered if the domain model changes.

Reason for preserving this list:
It prevents future contributors and agents from reintroducing discarded terminology without revisiting the rationale.

---

## Candidate deliverables

- docs/domain-glossary.md
- ADRs where needed
- terminology decisions
- candidate refactors
- agent guidance
- possible AGENTS.md updates

## Notes

This document captures current thinking, not final decisions.

When discussions evolve, update this investigation or a focused child investigation rather than growing issue #99 indefinitely.

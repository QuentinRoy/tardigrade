# Mark, grade and weighting investigation

- **Status:** Active
- **Created:** 2026-05-20
- **Related:** #99
- **Note (2026-07-06):** The *terminology* is resolved (see `CONTEXT.md`): the value pipeline is **Score → Mark → Total**, `Grade` names the atomic per-criterion record and the act of grading (never a number in the pipeline), and `Points` is avoided. The *structural* questions remain open and keep this Active: whether aggregation is a plain sum or `Σ mark × weight`, where weighting lives, and whether normalization is needed. Total is named but unbuilt.

This document extracts investigation around grading outputs and aggregation.

This document is intentionally not exhaustive or final.

---

## Mark versus grade

Status: Proposed
Confidence: Medium
Decision owner: TBD

Current concern:
Boolean and ordinal rubrics directly produce grading values while numerical rubrics currently introduce score.

Potential direction:
All rubric types produce Mark.
Score becomes optional.

Examples:

Boolean:
true -> mark = 2

Ordinal:
Très bien -> mark = 4.5

Numerical:
12 identified networks -> mark = 4

Motivating numerical example:
A numerical rubric may ask how many subnetworks were correctly identified.
The observed value might be 12.
The rubric then maps that observed value to a mark of 4 out of 4.

Flow:
raw score 12 -> mark 4 -> question grade -> final grade

Definitions:

Mark:
- value produced by a rubric
- may be positive, negative or asymmetric
- contributes to a question grade

Question grade:
- aggregation of rubric marks for a question

Final grade:
- overall result

Raw score:
- optional measured value used internally by some rubric implementations
- should not become the general term for rubric-produced grading values

Reasoning:
Avoid numerical rubrics behaving fundamentally differently from boolean and ordinal rubrics.

Rejected or deferred:
- Using score as the common output of all rubrics.
- Treating score and mark as interchangeable.
- Treating rubric-level mark and aggregate grade as the same concept.

Open questions:
- Should user-facing terminology use note, mark, grade, score or context-specific labels?
- Should the code use finalGrade only when intermediate grades exist?
- Is question grade the right term, or should it be assessment grade?

---

## Weighting and scaling

Status: Investigation
Confidence: Low
Decision owner: TBD

Problem:
Changing grading importance currently risks becoming rubric-specific.

Examples:
- modify numerical score mappings
- modify ordinal label values
- modify boolean marks

Potential direction:
Rubric results expose:
- mark
- weight

Question grade becomes weighted aggregation.

Potential aggregation:
Question grade = sum(mark * weight)

Potential benefits:
- consistent behavior across rubric types
- post-assessment tuning becomes more generic
- avoids special handling for numerical rubrics
- supports analytics and exports more consistently

Normalization concern:
Do not make normalization foundational too early.

Problem examples:
Human-readable mark ranges may be:
- 0..4
- -2..0
- -1..2

Normalizing these to 0..1 or -1..1 may obscure meaning and make UI/debugging harder.

Potential direction:
Keep mark and weight primary.
Treat normalization as derived if needed for analytics.

Open questions:
- handling negative/asymmetric rubrics
- whether weighting belongs at rubric or question level
- whether normalization is useful
- whether normalization should remain derived only
- whether weighted aggregation is compatible with malus-style rubrics

Rejected or deferred:
- Normalization-first model.
- Forcing all rubrics into 0..1 or -1..1 as the primary representation.
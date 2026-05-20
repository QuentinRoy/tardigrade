# Mark, grade and weighting investigation

Related issue: #99

This document captures current thinking around grading outputs and aggregation.

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
Mark: value produced by a rubric
Question grade: aggregation of rubric marks
Final grade: overall result
Raw score: optional measured value used internally by some rubric implementations

Rejected or deferred:
- Using score as the common output of all rubrics.
- Treating score and mark as interchangeable.
- Treating rubric-level mark and aggregate grade as the same concept.

Open questions:
- Should user-facing terminology use note, mark, grade, score or context-specific labels?
- Is question grade the right term?

---

## Weighting and scaling

Status: Investigation
Confidence: Low
Decision owner: TBD

Problem:
Changing grading importance currently risks becoming rubric-specific.

Potential direction:
Rubric results expose:
- mark
- weight

Question grade = sum(mark * weight)

Potential benefits:
- consistent behavior across rubric types
- post-assessment tuning becomes more generic
- avoids special handling for numerical rubrics

Normalization concern:
Do not make normalization foundational too early.

Open questions:
- handling negative/asymmetric rubrics
- whether weighting belongs at rubric or question level
- whether normalization should remain derived only
- whether weighted aggregation is compatible with malus-style rubrics

Rejected or deferred:
- Normalization-first model
- Forcing all rubrics into normalized ranges as primary representation
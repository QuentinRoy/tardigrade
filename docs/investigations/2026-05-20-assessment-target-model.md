# Assessment target model investigation

Related issue: #99

This document captures current thinking about assessment targets, group terminology, and the relation between individual and grouped assessments.

This document is intentionally not exhaustive or final. It contains observations, hypotheses, and candidate directions. Presence here does not imply adoption.


## Group terminology

Status: Proposed
Confidence: Medium
Decision owner: TBD

Working direction:
Prefer group over team.

Reasons:
- naturally represents one or many students
- avoids implying persistent collaboration
- aligns with educational workflows
- singleton groups work naturally
- covers binômes, trinômes, lab groups and ad hoc assessment groups
- may align better with imported Moodle groups

Potential direction:
Student -> Group -> Assessment

Singleton-group rationale:
A group of size 1 can represent an individual assessment target.

This may avoid persistent branching such as:
- StudentAssessment versus GroupAssessment
- individual target versus team target
- isStudent / isGroup checks in core grading logic

Instead:
Assessment targets a group.
The UI can present singleton groups as individual assessments.

Future-proofing examples:
- individual grading
- pair grading
- peer-review groups
- temporary evaluation groups
- imported Moodle groups
- anonymous review groups

Open questions:
- Are there future cases where group and team become distinct?
- Are imported Moodle groups the same concept as assessment groups?
- Should group be a core persistence concept or a derived assessment target?

## Individual versus grouped assessment

Status: Investigation
Confidence: Low
Decision owner: TBD

Current UI distinguishes individual and grouped assessments.

This distinction appears useful at the workflow/presentation layer:
- display
- search
- lookup
- organization
- imports
- labels
- actions

Potential persistence direction:
AssessmentTarget = Group
Group = one or more students

Potential presentation direction:
Group size 1 -> individual assessment UI
Group size greater than 1 -> grouped assessment UI

Guiding principle:
Do not force workflow distinctions into persistence unless they represent stable domain invariants.

This principle may apply beyond this specific case. UI modes and workflow affordances do not always need separate database models.

Examples:
- individual assessment UI
- grouped assessment UI
- anonymous assessment UI
- peer-review assessment UI

These may be presentation/workflow variants over a simpler assessment target model.

Open questions:
- Which queries require distinct persistence?
- Is the distinction mostly workflow driven?
- Would a unified persistence model simplify imports, exports, sharing and grading logic?
- Where should the distinction be reintroduced for user clarity?

Rejected or deferred:
- Separate persistence-level individual and group assessment models, unless evidence shows this distinction is a stable domain invariant.

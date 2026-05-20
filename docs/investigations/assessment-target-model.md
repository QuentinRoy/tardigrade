# Assessment target model investigation

Related issue: #99

This document extracts investigation around assessment targets and grouping.

## Group terminology

Status: Proposed
Confidence: Medium

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

Open questions:
- Are imported Moodle groups the same concept as assessment groups?
- Should group be core persistence or a derived target?
- Are there future cases where group and team diverge?

## Individual versus grouped assessment

Status: Investigation
Confidence: Low

Potential persistence direction:
AssessmentTarget = Group
Group = one or more students

Presentation direction:
- group size = 1 -> individual assessment UI
- group size > 1 -> grouped assessment UI

Rejected or deferred:
- Separate persistence-level individual and group assessment models unless evidence shows stable domain invariants.
# Investigation: grading workflows and Dumbgrade product positioning

Status: Current investigation
Date: 2026-05-22
Related: #112

## Question

What problem is Dumbgrade actually trying to solve, who is it for, and where should its scope boundaries sit?

## Executive summary

Dumbgrade originated from frustrations with spreadsheet-based grading workflows.

Current intuition suggests that spreadsheet workflows may be the primary practical competitor, while LMS platforms may often be closer to integration targets.

These are hypotheses rather than conclusions.

## Current observations

Typical workflow:

LMS
↓
CSV export
↓
Excel / Sheets
↓
manual grading workflow
↓
CSV import

Observed pain points:

- fragile formulas;
- hidden logic;
- difficult reuse;
- poor progress visibility;
- import friction;
- collaboration friction.

## Positioning hypotheses

### Excel / Sheets

Potentially the primary practical competitor.

Strengths:

- already available;
- extremely flexible;
- familiar;
- powerful calculations.

Weaknesses:

- grading logic becomes fragile;
- hidden formulas and dependencies;
- difficult reuse;
- difficult collaboration;
- grading-specific workflows are implicit.

Possible Dumbgrade direction:

Keep spreadsheet flexibility while replacing spreadsheet fragility.

### LMS platforms (Moodle, Canvas, Blackboard)

Current hypothesis:

Potentially closer to integration targets than direct competitors.

Strengths:

- institution deployment;
- submissions;
- authentication;
- course management.

Weaknesses for grading workflows:

- grading UX may not be the primary focus;
- workflow customization can be limited.

### Grading tools (Gradescope, Crowdmark, etc.)

Current hypothesis:

Useful sources of workflow inspiration and comparison.

Open questions:

- Which workflows do they solve well?
- Which frustrations remain?
- Which ideas should Dumbgrade intentionally avoid?

## Open questions

- Which frustrations are broadly shared?
- Which workflows matter most?
- What should Dumbgrade own versus integrate with?
- Which collaboration needs are common?

## Potential next steps

- Review competing grading workflows and tools.
- Observe and document spreadsheet workflows.
- Discuss workflows with peers and teaching assistants.

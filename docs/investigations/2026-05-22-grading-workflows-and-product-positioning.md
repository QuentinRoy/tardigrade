# Investigation: grading workflows and product positioning

- **Status:** Active
- **Created:** 2026-05-22
- **Related:** #112

Note: the app's public-facing name is **Tardigrade** (decided in #106; earlier working names "Dumbgrade" and "BonPoint" are dropped). The repository and technical identifiers stay `grading`.

## Question

What problem is this project actually trying to solve, who is it for, and where should its scope boundaries sit?

The goal is not to define a final product vision. The goal is to capture current observations and hypotheses before they disappear into implementation details.

## Executive summary

This project originated from frustrations with spreadsheet-based grading workflows.

Current intuition suggests:

- spreadsheet workflows may be the primary practical competitor;
- LMS platforms may often be closer to integration targets;
- grading workflows appear more central than course-management workflows;
- explicit and inspectable operations may provide meaningful value.

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
- collaboration friction;
- difficult change tracking.

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

Possible project direction:

Keep spreadsheet flexibility while replacing spreadsheet fragility.

Open questions:

- Which spreadsheet workflows should be preserved?
- Which spreadsheet behaviors should intentionally disappear?

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

Open questions:

- Which LMS functionality should be integrated rather than reimplemented?
- Where would ownership create unnecessary scope growth?

### Grading tools (Gradescope, Crowdmark, etc.)

Current hypothesis:

Useful sources of workflow inspiration and comparison.

Open questions:

- Which workflows do they solve well?
- Which frustrations remain?
- Which ideas should the project intentionally avoid?

## Candidate principles (hypotheses)

- Optimize for grading workflows.
- Prefer explicit operations over hidden behavior.
- Preserve portability of grading data.
- Integrate before replacing.
- Support collaboration where useful without making it central.

## Open questions

- Which frustrations are broadly shared?
- Which workflows matter most?
- Which personas matter?
- What should the project own versus integrate with?
- Which collaboration needs are common?
- Is spreadsheet replacement actually the right framing?

## Candidate follow-up investigations

- Spreadsheet workflow examples and pain points.
- Competitor workflow review.
- Peer / TA workflow interviews.
- Collaboration use cases.
- Import and export workflow philosophy.
- Candidate product principles and non-goals.

## Potential next steps

- Review competing grading workflows and tools.
- Observe and document spreadsheet workflows.
- Discuss workflows with peers and teaching assistants.
- Revisit assumptions after gathering external input.
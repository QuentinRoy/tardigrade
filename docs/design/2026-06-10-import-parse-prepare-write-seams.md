# Import parse, prepare, and write seams

Status: Active
Date: 2026-06-10
Resolution: Chosen design for restructuring the three import flows (assessments, questions, students) around explicit parse → prepare → write seams.
Follow-up: Preview UI and configurable import policies belong to the import/product workflow investigation, not this design.

## Context

[Finding 11 of the source structure audit](../investigations/2026-05-25-source-structure-and-tech-debt-audit.md#finding-11-import-flows-should-expose-parse-prepare-and-write-seams) flags that imports parse, prepare, and write in one server-action flow, and that unmatched submissions are silently skipped. The [reliability plan](../../plans/active/2026-05-17-reliability-hardening.md) lists extracting a pure preparation phase as a testability refactor candidate. This design records the decisions made when stress-testing that finding (2026-06-10 grilling session).

Domain terms used here — **Import Plan**, **Blocking Diagnostic**, **Ignored Column** — are defined in [CONTEXT.md](../../CONTEXT.md).

## Decisions

### Scope and stages

All three import flows (assessments, questions, students) adopt the same seam structure:

```txt
parse → load context → prepare → write
```

- **Parse** stays as today: CSV/text → typed rows via a Validation Schema (pure leaf).
- **Load context** is a DB read primitive (`…FromDb`) that fetches everything prepare needs (rubrics, submission lookups, existing values), driven by the parsed rows.
- **Prepare** is a pure function: `(parsed rows, context) → Import Plan`. No database access, deterministic unit tests.
- **Write** is a DB write primitive (`…InDb`) that executes a plan's values-to-write.

### Plans are per flow

Each flow defines its own plan type (`AssessmentImportPlan`, `QuestionImportPlan`, `StudentImportPlan`) sharing only the glossary vocabulary. No generic `ImportPlan<T>` machinery: the meaningful diagnostics differ structurally per flow.

The plan type co-locates with its prepare function, like a Derived Input Type co-locates with its Validation Schema.

### Transaction boundary

In the current one-shot action flow, the app-level wrapper (per [ADR 0007](../adr/0007-db-primitives-take-a-handle-wrappers-own-transactions-and-cache.md)) opens one transaction wrapping load context → prepare → write, so a plan can never go stale between prepare and write. A future preview flow can run prepare alone outside a transaction and re-prepare inside the write transaction; that is explicitly not built now.

### Blocking policies

A plan with any Blocking Diagnostic writes nothing.

Assessments:

- Unmatched submissions **block** (behavior change: previously silently skipped).
- Ambiguous submissions, invalid cells, and unknown columns block (as today).
- Ignored Columns (derived export columns: `grand_total_marks`, per-rubric `:marks`) are reported, never block.
- Overwrites are detected and counted now; the success message reports the count. Overwrites never block (last-write-wins is the confirmed policy).

Questions:

- A rubric type change **blocks if and only if** linked assessments exist (behavior change: previously the rubric was silently deleted and recreated, cascading away assessments). The error names the rubric and assessment count and points to the question management UI, which already confirms destructive edits. Type changes with no linked assessments proceed.

Students:

- No blocking diagnostics. The plan distinguishes created vs updated students/submissions, replacing today's conflated counts. Stale-submission reconciliation is out of scope.

### Surfacing

`ImportState` stays `{status, message}`. Blocked imports flatten diagnostics into a deterministic multi-line message; successes report counts plus the overwrite count. The structured plan exists server-side only; the preview investigation owns any future client-facing contract.

## Module layout (assessments exemplar)

```txt
src/import/parseAssessments.ts            unchanged
src/import/assessmentImportContext.ts     loadAssessmentImportContextFromDb()   [DB read primitive]
src/import/prepareAssessmentImport.ts     AssessmentImportPlan + prepareAssessmentImport()   [pure]
src/import/saveAssessments.ts             saveAssessmentImportPlanInDb() + saveAssessments() wrapper
```

Questions and students mirror this shape with their own context/prepare/plan names.

## Rejected alternatives

- **Prepare as a DB read primitive doing its own queries**: plan-building logic would only be testable through integration tests — the problem the reliability audit flags.
- **Generic `ImportPlan<Item, Diagnostic>`**: lowest-common-denominator shape; diagnostics differ per flow.
- **Proceed-and-warn for unmatched submissions**: contradicts the all-or-nothing import policy and keeps partial application.
- **Always blocking rubric type changes on import**: removes a harmless workflow (iterating question files on fresh projects).
- **Structured diagnostics in `ImportState` now**: designs the client contract before the preview investigation that owns it.

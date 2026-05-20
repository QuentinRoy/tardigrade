# Plan: Repository Documentation Architecture Migration

Status: Completed
Date: 2026-05-20
Related: docs/investigations/repo-documentation-architecture.md

## Goal

Track the initial documentation migration with an accurate record of what has happened and what remains.

## Scope

In scope:

- Establish the new documentation structure.
- Add a lightweight docs index.
- Move migration conventions documentation into `docs/reference/`.
- Leave plan-file triage as the final step.

Out of scope:

- Promoting investigations into ADRs.
- Broad migration of existing documentation content.
- Settling long-term plan retention policy (Option A vs Option B remains under investigation).

## What Actually Happened

Completed:

- Added documentation structure directories: `docs/adr/`, `docs/design/`, `docs/reference/`, and `docs/guides/`.
- Added execution-plan directories: `plans/active/` and `plans/completed/`.
- Added `docs/index.md` as a lightweight documentation map.
- Updated `docs/investigations/repo-documentation-architecture.md` with new reflections on aborted plan documents.
- **Performed plan triage:**
  - Audited all files in `docs/plans/` for status, structure, and relevance.
  - Removed most legacy plan files due to unclear status, lack of actionable content, or redundancy.
  - Only retained known active and completed plans, moving them to `plans/active/` or `plans/completed/` as appropriate.
  - Moved the reliability hardening tracker plan to `plans/active/reliability-hardening.md`.
- **Audited open GitHub issues:**
  - Cross-checked all removed plan files against open issues for references.
  - Found multiple open reliability issues referencing the old tracker plan.
  - Updated all affected issues to reference the new canonical plan location and link.

Not yet completed:

- None (all migration and triage steps for this phase are complete).

## Remaining Steps

- All steps for this migration are now complete.

## Validation

- [x] New docs and plans directories exist.
- [x] `docs/index.md` reflects current structure.
- [x] Migration conventions are documented under `docs/reference/`.
- [x] Plan triage completed: all legacy plans reviewed, removed, or migrated; all open issue references updated.

## Notes

- This plan now reflects actual migration progress, including plan triage, mass removal, and reliability plan migration.
- All open issues referencing removed plans have been updated to point to the new canonical plan location.
- ADR content migration remains out of scope at this stage.
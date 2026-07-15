# Active plans

In-flight execution plans. Plans live flat in `plans/` and never move — lifecycle is tracked by each plan's `Status` field, not by directory. This index lists only `Status: Active` plans; remove a plan's entry here (don't move the file) the moment it completes or is abandoned.

Completed and abandoned plans aren't listed here — find them via `plans/`, git history, or the issue/PR they cite. See [docs/index.md](../docs/index.md#plans) for the canonical plan metadata block and the full convention.

- [Terminology audit follow-ups](2026-07-15-terminology-audit-followups.md) — close the gaps the #99 sweep left behind: stale docs, retired-vocabulary test fixtures/comments, open-issue triage, and the `GradeTargetSubmitter` naming decision.

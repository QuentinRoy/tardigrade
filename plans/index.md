# Active plans

In-flight execution plans. Plans live flat in `plans/` and never move — lifecycle is tracked by each plan's `Status` field, not by directory. This index lists only `Status: Active` plans; remove a plan's entry here (don't move the file) the moment it completes or is abandoned.

Completed and abandoned plans aren't listed here — find them via `plans/`, git history, or the issue/PR they cite. See [docs/index.md](../docs/index.md#plans) for the canonical plan metadata block and the full convention.

- [Enforce cross-grid integrity with composite foreign keys](2026-07-22-cross-grid-integrity-enforcement.md) — #144; replicated `grid_row_id` + composite FKs on `criterion_grade` (Option A).

# Active plans

In-flight execution plans. Plans live flat in `plans/` and never move — lifecycle is tracked by each plan's `Status` field, not by directory. This index lists only `Status: Active` plans; remove a plan's entry here (don't move the file) the moment it completes or is abandoned.

Completed and abandoned plans aren't listed here — find them via `plans/`, git history, or the issue/PR they cite. See [docs/index.md](../docs/index.md#plans) for the canonical plan metadata block and the full convention.

- [Source structure vertical-layers migration](2026-06-28-source-structure-vertical-layers-migration.md) — execute ADR 0010: dependency-cruiser enforcement + baseline, then slice `src/` into vertical layers. #201.

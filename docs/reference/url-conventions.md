# URL conventions

Durable facts about the app's route tree and its param-naming rules. Route lists are mechanical facts that drift when hand-copied — `src/grids/gridPaths.ts` is the source of truth for exact path strings; this doc covers the shape and rationale, not a maintained copy of every path.

## Route tree shape

Grid-scoped routes nest under `/grids/[gridId]/[gridSlug]/…` (Overview at the root, then `rubrics/`, `grades/`, `results/`, `import/…`, `export/…`); a target's own routes nest one level deeper under `grades/[targetId]/[targetSlug]/…`. The `/grades/` route is the **Grading** hub page (grade by student or group) — its URL segment names the resource, not the page; the **Grades** table itself lives on `/results/`. See the lexicon's Grading and Grades entries for the distinction. For exact path strings, read the helpers in `src/grids/gridPaths.ts` (`gridOverviewPath`, `gridRubricsPath`, `gridGradesPath`, `gridGradeTargetPath`, `gridResultsPath`, `gridImport*Path`, `gridExport*Path`).

Grid-scoped entity paths are built through those helpers; a couple of top-level, non-grid-scoped routes are still written by hand (`app/page.tsx`'s `/grids` redirect, `app/grids/page.tsx`'s `/grids?error=…`) since there's no grid to scope them to.

## ID vs slug segments

Each grid-scoped route carries two kinds of URL segment, per the **Grid ID** / **Grid Slug** distinction in [CONTEXT.md](../../CONTEXT.md):

- **`[gridId]`, `[targetId]`** — public identifiers. These resolve the entity; a page must never trust anything else in the URL to identify what to load.
- **`[gridSlug]`, `[targetSlug]`** — cosmetic, human-readable segments derived from the entity's current name. They make URLs shareable and readable but are not authoritative, and may go stale if the entity is renamed after the URL was copied.

A stale slug is corrected in place client-side rather than causing a redirect or a 404 — see ADR 0005 (which supersedes ADR 0001's server-redirect approach) for why, and its `canonicalizeSlugSegment` helper for the mechanism.

## Related

- ADR 0001 — the retired server-redirect approach to stale slugs (superseded).
- ADR 0005 — the accepted client-side slug-correction approach and its mechanism.
- [CONTEXT.md](../../CONTEXT.md) — Grid ID / Grid Row ID / Grid Slug / Canonical Grid URL definitions.

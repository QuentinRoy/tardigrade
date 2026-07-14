# URL conventions

Durable facts about the app's route tree and its param-naming rules. Generated route lists drift; treat `src/grids/gridPaths.ts` as the source of truth for exact path strings and this doc as the rationale for the shape.

## Route tree

```
/                                                            (redirects to the first grid's Overview, or to /grids if none exist)
/grids/                                                      (grid picker)
/grids/[gridId]/[gridSlug]/                                  (Overview — grid home)
/grids/[gridId]/[gridSlug]/rubrics/                          (manage rubrics)
/grids/[gridId]/[gridSlug]/grades/                           (Grades table)
/grids/[gridId]/[gridSlug]/grades/[targetId]/[targetSlug]/                       (grade one student or group)
/grids/[gridId]/[gridSlug]/grades/[targetId]/[targetSlug]/rubrics/[rubricId]/    (grade one rubric for that target)
/grids/[gridId]/[gridSlug]/results/                          (Results — Grades + Analytics)
/grids/[gridId]/[gridSlug]/import/rubrics/
/grids/[gridId]/[gridSlug]/import/students/
/grids/[gridId]/[gridSlug]/import/grades/
/grids/[gridId]/[gridSlug]/export/rubrics/
/grids/[gridId]/[gridSlug]/export/grades/
```

Path strings are built through the helpers in `src/grids/gridPaths.ts` (`gridOverviewPath`, `gridGradesPath`, `gridGradeTargetPath`, `gridGradeTargetRubricPath`, `gridRubricsPath`, `gridImport*Path`, `gridExport*Path`); no page builds a path by hand.

## ID vs slug segments

Each grid-scoped route carries two kinds of URL segment, per the **Grid ID** / **Grid Slug** distinction in [CONTEXT.md](../../CONTEXT.md):

- **`[gridId]`, `[targetId]`, `[rubricId]`** — public identifiers. These resolve the entity; a page must never trust anything else in the URL to identify what to load.
- **`[gridSlug]`, `[targetSlug]`** — cosmetic, human-readable segments derived from the entity's current name. They make URLs shareable and readable but are not authoritative, and may go stale if the entity is renamed after the URL was copied.

A stale slug is corrected in place client-side rather than causing a redirect or a 404 — see ADR 0005 (which supersedes ADR 0001's server-redirect approach) for why, and its `canonicalizeSlugSegment` helper for the mechanism. `rubricId` (on the grade-target-rubric route) has no accompanying slug: rubrics are identified but not independently named as URL-shareable entities the way grids and targets are.

## Related

- ADR 0001 — the retired server-redirect approach to stale slugs (superseded).
- ADR 0005 — the accepted client-side slug-correction approach and its mechanism.
- [CONTEXT.md](../../CONTEXT.md) — Grid ID / Grid Row ID / Grid Slug / Canonical Grid URL definitions.

import { cacheTag } from "next/cache";

// This module is the only place that builds cache-tag strings (ADR 0008 rule 1).
// Every accepted scope has a named helper; the vocabulary is closed, so adding a
// tag means adding a helper here, an entry in
// `docs/reference/cache-invalidation-map.md`, and at least one invalidating
// mutation (ADR 0008 rule 2). Never depend on nested tag propagation: a
// `"use cache"` scope registers the full closure of these tags for everything it
// renders (ADR 0008 rule 3).

// Coarse list tags — one per entity collection.
export function gridListCacheTag(): string {
	return "grids";
}

export function rubricListCacheTag(): string {
	return "rubrics";
}

export function gradeTargetListCacheTag(): string {
	return "grade-targets";
}

// A single grid's data, keyed by its public Grid ID.
export function gridCacheTag(gridId: string): string {
	return `grids:${gridId}`;
}

// The coarse grade aggregate: every grade in scope. Individual saves
// bust this, and grid-wide grade reads register it.
export function gradeAggregateCacheTag(): string {
	return "grades";
}

// The bulk-import aggregate. Imports bust this alongside the coarse aggregate;
// individual saves do not.
export function gradeImportCacheTag(): string {
	return "grades:all";
}

// The id-keyed tags below use public ids that are only unique within a grid,
// so the same tag can cover two grids (e.g. `t-1` in each). That costs an
// extra rebuild in the other grid (over-invalidation), never stale data.
// Grid-scoping them is folded into the Grid→Grid sweep stage (see
// `plans/2026-07-06-terminology-sweep.md`, stage 6).

// One grade target's grades across all rubrics.
export function gradeForGradeTargetCacheTag(targetId: string): string {
	return `grades:${targetId}`;
}

// One exact grade-target/rubric grade pair.
export function gradeForGradeTargetRubricCacheTag({
	targetId,
	rubricId,
}: {
	targetId: string;
	rubricId: string;
}): string {
	return `grades:${targetId}:${rubricId}`;
}

// One rubric's grade completion across grade targets.
export function gradeCompletionForRubricCacheTag(rubricId: string): string {
	return `grades:rubric:${rubricId}`;
}

export function cacheTags(...tags: string[]): void {
	for (const tag of tags) {
		cacheTag(tag);
	}
}

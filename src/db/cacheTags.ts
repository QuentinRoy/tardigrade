import { cacheTag } from "next/cache";

// This module is the only place that builds cache-tag strings (ADR 0008 rule 1).
// Every accepted scope has a named helper; the vocabulary is closed, so adding a
// tag means adding a helper here, an entry in
// `docs/reference/cache-invalidation-map.md`, and at least one invalidating
// mutation (ADR 0008 rule 2). Never depend on nested tag propagation: a
// `"use cache"` scope registers the full closure of these tags for everything it
// renders (ADR 0008 rule 3).
//
// Grid scoping (ADR 0008 rule 8): every tag below except `gridListCacheTag`
// lives under the `grids:{gridId}:…` namespace, so a mutation in one grid never
// busts another grid's cached reads. Rubric and grade-target public ids are only
// unique within a grid, so an unscoped tag would let two grids share one entry.
//
// One uniform grammar: `grids:{gridId}:<entity>[:<discriminator>:<id>]…`. Any
// user-influenced id (a grade target or rubric public id — authors choose these)
// always sits behind a literal discriminator (`target:`, `rubric:`), so no two
// tag shapes can alias no matter what ids authors pick. This is a structural
// guarantee, not a convention that depends on ids looking like `t-<n>`.

export function gridListCacheTag(): string {
	return "grids";
}

// A single grid's data, keyed by its public Grid ID.
export function gridCacheTag({ gridId }: { gridId: string }): string {
	return `grids:${gridId}`;
}

export function rubricListCacheTag({ gridId }: { gridId: string }): string {
	return `grids:${gridId}:rubrics`;
}

export function gradeTargetListCacheTag({
	gridId,
}: {
	gridId: string;
}): string {
	return `grids:${gridId}:grade-targets`;
}

// The coarse grade aggregate: every grade in the grid. Individual saves
// bust this, and grid-wide grade reads register it.
export function gradeAggregateCacheTag({ gridId }: { gridId: string }): string {
	return `grids:${gridId}:grades`;
}

// The bulk-import aggregate. Imports bust this alongside the coarse aggregate;
// individual saves do not.
export function gradeImportCacheTag({ gridId }: { gridId: string }): string {
	return `grids:${gridId}:grades:all`;
}

// One grade target's grades across all rubrics.
export function gradeForGradeTargetCacheTag({
	gridId,
	targetId,
}: {
	gridId: string;
	targetId: string;
}): string {
	return `grids:${gridId}:grades:target:${targetId}`;
}

// One exact grade-target/rubric grade pair.
export function gradeForGradeTargetRubricCacheTag({
	gridId,
	targetId,
	rubricId,
}: {
	gridId: string;
	targetId: string;
	rubricId: string;
}): string {
	return `grids:${gridId}:grades:target:${targetId}:rubric:${rubricId}`;
}

// One rubric's grade completion across grade targets.
export function gradeCompletionForRubricCacheTag({
	gridId,
	rubricId,
}: {
	gridId: string;
	rubricId: string;
}): string {
	return `grids:${gridId}:grades:rubric:${rubricId}`;
}

export function cacheTags(...tags: string[]): void {
	for (const tag of tags) {
		cacheTag(tag);
	}
}

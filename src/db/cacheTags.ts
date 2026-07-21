import { cacheTag } from "next/cache";

// This module is the only place that builds cache-tag strings (ADR 0008 rule 1).
// Every accepted scope has a named helper; the vocabulary is closed, so adding a
// tag means adding a helper here, an entry in
// `docs/reference/cache-invalidation-map.md`, and at least one invalidating
// mutation (ADR 0008 rule 2). Never depend on nested tag propagation: a
// `"use cache"` scope registers the full closure of these tags for everything it
// renders (ADR 0008 rule 3).
//
// Grid scoping (ADR 0008 rule 8): every tag below except `allGridsTag`
// lives under the `grids:{gridId}:…` namespace, so a mutation in one grid never
// busts another grid's cached reads. Rubric and grade-target public ids are only
// unique within a grid, so an unscoped tag would let two grids share one entry.
//
// One uniform grammar: `grids:{gridId}:<entity>[:<discriminator>:<id>]…`.
// Rubric public ids are author-chosen and always sit behind a literal
// discriminator (`rubric:`); grade-target ids are system-generated and also
// discriminator-delimited (`target:`). This avoids relying on id formatting
// conventions to keep tag shapes distinct.

export function allGridsTag(): string {
	return "grids";
}

// A single grid's data, keyed by its public Grid ID.
export function gridTag({ gridId }: { gridId: string }): string {
	return `grids:${gridId}`;
}

export function allRubricsTag({ gridId }: { gridId: string }): string {
	return `grids:${gridId}:rubrics`;
}

export function allTargetsTag({ gridId }: { gridId: string }): string {
	return `grids:${gridId}:grade-targets`;
}

// The coarse grade aggregate: every grade in the grid. Individual saves
// bust this, and grid-wide grade reads register it.
export function allGradesTag({ gridId }: { gridId: string }): string {
	return `grids:${gridId}:grades`;
}

// One grade target's grades across all rubrics.
export function allTargetGradesTag({
	gridId,
	targetId,
}: {
	gridId: string;
	targetId: string;
}): string {
	return `grids:${gridId}:grades:target:${targetId}`;
}

// One rubric's completion across grade targets.
export function gradeCompletionByRubricTag({
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

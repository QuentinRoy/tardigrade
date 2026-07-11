import { cacheTag } from "next/cache";

// This module is the only place that builds cache-tag strings (ADR 0008 rule 1).
// Every accepted scope has a named helper; the vocabulary is closed, so adding a
// tag means adding a helper here, an entry in
// `docs/reference/cache-invalidation-map.md`, and at least one invalidating
// mutation (ADR 0008 rule 2). Never depend on nested tag propagation: a
// `"use cache"` scope registers the full closure of these tags for everything it
// renders (ADR 0008 rule 3).

// Coarse list tags — one per entity collection.
export function projectListCacheTag(): string {
	return "projects";
}

export function rubricListCacheTag(): string {
	return "rubrics";
}

export function gradeTargetListCacheTag(): string {
	return "grade-targets";
}

// A single project's data, keyed by its public Project ID.
export function projectCacheTag(projectId: string): string {
	return `projects:${projectId}`;
}

// The coarse assessment aggregate: every assessment in scope. Individual saves
// bust this, and project-wide assessment reads register it.
export function assessmentAggregateCacheTag(): string {
	return "assessments";
}

// The bulk-import aggregate. Imports bust this alongside the coarse aggregate;
// individual saves do not.
export function assessmentImportCacheTag(): string {
	return "assessments:all";
}

// One grade target's assessments across all rubrics.
export function assessmentForGradeTargetCacheTag(targetId: string): string {
	return `assessments:${targetId}`;
}

// One exact grade-target/rubric assessment pair.
export function assessmentForGradeTargetRubricCacheTag({
	targetId,
	rubricId,
}: {
	targetId: string;
	rubricId: string;
}): string {
	return `assessments:${targetId}:${rubricId}`;
}

// One rubric's assessment progress across grade targets.
export function assessmentProgressForRubricCacheTag(rubricId: string): string {
	return `assessments:rubric:${rubricId}`;
}

export function cacheTags(...tags: string[]): void {
	for (const tag of tags) {
		cacheTag(tag);
	}
}

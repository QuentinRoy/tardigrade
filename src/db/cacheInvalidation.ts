import { revalidateTag, updateTag } from "next/cache";
import {
	gradeAggregateCacheTag,
	gradeCompletionForRubricCacheTag,
	gradeForGradeTargetCacheTag,
	gradeForGradeTargetRubricCacheTag,
	gradeImportCacheTag,
	gradeTargetListCacheTag,
	gridCacheTag,
	gridListCacheTag,
	rubricListCacheTag,
} from "./cacheTags.ts";

// Semantic cache-invalidation helpers, one per mutation (ADR 0008 rule 6). Each
// mutation calls exactly one of these after its transaction commits; the helper
// picks the invalidation primitive per tag class so call sites never choose
// between `updateTag` and `revalidateTag` themselves.
//
// `updateTag` (read-your-own-writes) expires immediately and blocks the next read
// on fresh data; it is used for the tags of the entity that was just edited, so
// the editor sees its own change. It is only callable from a Server Action.
//
// `revalidateTag` (stale-while-revalidate) serves stale data while refreshing in
// the background; it is used for derived projection tags and coarse aggregate
// tags, so a save never blocks the next navigation on recomputing grid-wide
// completion (plan Decision 3, Finding 19). `revalidateTag` throws outside request
// scope; every helper here runs from a Server Action or import action.

// `revalidateTag` requires a cache profile; "max" bounds the background refresh
// only by the tag's own `cacheLife`. Wrapped so every call shares the profile.
function revalidate(tag: string): void {
	revalidateTag(tag, "max");
}

// Interactive single-grade save. Read-your-own-writes for the exact pair and
// the grade target's grades (the grader must see the value just saved);
// stale-while-revalidate for the coarse aggregate and the rubric completion
// projection, so navigating to the next grade target never blocks on recomputing
// grid-wide completion.
export function invalidateGradeSave({
	targetId,
	rubricId,
}: {
	targetId: string;
	rubricId: string;
}): void {
	updateTag(gradeForGradeTargetRubricCacheTag({ targetId, rubricId }));
	updateTag(gradeForGradeTargetCacheTag(targetId));
	revalidate(gradeAggregateCacheTag());
	revalidate(gradeCompletionForRubricCacheTag(rubricId));
}

// Interactive rubric-definition save. Read-your-own-writes for the rubric
// list (the author must see the edited definition); stale-while-revalidate for the
// grade aggregates and the rubric completion projection. When the rubric's
// public id changed, the previous id's completion projection is refreshed too.
export function invalidateRubricDefinitionSave({
	rubricId,
	previousRubricId,
}: {
	rubricId: string;
	previousRubricId?: string | undefined;
}): void {
	updateTag(rubricListCacheTag());
	revalidate(gradeAggregateCacheTag());
	revalidate(gradeImportCacheTag());
	revalidate(gradeCompletionForRubricCacheTag(rubricId));
	if (previousRubricId != null && previousRubricId !== rubricId) {
		revalidate(gradeCompletionForRubricCacheTag(previousRubricId));
	}
}

// Interactive rubric-definition delete. Read-your-own-writes for the rubric
// list (the author must see the deletion); stale-while-revalidate for the
// grade aggregates and the rubric completion projection.
export function invalidateRubricDefinitionDelete({
	rubricId,
}: {
	rubricId: string;
}): void {
	updateTag(rubricListCacheTag());
	revalidate(gradeAggregateCacheTag());
	revalidate(gradeImportCacheTag());
	revalidate(gradeCompletionForRubricCacheTag(rubricId));
}

// Interactive rubric reorder. Read-your-own-writes for the rubric list so the
// author sees the new order immediately.
export function invalidateRubricReorder(): void {
	updateTag(rubricListCacheTag());
}

// Grid creation. Stale-while-revalidate for the grid list and the new
// grid's own tag; the redirect to the grid page tolerates a background
// refresh.
export function invalidateGridCreate({ gridId }: { gridId: string }): void {
	revalidate(gridListCacheTag());
	revalidate(gridCacheTag(gridId));
}

// Bulk grade import. Imports land the user on a freshly rendered page, so no
// tag needs read-your-own-writes; every tag uses stale-while-revalidate.
export function invalidateGradeImport(): void {
	revalidate(gradeAggregateCacheTag());
	revalidate(gradeImportCacheTag());
}

// Bulk rubric import. Stale-while-revalidate for the rubric list and the
// grade aggregates the imported rubrics affect.
export function invalidateRubricImport(): void {
	revalidate(rubricListCacheTag());
	revalidate(gradeAggregateCacheTag());
	revalidate(gradeImportCacheTag());
}

// Bulk student (roster) import. Stale-while-revalidate for the grade-target list
// and the grade aggregates the new roster affects.
export function invalidateStudentImport(): void {
	revalidate(gradeTargetListCacheTag());
	revalidate(gradeAggregateCacheTag());
	revalidate(gradeImportCacheTag());
}

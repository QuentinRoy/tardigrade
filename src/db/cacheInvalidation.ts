import { revalidateTag, updateTag } from "next/cache";
import {
	allGradesTag,
	allGridsTag,
	allRubricsTag,
	allTargetGradesTag,
	allTargetsTag,
	gradeCompletionByRubricTag,
	gridTag,
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

// Interactive single-grade save. Read-your-own-writes for the grade target's
// grades (the grader must see the value just saved); stale-while-revalidate
// for the coarse aggregate and the rubric completion projection, so navigating
// to the next grade target never blocks on recomputing grid-wide completion.
export function invalidateGradeSave({
	gridId,
	targetId,
	rubricId,
}: {
	gridId: string;
	targetId: string;
	rubricId: string;
}): void {
	updateTag(allTargetGradesTag({ gridId, targetId }));
	revalidate(allGradesTag({ gridId }));
	revalidate(gradeCompletionByRubricTag({ gridId, rubricId }));
}

// Interactive rubric-definition save. Read-your-own-writes for the rubric
// list (the author must see the edited definition); stale-while-revalidate for the
// grade aggregates and the rubric completion projection. When the rubric's
// public id changed, the previous id's completion projection is refreshed too.
export function invalidateRubricDefinitionSave({
	gridId,
	rubricId,
	previousRubricId,
}: {
	gridId: string;
	rubricId: string;
	previousRubricId?: string | undefined;
}): void {
	updateTag(allRubricsTag({ gridId }));
	revalidate(allGradesTag({ gridId }));
	revalidate(gradeCompletionByRubricTag({ gridId, rubricId }));
	if (previousRubricId != null && previousRubricId !== rubricId) {
		revalidate(
			gradeCompletionByRubricTag({ gridId, rubricId: previousRubricId }),
		);
	}
}

// Interactive rubric-definition delete. Read-your-own-writes for the rubric
// list (the author must see the deletion); stale-while-revalidate for the
// grade aggregates and the rubric completion projection.
export function invalidateRubricDefinitionDelete({
	gridId,
	rubricId,
}: {
	gridId: string;
	rubricId: string;
}): void {
	updateTag(allRubricsTag({ gridId }));
	revalidate(allGradesTag({ gridId }));
	revalidate(gradeCompletionByRubricTag({ gridId, rubricId }));
}

// Interactive rubric reorder. Read-your-own-writes for the rubric list so the
// author sees the new order immediately.
export function invalidateRubricReorder({ gridId }: { gridId: string }): void {
	updateTag(allRubricsTag({ gridId }));
}

// Grid creation. Stale-while-revalidate for the grid list and the new
// grid's own tag; the redirect to the grid page tolerates a background
// refresh.
export function invalidateGridCreate({ gridId }: { gridId: string }): void {
	revalidate(allGridsTag());
	revalidate(gridTag({ gridId }));
}

// Bulk grade import. Imports land the user on a freshly rendered page, so no
// tag needs read-your-own-writes; every tag uses stale-while-revalidate.
export function invalidateGradeImport({ gridId }: { gridId: string }): void {
	revalidate(allGradesTag({ gridId }));
}

// Bulk rubric import. Stale-while-revalidate for the rubric list and the
// grade aggregates the imported rubrics affect.
export function invalidateRubricImport({ gridId }: { gridId: string }): void {
	revalidate(allRubricsTag({ gridId }));
	revalidate(allGradesTag({ gridId }));
}

// Bulk student (roster) import. Stale-while-revalidate for the grade-target list
// and the grade aggregates the new roster affects.
export function invalidateStudentImport({ gridId }: { gridId: string }): void {
	revalidate(allTargetsTag({ gridId }));
	revalidate(allGradesTag({ gridId }));
}

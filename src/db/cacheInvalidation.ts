import { revalidateTag, updateTag } from "next/cache";
import {
	assessmentAggregateCacheTag,
	assessmentForGradeTargetCacheTag,
	assessmentForGradeTargetRubricCacheTag,
	assessmentImportCacheTag,
	assessmentProgressForRubricCacheTag,
	gradeTargetListCacheTag,
	projectCacheTag,
	projectListCacheTag,
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
// tags, so a save never blocks the next navigation on recomputing project-wide
// completion (plan Decision 3, Finding 19). `revalidateTag` throws outside request
// scope; every helper here runs from a Server Action or import action.

// `revalidateTag` requires a cache profile; "max" bounds the background refresh
// only by the tag's own `cacheLife`. Wrapped so every call shares the profile.
function revalidate(tag: string): void {
	revalidateTag(tag, "max");
}

// Interactive single-assessment save. Read-your-own-writes for the exact pair and
// the grade target's assessments (the grader must see the value just saved);
// stale-while-revalidate for the coarse aggregate and the rubric progress
// projection, so navigating to the next grade target never blocks on recomputing
// project-wide completion.
export function invalidateAssessmentSave({
	targetId,
	rubricId,
}: {
	targetId: string;
	rubricId: string;
}): void {
	updateTag(assessmentForGradeTargetRubricCacheTag({ targetId, rubricId }));
	updateTag(assessmentForGradeTargetCacheTag(targetId));
	revalidate(assessmentAggregateCacheTag());
	revalidate(assessmentProgressForRubricCacheTag(rubricId));
}

// Interactive rubric-definition save. Read-your-own-writes for the rubric
// list (the author must see the edited definition); stale-while-revalidate for the
// assessment aggregates and the rubric progress projection. When the rubric's
// public id changed, the previous id's progress projection is refreshed too.
export function invalidateRubricDefinitionSave({
	rubricId,
	previousRubricId,
}: {
	rubricId: string;
	previousRubricId?: string | undefined;
}): void {
	updateTag(rubricListCacheTag());
	revalidate(assessmentAggregateCacheTag());
	revalidate(assessmentImportCacheTag());
	revalidate(assessmentProgressForRubricCacheTag(rubricId));
	if (previousRubricId != null && previousRubricId !== rubricId) {
		revalidate(assessmentProgressForRubricCacheTag(previousRubricId));
	}
}

// Interactive rubric-definition delete. Read-your-own-writes for the rubric
// list (the author must see the deletion); stale-while-revalidate for the
// assessment aggregates and the rubric progress projection.
export function invalidateRubricDefinitionDelete({
	rubricId,
}: {
	rubricId: string;
}): void {
	updateTag(rubricListCacheTag());
	revalidate(assessmentAggregateCacheTag());
	revalidate(assessmentImportCacheTag());
	revalidate(assessmentProgressForRubricCacheTag(rubricId));
}

// Interactive rubric reorder. Read-your-own-writes for the rubric list so the
// author sees the new order immediately.
export function invalidateRubricReorder(): void {
	updateTag(rubricListCacheTag());
}

// Project creation. Stale-while-revalidate for the project list and the new
// project's own tag; the redirect to the project page tolerates a background
// refresh.
export function invalidateProjectCreate({
	projectId,
}: {
	projectId: string;
}): void {
	revalidate(projectListCacheTag());
	revalidate(projectCacheTag(projectId));
}

// Bulk assessment import. Imports land the user on a freshly rendered page, so no
// tag needs read-your-own-writes; every tag uses stale-while-revalidate.
export function invalidateAssessmentImport(): void {
	revalidate(assessmentAggregateCacheTag());
	revalidate(assessmentImportCacheTag());
}

// Bulk rubric import. Stale-while-revalidate for the rubric list and the
// assessment aggregates the imported rubrics affect.
export function invalidateRubricImport(): void {
	revalidate(rubricListCacheTag());
	revalidate(assessmentAggregateCacheTag());
	revalidate(assessmentImportCacheTag());
}

// Bulk student (roster) import. Stale-while-revalidate for the grade-target list
// and the assessment aggregates the new roster affects.
export function invalidateStudentImport(): void {
	revalidate(gradeTargetListCacheTag());
	revalidate(assessmentAggregateCacheTag());
	revalidate(assessmentImportCacheTag());
}

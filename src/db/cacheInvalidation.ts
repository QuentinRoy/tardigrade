import { revalidateTag, updateTag } from "next/cache";
import {
	assessmentAggregateCacheTag,
	assessmentForSubmissionCacheTag,
	assessmentForSubmissionQuestionCacheTag,
	assessmentImportCacheTag,
	assessmentProgressForQuestionCacheTag,
	projectCacheTag,
	projectListCacheTag,
	questionListCacheTag,
	submissionListCacheTag,
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
// the submission's assessments (the grader must see the value just saved);
// stale-while-revalidate for the coarse aggregate and the question progress
// projection, so navigating to the next submission never blocks on recomputing
// project-wide completion.
export function invalidateAssessmentSave({
	submissionId,
	questionId,
}: {
	submissionId: string;
	questionId: string;
}): void {
	updateTag(
		assessmentForSubmissionQuestionCacheTag({ submissionId, questionId }),
	);
	updateTag(assessmentForSubmissionCacheTag(submissionId));
	revalidate(assessmentAggregateCacheTag());
	revalidate(assessmentProgressForQuestionCacheTag(questionId));
}

// Interactive question-definition save. Read-your-own-writes for the question
// list (the author must see the edited definition); stale-while-revalidate for the
// assessment aggregates and the question progress projection. When the question's
// public id changed, the previous id's progress projection is refreshed too.
export function invalidateQuestionDefinitionSave({
	questionId,
	previousQuestionId,
}: {
	questionId: string;
	previousQuestionId?: string | undefined;
}): void {
	updateTag(questionListCacheTag());
	revalidate(assessmentAggregateCacheTag());
	revalidate(assessmentImportCacheTag());
	revalidate(assessmentProgressForQuestionCacheTag(questionId));
	if (previousQuestionId != null && previousQuestionId !== questionId) {
		revalidate(assessmentProgressForQuestionCacheTag(previousQuestionId));
	}
}

// Interactive question-definition delete. Read-your-own-writes for the question
// list (the author must see the deletion); stale-while-revalidate for the
// assessment aggregates and the question progress projection.
export function invalidateQuestionDefinitionDelete({
	questionId,
}: {
	questionId: string;
}): void {
	updateTag(questionListCacheTag());
	revalidate(assessmentAggregateCacheTag());
	revalidate(assessmentImportCacheTag());
	revalidate(assessmentProgressForQuestionCacheTag(questionId));
}

// Interactive question reorder. Read-your-own-writes for the question list so the
// author sees the new order immediately.
export function invalidateQuestionReorder(): void {
	updateTag(questionListCacheTag());
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

// Bulk question import. Stale-while-revalidate for the question list and the
// assessment aggregates the imported questions affect.
export function invalidateQuestionImport(): void {
	revalidate(questionListCacheTag());
	revalidate(assessmentAggregateCacheTag());
	revalidate(assessmentImportCacheTag());
}

// Bulk student (roster) import. Stale-while-revalidate for the submission list and
// the assessment aggregates the new roster affects.
export function invalidateStudentImport(): void {
	revalidate(submissionListCacheTag());
	revalidate(assessmentAggregateCacheTag());
	revalidate(assessmentImportCacheTag());
}

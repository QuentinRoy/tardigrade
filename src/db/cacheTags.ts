import { cacheTag, updateTag } from "next/cache";

export const CACHE_TAGS = {
	projects: "projects",
	questions: "questions",
	submissions: "submissions",
	assessments: "assessments",
	assessmentsAll: "assessments:all",
} as const;

export function projectCacheTag(projectPublicId: string): string {
	return `${CACHE_TAGS.projects}:${projectPublicId}`;
}

// Tags nest from coarse to granular so a write can bust the exact scope it
// touched: every assessment, one submission, or one submission/question pair.
// Omitting submissionId is the only way to get the coarse tag, so questionId
// cannot be passed without it.
type AssessmentCacheScope =
	| { submissionId: string; questionId?: string | undefined }
	| { submissionId?: undefined; questionId?: undefined };

export function assessmentCacheTag(scope: AssessmentCacheScope = {}): string {
	if (scope.submissionId == null) {
		return CACHE_TAGS.assessments;
	}
	if (scope.questionId == null) {
		return `${CACHE_TAGS.assessments}:${scope.submissionId}`;
	}
	return `${CACHE_TAGS.assessments}:${scope.submissionId}:${scope.questionId}`;
}

export function assessmentQuestionCacheTag(questionId: string): string {
	return `assessments:question:${questionId}`;
}

export function cacheTags(...tags: string[]): void {
	for (const tag of tags) {
		cacheTag(tag);
	}
}

export function updateTags(...tags: string[]): void {
	for (const tag of tags) {
		updateTag(tag);
	}
}

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

export function assessmentCacheTag(
	submissionId: string,
	questionId: string,
): string {
	return `assessments:${submissionId}:${questionId}`;
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

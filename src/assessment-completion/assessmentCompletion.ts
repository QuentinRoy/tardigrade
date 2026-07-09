export type CompletionMetric = { completed: number; total: number };

export type AssessmentCompletionInput = {
	submissionIds: string[];
	rubrics: Array<{ id: string; criterionCount: number }>;
	assessmentCounts: Array<{
		submissionId: string;
		rubricId: string;
		assessmentCount: number;
	}>;
};

export type AssessmentCompletion = {
	totalSubmissions: number;
	totalRubrics: number;
	completedRubricCountBySubmissionId: Map<string, number>;
	completedSubmissionCountByRubricId: Map<string, number>;
	completedSubmissions: number;
	completedRubrics: number;
};

export function buildAssessmentCompletion({
	submissionIds,
	rubrics,
	assessmentCounts,
}: AssessmentCompletionInput): AssessmentCompletion {
	const totalSubmissions = submissionIds.length;
	const totalRubrics = rubrics.length;

	const assessmentCountByKey = new Map<string, number>(
		assessmentCounts.map(({ submissionId, rubricId, assessmentCount }) => [
			`${submissionId}:${rubricId}`,
			assessmentCount,
		]),
	);

	const completedRubricCountBySubmissionId = new Map<string, number>();
	const completedSubmissionCountByRubricId = new Map<string, number>(
		rubrics.map((rubric) => [rubric.id, 0]),
	);

	for (const submissionId of submissionIds) {
		let completedRubricCount = 0;

		for (const rubric of rubrics) {
			const assessmentCount =
				assessmentCountByKey.get(`${submissionId}:${rubric.id}`) ?? 0;
			const isComplete =
				rubric.criterionCount === 0 || assessmentCount >= rubric.criterionCount;

			if (isComplete) {
				completedRubricCount += 1;
				completedSubmissionCountByRubricId.set(
					rubric.id,
					(completedSubmissionCountByRubricId.get(rubric.id) ?? 0) + 1,
				);
			}
		}

		completedRubricCountBySubmissionId.set(submissionId, completedRubricCount);
	}

	const completedSubmissions =
		totalRubrics === 0
			? totalSubmissions
			: submissionIds.filter(
					(submissionId) =>
						completedRubricCountBySubmissionId.get(submissionId) ===
						totalRubrics,
				).length;

	const completedRubrics =
		totalSubmissions === 0
			? totalRubrics
			: rubrics.filter(
					(rubric) =>
						completedSubmissionCountByRubricId.get(rubric.id) ===
						totalSubmissions,
				).length;

	return {
		totalSubmissions,
		totalRubrics,
		completedRubricCountBySubmissionId,
		completedSubmissionCountByRubricId,
		completedSubmissions,
		completedRubrics,
	};
}

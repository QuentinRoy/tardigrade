export type CompletionMetric = { completed: number; total: number };

export type AssessmentCompletionInput = {
	targetIds: string[];
	rubrics: Array<{ id: string; criterionCount: number }>;
	assessmentCounts: Array<{
		targetId: string;
		rubricId: string;
		assessmentCount: number;
	}>;
};

export type AssessmentCompletion = {
	totalGradeTargets: number;
	totalRubrics: number;
	completedRubricCountByTargetId: Map<string, number>;
	completedGradeTargetCountByRubricId: Map<string, number>;
	completedGradeTargets: number;
	completedRubrics: number;
};

export function buildAssessmentCompletion({
	targetIds,
	rubrics,
	assessmentCounts,
}: AssessmentCompletionInput): AssessmentCompletion {
	const totalGradeTargets = targetIds.length;
	const totalRubrics = rubrics.length;

	const assessmentCountByKey = new Map<string, number>(
		assessmentCounts.map(({ targetId, rubricId, assessmentCount }) => [
			`${targetId}:${rubricId}`,
			assessmentCount,
		]),
	);

	const completedRubricCountByTargetId = new Map<string, number>();
	const completedGradeTargetCountByRubricId = new Map<string, number>(
		rubrics.map((rubric) => [rubric.id, 0]),
	);

	for (const targetId of targetIds) {
		let completedRubricCount = 0;

		for (const rubric of rubrics) {
			const assessmentCount =
				assessmentCountByKey.get(`${targetId}:${rubric.id}`) ?? 0;
			const isComplete =
				rubric.criterionCount === 0 || assessmentCount >= rubric.criterionCount;

			if (isComplete) {
				completedRubricCount += 1;
				completedGradeTargetCountByRubricId.set(
					rubric.id,
					(completedGradeTargetCountByRubricId.get(rubric.id) ?? 0) + 1,
				);
			}
		}

		completedRubricCountByTargetId.set(targetId, completedRubricCount);
	}

	const completedGradeTargets =
		totalRubrics === 0
			? totalGradeTargets
			: targetIds.filter(
					(targetId) =>
						completedRubricCountByTargetId.get(targetId) === totalRubrics,
				).length;

	const completedRubrics =
		totalGradeTargets === 0
			? totalRubrics
			: rubrics.filter(
					(rubric) =>
						completedGradeTargetCountByRubricId.get(rubric.id) ===
						totalGradeTargets,
				).length;

	return {
		totalGradeTargets,
		totalRubrics,
		completedRubricCountByTargetId,
		completedGradeTargetCountByRubricId,
		completedGradeTargets,
		completedRubrics,
	};
}

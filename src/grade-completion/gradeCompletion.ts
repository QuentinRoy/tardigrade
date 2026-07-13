export type CompletionMetric = { completed: number; total: number };

export type GradeCompletionInput = {
	targetIds: string[];
	rubrics: Array<{ id: string; criterionCount: number }>;
	gradeCounts: Array<{
		targetId: string;
		rubricId: string;
		gradeCount: number;
	}>;
};

export type GradeCompletion = {
	totalGradeTargets: number;
	totalRubrics: number;
	completedRubricCountByTargetId: Map<string, number>;
	completedGradeTargetCountByRubricId: Map<string, number>;
	completedGradeTargets: number;
	completedRubrics: number;
};

export function buildGradeCompletion({
	targetIds,
	rubrics,
	gradeCounts,
}: GradeCompletionInput): GradeCompletion {
	const totalGradeTargets = targetIds.length;
	const totalRubrics = rubrics.length;

	const gradeCountByKey = new Map<string, number>(
		gradeCounts.map(({ targetId, rubricId, gradeCount }) => [
			`${targetId}:${rubricId}`,
			gradeCount,
		]),
	);

	const completedRubricCountByTargetId = new Map<string, number>();
	const completedGradeTargetCountByRubricId = new Map<string, number>(
		rubrics.map((rubric) => [rubric.id, 0]),
	);

	for (const targetId of targetIds) {
		let completedRubricCount = 0;

		for (const rubric of rubrics) {
			const gradeCount = gradeCountByKey.get(`${targetId}:${rubric.id}`) ?? 0;
			const isComplete =
				rubric.criterionCount === 0 || gradeCount >= rubric.criterionCount;

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

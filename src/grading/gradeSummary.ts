import { getCriterionMaxMarks, markCriterion } from "#criteria/criterion.ts";
import type { GradedCriterion } from "#criteria/types.ts";

export type GradeSummary = {
	marks: number;
	maxMarks: number;
	completedCriteria: number;
	totalCriteria: number;
	completedRubrics?: number;
	totalRubrics?: number;
};

function accumulateCriterionMarks(
	summary: { marks: number; maxMarks: number },
	criterion: GradedCriterion,
) {
	if (criterion.grade == null) {
		return;
	}

	const criterionMarks = getCriterionMaxMarks(criterion);
	summary.maxMarks += criterionMarks;
	summary.marks += markCriterion(criterion);
}

export function summarizeCriteria(criteria: GradedCriterion[]): GradeSummary {
	const summary = {
		marks: 0,
		maxMarks: 0,
		completedCriteria: 0,
		totalCriteria: 0,
	};

	criteria.forEach((criterion) => {
		summary.totalCriteria += 1;
		if (criterion.grade != null) {
			summary.completedCriteria += 1;
		}
		accumulateCriterionMarks(summary, criterion);
	});

	return summary;
}

export function summarizeRubricSections(
	rubrics: Array<{ criteria: GradedCriterion[] }>,
): GradeSummary {
	const summary = {
		marks: 0,
		maxMarks: 0,
		completedCriteria: 0,
		totalCriteria: 0,
		completedRubrics: 0,
	};

	rubrics.forEach((rubric) => {
		let rubricCriteriaLeft = 0;

		rubric.criteria.forEach((criterion) => {
			summary.totalCriteria += 1;

			if (criterion.grade != null) {
				summary.completedCriteria += 1;
				accumulateCriterionMarks(summary, criterion);
			} else {
				rubricCriteriaLeft += 1;
			}
		});

		if (rubricCriteriaLeft === 0) {
			summary.completedRubrics += 1;
		}
	});

	return { ...summary, totalRubrics: rubrics.length };
}

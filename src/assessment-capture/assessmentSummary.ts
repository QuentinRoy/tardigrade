import { getCriterionMaxMarks, markCriterion } from "#criteria/criterion.ts";
import type { AssessedCriterion } from "#criteria/types.ts";

export type AssessmentSummary = {
	marks: number;
	maxMarks: number;
	completedCriteria: number;
	totalCriteria: number;
	completedQuestions?: number;
	totalQuestions?: number;
};

function accumulateCriterionMarks(
	summary: { marks: number; maxMarks: number },
	criterion: AssessedCriterion,
) {
	if (criterion.assessment == null) {
		return;
	}

	const criterionMarks = getCriterionMaxMarks(criterion);
	summary.maxMarks += criterionMarks;
	summary.marks += markCriterion(criterion);
}

export function summarizeCriteria(
	criteria: AssessedCriterion[],
): AssessmentSummary {
	const summary = {
		marks: 0,
		maxMarks: 0,
		completedCriteria: 0,
		totalCriteria: 0,
	};

	criteria.forEach((criterion) => {
		summary.totalCriteria += 1;
		if (criterion.assessment != null) {
			summary.completedCriteria += 1;
		}
		accumulateCriterionMarks(summary, criterion);
	});

	return summary;
}

export function summarizeQuestionSections(
	questions: Array<{ criteria: AssessedCriterion[] }>,
): AssessmentSummary {
	const summary = {
		marks: 0,
		maxMarks: 0,
		completedCriteria: 0,
		totalCriteria: 0,
		completedQuestions: 0,
	};

	questions.forEach((question) => {
		let questionCriteriaLeft = 0;

		question.criteria.forEach((criterion) => {
			summary.totalCriteria += 1;

			if (criterion.assessment != null) {
				summary.completedCriteria += 1;
				accumulateCriterionMarks(summary, criterion);
			} else {
				questionCriteriaLeft += 1;
			}
		});

		if (questionCriteriaLeft === 0) {
			summary.completedQuestions += 1;
		}
	});

	return { ...summary, totalQuestions: questions.length };
}

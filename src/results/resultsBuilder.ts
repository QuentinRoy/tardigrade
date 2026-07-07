import type { Grid } from "#questions/types.ts";
import {
	attachAssessment,
	getRubricMaxMarks,
	markRubric,
} from "#rubrics/rubric.ts";
import type {
	AssessmentRubricValue,
	Rubric,
	RubricType,
} from "#rubrics/types.ts";
import { getSubmissionLabel } from "#submissions/getSubmissionLabel.ts";
import type { Submission } from "#submissions/types.ts";

type CriterionPropertyDetails =
	| { type: "boolean"; trueMarks: number; falseMarks: number }
	| { type: "ordinal"; marksByLabel: Array<{ label: string; marks: number }> }
	| {
			type: "numerical";
			minScore: number;
			maxScore: number;
			minMarks: number;
			maxMarks: number;
			reversed: boolean;
	  };

export type CriterionDetails = {
	label?: string | undefined;
	description?: string | undefined;
	type: RubricType;
	properties: CriterionPropertyDetails;
};

export type CriterionRow = {
	criterionId: string;
	rubricId: string;
	rubricLabel: string;
	maxMarks: number;
	averageMarks: number | null;
	averagePercent: number | null;
	assessedCount: number;
	totalCount: number;
	completionPercent: number;
	details: CriterionDetails;
};

export type GradeTargetCell = {
	criterionId: string;
	marks: number | null;
	maxMarks: number;
	assessed: boolean;
};

export type GradeTargetRow = {
	gradeTargetId: string;
	label: string;
	marks: number;
	maxMarks: number;
	averagePercent: number | null;
	completedCriteria: number;
	totalCriteria: number;
	criteria: GradeTargetCell[];
};

export type ResultsData = {
	criteria: CriterionRow[];
	gradeTargetRows: GradeTargetRow[];
};

export type ResultsAssessmentRecord = {
	gradeTargetId: number;
	criterionId: string;
	type: RubricType;
	passed: boolean | null;
	selectedLabel: string | null;
	score: number | null;
};

type OrderedCriterion = {
	criterion: Rubric;
	criterionId: string;
	rubricId: string;
	rubricLabel: string;
	maxMarks: number;
};

function toAssessmentValue(
	record: ResultsAssessmentRecord,
): AssessmentRubricValue | null {
	switch (record.type) {
		case "boolean":
			if (record.passed == null) {
				return null;
			}
			return {
				rubricId: record.criterionId,
				type: "boolean",
				passed: record.passed,
			};
		case "ordinal":
			if (record.selectedLabel == null) {
				return null;
			}
			return {
				rubricId: record.criterionId,
				type: "ordinal",
				selectedLabel: record.selectedLabel,
			};
		case "numerical":
			if (record.score == null) {
				return null;
			}
			return {
				rubricId: record.criterionId,
				type: "numerical",
				score: record.score,
			};
		default:
			return null;
	}
}

function toCriterionDetails(rubric: Rubric): CriterionDetails {
	switch (rubric.type) {
		case "boolean":
			return {
				label: rubric.label,
				description: rubric.description,
				type: rubric.type,
				properties: {
					type: "boolean",
					trueMarks: rubric.marks,
					falseMarks: rubric.falseMarks,
				},
			};
		case "ordinal":
			return {
				label: rubric.label,
				description: rubric.description,
				type: rubric.type,
				properties: {
					type: "ordinal",
					marksByLabel: Object.entries(rubric.marks).map(([label, marks]) => ({
						label,
						marks,
					})),
				},
			};
		case "numerical":
			return {
				label: rubric.label,
				description: rubric.description,
				type: rubric.type,
				properties: {
					type: "numerical",
					minScore: rubric.minScore,
					maxScore: rubric.maxScore,
					minMarks: rubric.minMarks,
					maxMarks: rubric.maxMarks,
					reversed: rubric.reversed,
				},
			};
	}
}

export function buildResultsData({
	submissions,
	questionGrid,
	assessmentRecords,
}: {
	submissions: Submission[];
	questionGrid: Grid;
	assessmentRecords: ResultsAssessmentRecord[];
}): ResultsData {
	const orderedCriteria: OrderedCriterion[] = [];

	for (const [questionId, question] of Object.entries(questionGrid)) {
		const questionLabel = question.label ?? questionId;
		for (const rubric of question.rubrics) {
			orderedCriteria.push({
				criterion: rubric,
				criterionId: rubric.id,
				rubricId: questionId,
				rubricLabel: questionLabel,
				maxMarks: getRubricMaxMarks(rubric),
			});
		}
	}

	const criterionById = new Map(
		orderedCriteria.map((entry) => [entry.criterionId, entry]),
	);

	const criterionStats = new Map(
		orderedCriteria.map((entry) => [
			entry.criterionId,
			{ marksSum: 0, assessedCount: 0 },
		]),
	);

	const gradeTargetRowById = new Map(
		submissions.map((submission) => {
			const cells: GradeTargetCell[] = orderedCriteria.map((entry) => ({
				criterionId: entry.criterionId,
				marks: null,
				maxMarks: entry.maxMarks,
				assessed: false,
			}));

			return [
				submission.id,
				{
					gradeTargetId: submission.id,
					label: getSubmissionLabel(submission),
					marks: 0,
					maxMarks: 0,
					averagePercent: null,
					completedCriteria: 0,
					totalCriteria: orderedCriteria.length,
					criteria: cells,
				},
			];
		}),
	);

	const cellIndexByCriterionId = new Map(
		orderedCriteria.map((entry, index) => [entry.criterionId, index]),
	);

	for (const record of assessmentRecords) {
		const criterionMeta = criterionById.get(record.criterionId);
		if (criterionMeta == null) {
			continue;
		}

		const assessmentValue = toAssessmentValue(record);
		if (assessmentValue == null) {
			continue;
		}

		const assessedRubric = attachAssessment(
			criterionMeta.criterion,
			assessmentValue,
		);
		const marks = markRubric(assessedRubric);
		const gradeTargetId = String(record.gradeTargetId);
		const gradeTargetRow = gradeTargetRowById.get(gradeTargetId);
		const criterionStat = criterionStats.get(record.criterionId);
		const cellIndex = cellIndexByCriterionId.get(record.criterionId);

		if (gradeTargetRow == null || criterionStat == null || cellIndex == null) {
			continue;
		}

		const existingCell = gradeTargetRow.criteria[cellIndex];
		if (existingCell == null || existingCell.assessed) {
			continue;
		}

		gradeTargetRow.criteria[cellIndex] = {
			...existingCell,
			marks,
			assessed: true,
		};

		gradeTargetRow.marks += marks;
		gradeTargetRow.maxMarks += criterionMeta.maxMarks;
		gradeTargetRow.completedCriteria += 1;

		criterionStat.assessedCount += 1;
		criterionStat.marksSum += marks;
	}

	const gradeTargetRowsWithAverages = [...gradeTargetRowById.values()].map(
		(row) => ({
			...row,
			averagePercent:
				row.maxMarks > 0 ? (row.marks / row.maxMarks) * 100 : null,
		}),
	);

	const criteria = orderedCriteria.map((entry) => {
		const stats = criterionStats.get(entry.criterionId);
		const assessedCount = stats?.assessedCount ?? 0;
		const averageMarks =
			assessedCount > 0 && stats != null
				? stats.marksSum / assessedCount
				: null;
		const averagePercent =
			averageMarks != null && entry.maxMarks > 0
				? (averageMarks / entry.maxMarks) * 100
				: null;

		return {
			criterionId: entry.criterionId,
			rubricId: entry.rubricId,
			rubricLabel: entry.rubricLabel,
			maxMarks: entry.maxMarks,
			averageMarks,
			averagePercent,
			assessedCount,
			totalCount: submissions.length,
			completionPercent:
				submissions.length > 0 ? (assessedCount / submissions.length) * 100 : 0,
			details: toCriterionDetails(entry.criterion),
		};
	});

	return { criteria, gradeTargetRows: gradeTargetRowsWithAverages };
}

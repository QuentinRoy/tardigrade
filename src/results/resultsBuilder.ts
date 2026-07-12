import {
	attachAssessment,
	getCriterionMaxMarks,
	markCriterion,
} from "#criteria/criterion.ts";
import type {
	AssessmentCriterionValue,
	Criterion,
	CriterionKind,
} from "#criteria/types.ts";
import { getGradeTargetLabel } from "#grade-targets/getGradeTargetLabel.ts";
import type { GradeTarget } from "#grade-targets/types.ts";
import type { RubricsById } from "#rubrics/types.ts";

type CriterionPropertyDetails =
	| { kind: "check"; trueMarks: number; falseMarks: number }
	| { kind: "options"; marksByLabel: Array<{ label: string; marks: number }> }
	| {
			kind: "number";
			minScore: number;
			maxScore: number;
			minMarks: number;
			maxMarks: number;
			reversed: boolean;
	  };

export type CriterionDetails = {
	label?: string | undefined;
	description?: string | undefined;
	kind: CriterionKind;
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
	gradeTargetId: string;
	criterionId: string;
	kind: CriterionKind;
	passed: boolean | null;
	selectedLabel: string | null;
	score: number | null;
};

type OrderedCriterion = {
	criterion: Criterion;
	criterionId: string;
	rubricId: string;
	rubricLabel: string;
	maxMarks: number;
};

function toAssessmentValue(
	record: ResultsAssessmentRecord,
): AssessmentCriterionValue | null {
	switch (record.kind) {
		case "check":
			if (record.passed == null) {
				return null;
			}
			return {
				criterionId: record.criterionId,
				kind: "check",
				passed: record.passed,
			};
		case "options":
			if (record.selectedLabel == null) {
				return null;
			}
			return {
				criterionId: record.criterionId,
				kind: "options",
				selectedLabel: record.selectedLabel,
			};
		case "number":
			if (record.score == null) {
				return null;
			}
			return {
				criterionId: record.criterionId,
				kind: "number",
				score: record.score,
			};
		default:
			return null;
	}
}

function toCriterionDetails(criterion: Criterion): CriterionDetails {
	switch (criterion.kind) {
		case "check":
			return {
				label: criterion.label,
				description: criterion.description,
				kind: criterion.kind,
				properties: {
					kind: "check",
					trueMarks: criterion.marks,
					falseMarks: criterion.falseMarks,
				},
			};
		case "options":
			return {
				label: criterion.label,
				description: criterion.description,
				kind: criterion.kind,
				properties: {
					kind: "options",
					marksByLabel: Object.entries(criterion.marks).map(
						([label, marks]) => ({ label, marks }),
					),
				},
			};
		case "number":
			return {
				label: criterion.label,
				description: criterion.description,
				kind: criterion.kind,
				properties: {
					kind: "number",
					minScore: criterion.minScore,
					maxScore: criterion.maxScore,
					minMarks: criterion.minMarks,
					maxMarks: criterion.maxMarks,
					reversed: criterion.reversed,
				},
			};
	}
}

export function buildResultsData({
	targets,
	rubricsById,
	assessmentRecords,
}: {
	targets: GradeTarget[];
	rubricsById: RubricsById;
	assessmentRecords: ResultsAssessmentRecord[];
}): ResultsData {
	const orderedCriteria: OrderedCriterion[] = [];

	for (const [rubricId, rubric] of Object.entries(rubricsById)) {
		const rubricLabel = rubric.label ?? rubricId;
		for (const criterion of rubric.criteria) {
			orderedCriteria.push({
				criterion,
				criterionId: criterion.id,
				rubricId: rubricId,
				rubricLabel: rubricLabel,
				maxMarks: getCriterionMaxMarks(criterion),
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
		targets.map((target) => {
			const cells: GradeTargetCell[] = orderedCriteria.map((entry) => ({
				criterionId: entry.criterionId,
				marks: null,
				maxMarks: entry.maxMarks,
				assessed: false,
			}));

			return [
				target.id,
				{
					gradeTargetId: target.id,
					label: getGradeTargetLabel(target),
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

		const assessedCriterion = attachAssessment(
			criterionMeta.criterion,
			assessmentValue,
		);
		const marks = markCriterion(assessedCriterion);
		const gradeTargetRow = gradeTargetRowById.get(record.gradeTargetId);
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
			totalCount: targets.length,
			completionPercent:
				targets.length > 0 ? (assessedCount / targets.length) * 100 : 0,
			details: toCriterionDetails(entry.criterion),
		};
	});

	return { criteria, gradeTargetRows: gradeTargetRowsWithAverages };
}

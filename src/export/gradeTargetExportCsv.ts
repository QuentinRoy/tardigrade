import type { Criterion } from "#criteria/types.ts";
import type { GradeTargetSubmitter } from "#grade-targets/types.ts";

export type ExportOptions = {
	includeCriterionGrade: boolean;
	includeCriterionMarks: boolean;
};

type CriterionOfKind<TKind extends Criterion["kind"]> = Extract<
	Criterion,
	{ kind: TKind }
>;

type ExportCheckCriterionPlan = Pick<
	CriterionOfKind<"check">,
	"id" | "kind" | "marks" | "falseMarks"
>;

type ExportOptionsCriterionPlan = Pick<
	CriterionOfKind<"options">,
	"id" | "kind" | "marks"
>;

type ExportNumberCriterionPlan = Pick<
	CriterionOfKind<"number">,
	"id" | "kind" | "minScore" | "maxScore" | "minMarks" | "maxMarks" | "reversed"
>;

export type ExportCriterionPlan =
	| ExportCheckCriterionPlan
	| ExportOptionsCriterionPlan
	| ExportNumberCriterionPlan;

export type ExportRubricPlan = { id: string; criteria: ExportCriterionPlan[] };

export type GradeTargetExportGradeValue = string | number | boolean;

export type GradeTargetExportCriterionData = {
	criterionId: string;
	grade?: GradeTargetExportGradeValue;
	marks?: number;
};

export type GradeTargetExportRubricData = {
	rubricId: string;
	criteria: GradeTargetExportCriterionData[];
};

export type GradeTargetExportDataRow = {
	target: GradeTargetSubmitter;
	rubrics: GradeTargetExportRubricData[];
};

export type GradeTargetExportValue =
	| string
	| number
	| boolean
	| null
	| undefined;

export type GradeTargetExportRecord = {
	[columnName: string]: GradeTargetExportValue;
};

export function buildGradeKey(rubricId: string, criterionId: string): string {
	return `${rubricId}::${criterionId}`;
}

export function getGradeTargetExportIdentifier(
	target: GradeTargetSubmitter,
): string {
	if (target.kind === "group") {
		if (target.groupName == null || target.groupName.length === 0) {
			throw new Error(
				`Grade target ${target.id} has kind group but no group is linked.`,
			);
		}
		return target.groupName;
	}

	if (target.studentId == null || target.studentId.length === 0) {
		throw new Error(
			`Grade target ${target.id} has kind individual but no student is linked.`,
		);
	}

	return target.studentId;
}

const COLUMN_PART_SEPARATOR = ":";

function getCriterionKey(rubricId: string, criterionId: string): string {
	return `${rubricId}${COLUMN_PART_SEPARATOR}${criterionId}`;
}

function getGradeColumnName(rubricId: string, criterionId: string): string {
	return `${getCriterionKey(rubricId, criterionId)}`;
}

function getMarksColumnName(rubricId: string, criterionId: string): string {
	return `${getCriterionKey(rubricId, criterionId)}${COLUMN_PART_SEPARATOR}marks`;
}

function getRubricTotalColumnName(rubricId: string): string {
	return `${rubricId}${COLUMN_PART_SEPARATOR}total`;
}

export function buildGradeTargetExportHeaders(
	rubrics: ExportRubricPlan[],
	options: ExportOptions,
): string[] {
	const headers = ["kind", "name"];

	for (const rubric of rubrics) {
		for (const criterion of rubric.criteria) {
			if (options.includeCriterionGrade) {
				headers.push(getGradeColumnName(rubric.id, criterion.id));
			}
			if (options.includeCriterionMarks) {
				headers.push(getMarksColumnName(rubric.id, criterion.id));
			}
		}

		headers.push(getRubricTotalColumnName(rubric.id));
	}

	headers.push("final_total");
	return headers;
}

export function buildGradeTargetExportRecord(params: {
	row: GradeTargetExportDataRow;
	options: ExportOptions;
}): GradeTargetExportRecord {
	const {
		row: { target, rubrics },
		options,
	} = params;
	const row: GradeTargetExportRecord = {
		kind: target.kind,
		name: getGradeTargetExportIdentifier(target),
	};

	let finalTotal = 0;
	let hasMissingGrade = false;

	for (const rubric of rubrics) {
		let rubricTotalMarks = 0;
		let isRubricFullyGraded = true;

		for (const criterion of rubric.criteria) {
			if (criterion.grade == null) {
				isRubricFullyGraded = false;
			}

			if (options.includeCriterionGrade) {
				const gradeValue = criterion.grade;
				if (gradeValue != null) {
					row[getGradeColumnName(rubric.rubricId, criterion.criterionId)] =
						gradeValue;
				}
			}

			if (options.includeCriterionMarks) {
				if (criterion.marks != null) {
					row[getMarksColumnName(rubric.rubricId, criterion.criterionId)] =
						criterion.marks;
				}
			}

			if (criterion.marks != null) {
				rubricTotalMarks += criterion.marks;
			}
		}

		if (isRubricFullyGraded) {
			finalTotal += rubricTotalMarks;
			row[getRubricTotalColumnName(rubric.rubricId)] = rubricTotalMarks;
			continue;
		}

		hasMissingGrade = true;
	}

	if (!hasMissingGrade) {
		row["final_total"] = finalTotal;
	}

	return row;
}

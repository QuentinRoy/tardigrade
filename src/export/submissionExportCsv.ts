import type { Criterion } from "#criteria/types.ts";
import type { SubmissionSubmitter } from "#submissions/types.ts";

export type ExportOptions = {
	includeCriterionAssessment: boolean;
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

export type SubmissionExportAssessmentValue = string | number | boolean;

export type SubmissionExportCriterionData = {
	criterionId: string;
	assessment?: SubmissionExportAssessmentValue;
	marks?: number;
};

export type SubmissionExportRubricData = {
	rubricId: string;
	criteria: SubmissionExportCriterionData[];
};

export type SubmissionExportDataRow = {
	submission: SubmissionSubmitter;
	rubrics: SubmissionExportRubricData[];
};

export type SubmissionExportValue =
	| string
	| number
	| boolean
	| null
	| undefined;

export type SubmissionExportRecord = {
	[columnName: string]: SubmissionExportValue;
};

export function buildAssessmentKey(
	rubricId: string,
	criterionId: string,
): string {
	return `${rubricId}::${criterionId}`;
}

export function getSubmissionExportIdentifier(
	submission: SubmissionSubmitter,
): string {
	if (submission.type === "team") {
		if (submission.teamName == null || submission.teamName.length === 0) {
			throw new Error(
				`Submission ${submission.id} has type team but no team is linked.`,
			);
		}
		return submission.teamName;
	}

	if (submission.studentId == null || submission.studentId.length === 0) {
		throw new Error(
			`Submission ${submission.id} has type individual but no student is linked.`,
		);
	}

	return submission.studentId;
}

const COLUMN_PART_SEPARATOR = ":";

function getCriterionKey(rubricId: string, criterionId: string): string {
	return `${rubricId}${COLUMN_PART_SEPARATOR}${criterionId}`;
}

function getAssessmentColumnName(
	rubricId: string,
	criterionId: string,
): string {
	return `${getCriterionKey(rubricId, criterionId)}`;
}

function getMarksColumnName(rubricId: string, criterionId: string): string {
	return `${getCriterionKey(rubricId, criterionId)}${COLUMN_PART_SEPARATOR}marks`;
}

export function buildSubmissionExportHeaders(
	rubrics: ExportRubricPlan[],
	options: ExportOptions,
): string[] {
	const headers = ["submission_type", "submitter"];

	for (const rubric of rubrics) {
		for (const criterion of rubric.criteria) {
			if (options.includeCriterionAssessment) {
				headers.push(getAssessmentColumnName(rubric.id, criterion.id));
			}
			if (options.includeCriterionMarks) {
				headers.push(getMarksColumnName(rubric.id, criterion.id));
			}
		}

		headers.push(rubric.id);
	}

	headers.push("grand_total_marks");
	return headers;
}

export function buildSubmissionExportRecord(params: {
	row: SubmissionExportDataRow;
	options: ExportOptions;
}): SubmissionExportRecord {
	const {
		row: { submission, rubrics },
		options,
	} = params;
	const row: SubmissionExportRecord = {
		submission_type: submission.type,
		submitter: getSubmissionExportIdentifier(submission),
	};

	let grandTotalMarks = 0;
	let hasMissingAssessment = false;

	for (const rubric of rubrics) {
		let rubricTotalMarks = 0;
		let isRubricFullyAssessed = true;

		for (const criterion of rubric.criteria) {
			if (criterion.assessment == null) {
				isRubricFullyAssessed = false;
			}

			if (options.includeCriterionAssessment) {
				const assessmentValue = criterion.assessment;
				if (assessmentValue != null) {
					row[getAssessmentColumnName(rubric.rubricId, criterion.criterionId)] =
						assessmentValue;
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

		if (isRubricFullyAssessed) {
			grandTotalMarks += rubricTotalMarks;
			row[rubric.rubricId] = rubricTotalMarks;
			continue;
		}

		hasMissingAssessment = true;
	}

	if (!hasMissingAssessment) {
		row["grand_total_marks"] = grandTotalMarks;
	}

	return row;
}

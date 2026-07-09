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

export type ExportQuestionPlan = {
	id: string;
	criteria: ExportCriterionPlan[];
};

export type SubmissionExportAssessmentValue = string | number | boolean;

export type SubmissionExportCriterionData = {
	criterionId: string;
	assessment?: SubmissionExportAssessmentValue;
	marks?: number;
};

export type SubmissionExportQuestionData = {
	questionId: string;
	criteria: SubmissionExportCriterionData[];
};

export type SubmissionExportDataRow = {
	submission: SubmissionSubmitter;
	questions: SubmissionExportQuestionData[];
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
	questionId: string,
	criterionId: string,
): string {
	return `${questionId}::${criterionId}`;
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

function getCriterionKey(questionId: string, criterionId: string): string {
	return `${questionId}${COLUMN_PART_SEPARATOR}${criterionId}`;
}

function getAssessmentColumnName(
	questionId: string,
	criterionId: string,
): string {
	return `${getCriterionKey(questionId, criterionId)}`;
}

function getMarksColumnName(questionId: string, criterionId: string): string {
	return `${getCriterionKey(questionId, criterionId)}${COLUMN_PART_SEPARATOR}marks`;
}

export function buildSubmissionExportHeaders(
	questions: ExportQuestionPlan[],
	options: ExportOptions,
): string[] {
	const headers = ["submission_type", "submitter"];

	for (const question of questions) {
		for (const criterion of question.criteria) {
			if (options.includeCriterionAssessment) {
				headers.push(getAssessmentColumnName(question.id, criterion.id));
			}
			if (options.includeCriterionMarks) {
				headers.push(getMarksColumnName(question.id, criterion.id));
			}
		}

		headers.push(question.id);
	}

	headers.push("grand_total_marks");
	return headers;
}

export function buildSubmissionExportRecord(params: {
	row: SubmissionExportDataRow;
	options: ExportOptions;
}): SubmissionExportRecord {
	const {
		row: { submission, questions },
		options,
	} = params;
	const row: SubmissionExportRecord = {
		submission_type: submission.type,
		submitter: getSubmissionExportIdentifier(submission),
	};

	let grandTotalMarks = 0;
	let hasMissingAssessment = false;

	for (const question of questions) {
		let questionTotalMarks = 0;
		let isQuestionFullyAssessed = true;

		for (const criterion of question.criteria) {
			if (criterion.assessment == null) {
				isQuestionFullyAssessed = false;
			}

			if (options.includeCriterionAssessment) {
				const assessmentValue = criterion.assessment;
				if (assessmentValue != null) {
					row[
						getAssessmentColumnName(question.questionId, criterion.criterionId)
					] = assessmentValue;
				}
			}

			if (options.includeCriterionMarks) {
				if (criterion.marks != null) {
					row[getMarksColumnName(question.questionId, criterion.criterionId)] =
						criterion.marks;
				}
			}

			if (criterion.marks != null) {
				questionTotalMarks += criterion.marks;
			}
		}

		if (isQuestionFullyAssessed) {
			grandTotalMarks += questionTotalMarks;
			row[question.questionId] = questionTotalMarks;
			continue;
		}

		hasMissingAssessment = true;
	}

	if (!hasMissingAssessment) {
		row["grand_total_marks"] = grandTotalMarks;
	}

	return row;
}

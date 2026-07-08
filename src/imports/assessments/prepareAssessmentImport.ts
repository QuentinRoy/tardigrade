import type {
	AssessmentCriterionValue,
	CriterionKind,
} from "#criteria/types.ts";
import type { ImportedAssessmentRow } from "#imports/types.ts";
import type { SubmissionType } from "#submissions/types.ts";

// Column names match the snake_case headers produced by the assessment export.
const SUBMISSION_TYPE_COLUMN = "submission_type";
const SUBMITTER_COLUMN = "submitter";
const GRAND_TOTAL_MARKS_COLUMN = "grand_total_marks";
const MARKS_COLUMN_SUFFIX = ":marks";

export type AssessmentImportCriterion = {
	id: string;
	kind: CriterionKind;
	questionId: string;
	ordinalLabels: string[];
};

export type AssessmentImportContext = {
	// Criterion value columns keyed `${questionId}:${criterionId}`.
	criteriaByColumn: Map<string, AssessmentImportCriterion>;
	// Question ids of the project; bare question columns are derived export
	// output and are ignored on import.
	questionIds: Set<string>;
	// Candidate submission ids keyed by submissionLookupKey().
	submissionIdsByLookup: Map<string, string[]>;
	// (submission, criterion) pairs that already hold a value, keyed by
	// assessedCriterionKey(). Used to report overwrites.
	assessedCriterionKeys: Set<string>;
};

export type AssessmentImportWrite = {
	submissionId: string;
	questionId: string;
	assessment: AssessmentCriterionValue;
};

// `row` is the 1-based CSV line number; the header is line 1, data starts at 2.
export type AssessmentImportBlockingDiagnostic =
	| {
			type: "unmatched-submission";
			row: number;
			submissionType: SubmissionType;
			submitter: string;
	  }
	| {
			type: "ambiguous-submission";
			row: number;
			submissionType: SubmissionType;
			submitter: string;
	  }
	| {
			type: "invalid-value";
			row: number;
			submitter: string;
			column: string;
			message: string;
	  }
	| { type: "unknown-column"; column: string }
	| { type: "no-assessment-columns" };

export type AssessmentImportOverwrite = {
	submissionId: string;
	criterionId: string;
};

export type AssessmentImportPlan = {
	writes: AssessmentImportWrite[];
	blockingDiagnostics: AssessmentImportBlockingDiagnostic[];
	// Recognized derived export columns, reported but never imported.
	ignoredColumns: string[];
	// Writes that replace an existing value (last-write-wins policy).
	overwrites: AssessmentImportOverwrite[];
};

export function submissionLookupKey(params: {
	submissionType: SubmissionType;
	submitter: string;
}): string {
	return `${params.submissionType}:${params.submitter}`;
}

export function assessedCriterionKey(params: {
	submissionId: string;
	criterionId: string;
}): string {
	return `${params.submissionId}:${params.criterionId}`;
}

function parseAssessmentValue(params: {
	value: string;
	criterion: AssessmentImportCriterion;
}): AssessmentCriterionValue {
	const { value, criterion } = params;

	switch (criterion.kind) {
		case "check": {
			const normalizedValue = value.toLowerCase();
			if (normalizedValue !== "true" && normalizedValue !== "false") {
				throw new Error(`Invalid check value "${value}"`);
			}

			return {
				criterionId: criterion.id,
				kind: "check",
				passed: normalizedValue === "true",
			};
		}
		case "options": {
			if (criterion.ordinalLabels.length > 0) {
				const labelExists = criterion.ordinalLabels.includes(value);
				if (!labelExists) {
					throw new Error(
						`Invalid ordinal value "${value}" for criterion ${criterion.id}`,
					);
				}
			}

			return {
				criterionId: criterion.id,
				kind: "options",
				selectedLabel: value,
			};
		}
		case "number": {
			const score = parseFloat(value);
			if (Number.isNaN(score)) {
				throw new Error(`Invalid numerical value "${value}"`);
			}

			return { criterionId: criterion.id, kind: "number", score };
		}
	}
}

export function prepareAssessmentImport(params: {
	rows: ImportedAssessmentRow[];
	context: AssessmentImportContext;
}): AssessmentImportPlan {
	const { rows, context } = params;
	const writes: AssessmentImportWrite[] = [];
	const blockingDiagnostics: AssessmentImportBlockingDiagnostic[] = [];
	const ignoredColumns: string[] = [];
	const overwrites: AssessmentImportOverwrite[] = [];

	const headerColumns = Object.keys(rows.at(0) ?? {});
	for (const column of headerColumns) {
		if (
			column === SUBMISSION_TYPE_COLUMN ||
			column === SUBMITTER_COLUMN ||
			context.criteriaByColumn.has(column)
		) {
			continue;
		}

		const isDerivedMarksColumn =
			column.endsWith(MARKS_COLUMN_SUFFIX) &&
			context.criteriaByColumn.has(
				column.slice(0, -MARKS_COLUMN_SUFFIX.length),
			);
		if (
			column === GRAND_TOTAL_MARKS_COLUMN ||
			context.questionIds.has(column) ||
			isDerivedMarksColumn
		) {
			ignoredColumns.push(column);
			continue;
		}

		blockingDiagnostics.push({ type: "unknown-column", column });
	}

	if (!headerColumns.some((column) => context.criteriaByColumn.has(column))) {
		blockingDiagnostics.push({ type: "no-assessment-columns" });
	}

	for (const [rowIndex, row] of rows.entries()) {
		const csvLine = rowIndex + 2;
		const submissionIds =
			context.submissionIdsByLookup.get(
				submissionLookupKey({
					submissionType: row.submission_type,
					submitter: row.submitter,
				}),
			) ?? [];
		const submissionId = submissionIds[0];

		if (submissionId == null) {
			blockingDiagnostics.push({
				type: "unmatched-submission",
				row: csvLine,
				submissionType: row.submission_type,
				submitter: row.submitter,
			});
			continue;
		}

		if (submissionIds.length > 1) {
			blockingDiagnostics.push({
				type: "ambiguous-submission",
				row: csvLine,
				submissionType: row.submission_type,
				submitter: row.submitter,
			});
			continue;
		}

		for (const [column, criterion] of context.criteriaByColumn) {
			const value = row[column]?.trim();

			if (!value) {
				continue;
			}

			let assessment: AssessmentCriterionValue;
			try {
				assessment = parseAssessmentValue({ value, criterion });
			} catch (error) {
				blockingDiagnostics.push({
					type: "invalid-value",
					row: csvLine,
					submitter: row.submitter,
					column,
					message: error instanceof Error ? error.message : String(error),
				});
				continue;
			}

			writes.push({
				submissionId,
				questionId: criterion.questionId,
				assessment,
			});

			if (
				context.assessedCriterionKeys.has(
					assessedCriterionKey({ submissionId, criterionId: criterion.id }),
				)
			) {
				overwrites.push({ submissionId, criterionId: criterion.id });
			}
		}
	}

	return { writes, blockingDiagnostics, ignoredColumns, overwrites };
}

import type { AssessmentRubricValue } from "#assessments/types.ts";
import type { RubricType } from "#rubrics/types.ts";
import type { SubmissionType } from "#submissions/types.ts";
import type { ImportedAssessmentRow } from "./types.ts";

// Column names match the snake_case headers produced by the assessment export.
const SUBMISSION_TYPE_COLUMN = "submission_type";
const SUBMITTER_COLUMN = "submitter";
const GRAND_TOTAL_MARKS_COLUMN = "grand_total_marks";
const MARKS_COLUMN_SUFFIX = ":marks";

export type AssessmentImportRubric = {
	id: string;
	type: RubricType;
	questionId: string;
	ordinalLabels: string[];
};

export type AssessmentImportContext = {
	// Rubric value columns keyed `${questionId}:${rubricId}`.
	rubricsByColumn: Map<string, AssessmentImportRubric>;
	// Question ids of the project; bare question columns are derived export
	// output and are ignored on import.
	questionIds: Set<string>;
	// Candidate submission ids keyed by submissionLookupKey().
	submissionIdsByLookup: Map<string, string[]>;
	// (submission, rubric) pairs that already hold a value, keyed by
	// assessedRubricKey(). Used to report overwrites.
	assessedRubricKeys: Set<string>;
};

export type AssessmentImportWrite = {
	submissionId: string;
	questionId: string;
	rubric: AssessmentRubricValue;
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
	| { type: "unknown-column"; column: string };

export type AssessmentImportOverwrite = {
	submissionId: string;
	rubricId: string;
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

export function assessedRubricKey(params: {
	submissionId: string;
	rubricId: string;
}): string {
	return `${params.submissionId}:${params.rubricId}`;
}

function parseAssessmentValue(params: {
	value: string;
	rubric: AssessmentImportRubric;
}): AssessmentRubricValue {
	const { value, rubric } = params;

	switch (rubric.type) {
		case "boolean": {
			const normalizedValue = value.toLowerCase();
			if (normalizedValue !== "true" && normalizedValue !== "false") {
				throw new Error(`Invalid boolean value "${value}"`);
			}

			return {
				rubricId: rubric.id,
				type: "boolean",
				passed: normalizedValue === "true",
			};
		}
		case "ordinal": {
			if (rubric.ordinalLabels.length > 0) {
				const labelExists = rubric.ordinalLabels.includes(value);
				if (!labelExists) {
					throw new Error(
						`Invalid ordinal value "${value}" for rubric ${rubric.id}`,
					);
				}
			}

			return { rubricId: rubric.id, type: "ordinal", selectedLabel: value };
		}
		case "numerical": {
			const score = parseFloat(value);
			if (Number.isNaN(score)) {
				throw new Error(`Invalid numerical value "${value}"`);
			}

			return { rubricId: rubric.id, type: "numerical", score };
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
			context.rubricsByColumn.has(column)
		) {
			continue;
		}

		const isDerivedMarksColumn =
			column.endsWith(MARKS_COLUMN_SUFFIX) &&
			context.rubricsByColumn.has(column.slice(0, -MARKS_COLUMN_SUFFIX.length));
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

		for (const [column, rubric] of context.rubricsByColumn) {
			const value = row[column]?.trim();

			if (!value) {
				continue;
			}

			try {
				writes.push({
					submissionId,
					questionId: rubric.questionId,
					rubric: parseAssessmentValue({ value, rubric }),
				});

				if (
					context.assessedRubricKeys.has(
						assessedRubricKey({ submissionId, rubricId: rubric.id }),
					)
				) {
					overwrites.push({ submissionId, rubricId: rubric.id });
				}
			} catch (error) {
				blockingDiagnostics.push({
					type: "invalid-value",
					row: csvLine,
					submitter: row.submitter,
					column,
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	return { writes, blockingDiagnostics, ignoredColumns, overwrites };
}

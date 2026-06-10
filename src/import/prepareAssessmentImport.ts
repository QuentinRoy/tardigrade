import type { AssessmentRubricValue } from "#assessments/types.ts";
import type { RubricType } from "#rubrics/types.ts";
import type { SubmissionType } from "#submissions/types.ts";
import type { ImportedAssessmentRow } from "./types.ts";

export type AssessmentImportRubric = {
	id: string;
	type: RubricType;
	questionId: string;
	ordinalLabels: string[];
};

export type AssessmentImportContext = {
	// Rubric value columns keyed `${questionId}:${rubricId}`.
	rubricsByColumn: Map<string, AssessmentImportRubric>;
	// Candidate submission ids keyed by submissionLookupKey().
	submissionIdsByLookup: Map<string, string[]>;
};

export type AssessmentImportWrite = {
	submissionId: string;
	questionId: string;
	rubric: AssessmentRubricValue;
};

export type AssessmentImportPlan = {
	writes: AssessmentImportWrite[];
};

export function submissionLookupKey(params: {
	submissionType: SubmissionType;
	submitter: string;
}): string {
	return `${params.submissionType}:${params.submitter}`;
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

	for (const row of rows) {
		const submissionIds =
			context.submissionIdsByLookup.get(
				submissionLookupKey({
					submissionType: row.submission_type,
					submitter: row.submitter,
				}),
			) ?? [];
		const submissionId = submissionIds[0];

		if (submissionId == null) {
			continue;
		}

		for (const [column, rubric] of context.rubricsByColumn) {
			const value = row[column]?.trim();

			if (!value) {
				continue;
			}

			writes.push({
				submissionId,
				questionId: rubric.questionId,
				rubric: parseAssessmentValue({ value, rubric }),
			});
		}
	}

	return { writes };
}

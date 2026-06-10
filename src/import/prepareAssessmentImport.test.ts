import { expect, test } from "vitest";
import {
	type AssessmentImportContext,
	prepareAssessmentImport,
	submissionLookupKey,
} from "./prepareAssessmentImport.ts";
import type { ImportedAssessmentRow } from "./types.ts";

function buildContext(
	overrides: Partial<AssessmentImportContext> = {},
): AssessmentImportContext {
	return {
		rubricsByColumn: new Map(),
		submissionIdsByLookup: new Map(),
		...overrides,
	};
}

test("prepareAssessmentImport plans one write per non-empty rubric cell of a matched submission", () => {
	const context = buildContext({
		rubricsByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", type: "boolean", questionId: "q1", ordinalLabels: [] },
			],
			[
				"q1:r-num",
				{ id: "r-num", type: "numerical", questionId: "q1", ordinalLabels: [] },
			],
			[
				"q2:r-ord",
				{
					id: "r-ord",
					type: "ordinal",
					questionId: "q2",
					ordinalLabels: ["good", "bad"],
				},
			],
		]),
		submissionIdsByLookup: new Map([
			[
				submissionLookupKey({
					submissionType: "individual",
					submitter: "student-1",
				}),
				["42"],
			],
		]),
	});

	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: "student-1",
			"q1:r-bool": "true",
			"q1:r-num": "7.5",
			"q2:r-ord": "",
		},
	];

	const plan = prepareAssessmentImport({ rows, context });

	expect(plan.writes).toEqual([
		{
			submissionId: "42",
			questionId: "q1",
			rubric: { rubricId: "r-bool", type: "boolean", passed: true },
		},
		{
			submissionId: "42",
			questionId: "q1",
			rubric: { rubricId: "r-num", type: "numerical", score: 7.5 },
		},
	]);
});

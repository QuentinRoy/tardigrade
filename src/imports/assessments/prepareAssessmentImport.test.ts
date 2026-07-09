import { expect, test } from "vitest";
import type { ImportedAssessmentRow } from "#imports/types.ts";
import {
	type AssessmentImportContext,
	assessedCriterionKey,
	prepareAssessmentImport,
	submissionLookupKey,
} from "./prepareAssessmentImport.ts";

function buildContext(
	overrides: Partial<AssessmentImportContext> = {},
): AssessmentImportContext {
	return {
		criteriaByColumn: new Map(),
		rubricIds: new Set(),
		submissionIdsByLookup: new Map(),
		assessedCriterionKeys: new Set(),
		...overrides,
	};
}

test("prepareAssessmentImport plans one write per non-empty criterion cell of a matched submission", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
			],
			[
				"q1:r-num",
				{ id: "r-num", kind: "number", rubricId: "q1", ordinalLabels: [] },
			],
			[
				"q2:r-ord",
				{
					id: "r-ord",
					kind: "options",
					rubricId: "q2",
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
			rubricId: "q1",
			assessment: { criterionId: "r-bool", kind: "check", passed: true },
		},
		{
			submissionId: "42",
			rubricId: "q1",
			assessment: { criterionId: "r-num", kind: "number", score: 7.5 },
		},
	]);
});

test("prepareAssessmentImport reports an unmatched submission as a blocking diagnostic", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
			],
		]),
	});

	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: "ghost-student",
			"q1:r-bool": "true",
		},
	];

	const plan = prepareAssessmentImport({ rows, context });

	expect(plan.writes).toEqual([]);
	expect(plan.blockingDiagnostics).toEqual([
		{
			type: "unmatched-submission",
			row: 2,
			submissionType: "individual",
			submitter: "ghost-student",
		},
	]);
});

test("prepareAssessmentImport reports an ambiguous submission as a blocking diagnostic", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
			],
		]),
		submissionIdsByLookup: new Map([
			[
				submissionLookupKey({ submissionType: "team", submitter: "Team A" }),
				["7", "8"],
			],
		]),
	});

	const rows: ImportedAssessmentRow[] = [
		{ submission_type: "team", submitter: "Team A", "q1:r-bool": "true" },
	];

	const plan = prepareAssessmentImport({ rows, context });

	expect(plan.writes).toEqual([]);
	expect(plan.blockingDiagnostics).toEqual([
		{
			type: "ambiguous-submission",
			row: 2,
			submissionType: "team",
			submitter: "Team A",
		},
	]);
});

test("prepareAssessmentImport reports an invalid cell value as a blocking diagnostic", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
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
			"q1:r-bool": "not-a-boolean",
		},
	];

	const plan = prepareAssessmentImport({ rows, context });

	expect(plan.writes).toEqual([]);
	expect(plan.blockingDiagnostics).toEqual([
		{
			type: "invalid-value",
			row: 2,
			submitter: "student-1",
			column: "q1:r-bool",
			message: 'Invalid check value "not-a-boolean"',
		},
	]);
});

test("prepareAssessmentImport reports an unknown column as a blocking diagnostic", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
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
			mystery_column: "oops",
		},
	];

	const plan = prepareAssessmentImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([
		{ type: "unknown-column", column: "mystery_column" },
	]);
});

test("prepareAssessmentImport reports derived export columns as ignored, never blocking", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
			],
		]),
		rubricIds: new Set(["q1"]),
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
			"q1:r-bool:marks": "2",
			q1: "2",
			grand_total_marks: "2",
		},
	];

	const plan = prepareAssessmentImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([]);
	expect(plan.ignoredColumns).toEqual([
		"q1:r-bool:marks",
		"q1",
		"grand_total_marks",
	]);
	expect(plan.writes).toHaveLength(1);
});

test("prepareAssessmentImport lists existing values of targeted pairs as overwrites", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
			],
			[
				"q1:r-num",
				{ id: "r-num", kind: "number", rubricId: "q1", ordinalLabels: [] },
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
		assessedCriterionKeys: new Set([
			assessedCriterionKey({ submissionId: "42", criterionId: "r-bool" }),
		]),
	});

	const rows: ImportedAssessmentRow[] = [
		{
			submission_type: "individual",
			submitter: "student-1",
			"q1:r-bool": "true",
			"q1:r-num": "7.5",
		},
	];

	const plan = prepareAssessmentImport({ rows, context });

	expect(plan.writes).toHaveLength(2);
	expect(plan.overwrites).toEqual([
		{ submissionId: "42", criterionId: "r-bool" },
	]);
});

test("prepareAssessmentImport blocks with no-assessment-columns when the header has only derived export columns", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
			],
		]),
		rubricIds: new Set(["q1"]),
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
			"q1:r-bool:marks": "2",
			q1: "2",
			grand_total_marks: "2",
		},
	];

	const plan = prepareAssessmentImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([{ type: "no-assessment-columns" }]);
	expect(plan.writes).toEqual([]);
});

test("prepareAssessmentImport blocks with no-assessment-columns on an empty CSV", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
			],
		]),
	});

	const plan = prepareAssessmentImport({ rows: [], context });

	expect(plan.blockingDiagnostics).toEqual([{ type: "no-assessment-columns" }]);
	expect(plan.writes).toEqual([]);
});

test("prepareAssessmentImport does not block when the header has an assessment column with no values", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
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
		{ submission_type: "individual", submitter: "student-1", "q1:r-bool": "" },
	];

	const plan = prepareAssessmentImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([]);
	expect(plan.writes).toEqual([]);
});

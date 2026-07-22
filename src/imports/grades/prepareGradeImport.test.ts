import { expect, test } from "vitest";
import type { ImportedGradeRow } from "#imports/types.ts";
import {
	type GradeImportContext,
	gradedCriterionKey,
	prepareGradeImport,
	targetLookupKey,
} from "./prepareGradeImport.ts";

function buildContext(
	overrides: Partial<GradeImportContext> = {},
): GradeImportContext {
	return {
		criteriaByColumn: new Map(),
		rubricIds: new Set(),
		targetIdsByLookup: new Map(),
		gradedCriterionKeys: new Set(),
		...overrides,
	};
}

function buildDuplicateCheckContext(): GradeImportContext {
	return buildContext({
		criteriaByColumn: new Map([
			["q1:r-bool", { id: "r-bool", kind: "check", rubricId: "q1" }],
		]),
		targetIdsByLookup: new Map([
			[
				targetLookupKey({ targetKind: "individual", name: "student-1" }),
				["42"],
			],
		]),
	});
}

test("prepareGradeImport plans one write per non-empty criterion cell of a matched target", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
			[
				"q1:r-num",
				{
					id: "r-num",
					kind: "number",
					rubricId: "q1",
					optionsLabels: [],
					minValue: 0,
					maxValue: 10,
				},
			],
			[
				"q2:r-ord",
				{
					id: "r-ord",
					kind: "options",
					rubricId: "q2",
					optionsLabels: ["good", "bad"],
				},
			],
		]),
		targetIdsByLookup: new Map([
			[
				targetLookupKey({ targetKind: "individual", name: "student-1" }),
				["42"],
			],
		]),
	});

	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: "student-1",
			"q1:r-bool": "true",
			"q1:r-num": "7.5",
			"q2:r-ord": "",
		},
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.writes).toEqual([
		{
			gradeTargetId: "42",
			rubricId: "q1",
			grade: { criterionId: "r-bool", kind: "check", passed: true },
		},
		{
			gradeTargetId: "42",
			rubricId: "q1",
			grade: { criterionId: "r-num", kind: "number", value: 7.5 },
		},
	]);
});

test("prepareGradeImport reports an unmatched target as a blocking diagnostic", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
		]),
	});

	const rows: ImportedGradeRow[] = [
		{ kind: "individual", name: "ghost-student", "q1:r-bool": "true" },
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.writes).toEqual([]);
	expect(plan.blockingDiagnostics).toEqual([
		{
			type: "unmatched-target",
			row: 2,
			targetKind: "individual",
			name: "ghost-student",
		},
	]);
});

test("prepareGradeImport reports an ambiguous target as a blocking diagnostic", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
		]),
		targetIdsByLookup: new Map([
			[targetLookupKey({ targetKind: "group", name: "Group A" }), ["7", "8"]],
		]),
	});

	const rows: ImportedGradeRow[] = [
		{ kind: "group", name: "Group A", "q1:r-bool": "true" },
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.writes).toEqual([]);
	expect(plan.blockingDiagnostics).toEqual([
		{ type: "ambiguous-target", row: 2, targetKind: "group", name: "Group A" },
	]);
});

test("prepareGradeImport reports an invalid cell value as a blocking diagnostic", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
		]),
		targetIdsByLookup: new Map([
			[
				targetLookupKey({ targetKind: "individual", name: "student-1" }),
				["42"],
			],
		]),
	});

	const rows: ImportedGradeRow[] = [
		{ kind: "individual", name: "student-1", "q1:r-bool": "not-a-boolean" },
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.writes).toEqual([]);
	expect(plan.blockingDiagnostics).toEqual([
		{
			type: "invalid-value",
			row: 2,
			name: "student-1",
			column: "q1:r-bool",
			message: 'Invalid check value "not-a-boolean"',
		},
	]);
});

test.each([
	{
		name: "below the minimum",
		value: "-0.5",
		expectedWrites: [],
		expectedDiagnostics: [
			{
				type: "invalid-value",
				row: 2,
				name: "student-1",
				column: "q1:r-num",
				message: "Enter a value of at least 0.",
			},
		],
	},
	{
		name: "at the minimum",
		value: "0",
		expectedWrites: [
			{
				gradeTargetId: "42",
				rubricId: "q1",
				grade: { criterionId: "r-num", kind: "number", value: 0 },
			},
		],
		expectedDiagnostics: [],
	},
	{
		name: "within the bounds",
		value: "7.5",
		expectedWrites: [
			{
				gradeTargetId: "42",
				rubricId: "q1",
				grade: { criterionId: "r-num", kind: "number", value: 7.5 },
			},
		],
		expectedDiagnostics: [],
	},
	{
		name: "at the maximum",
		value: "10",
		expectedWrites: [
			{
				gradeTargetId: "42",
				rubricId: "q1",
				grade: { criterionId: "r-num", kind: "number", value: 10 },
			},
		],
		expectedDiagnostics: [],
	},
	{
		name: "above the maximum",
		value: "10.5",
		expectedWrites: [],
		expectedDiagnostics: [
			{
				type: "invalid-value",
				row: 2,
				name: "student-1",
				column: "q1:r-num",
				message: "Enter a value of at most 10.",
			},
		],
	},
])(
	"prepareGradeImport handles a Number value $name",
	({ value, expectedWrites, expectedDiagnostics }) => {
		const context = buildContext({
			criteriaByColumn: new Map([
				[
					"q1:r-num",
					{
						id: "r-num",
						kind: "number",
						rubricId: "q1",
						optionsLabels: [],
						minValue: 0,
						maxValue: 10,
					},
				],
			]),
			targetIdsByLookup: new Map([
				[
					targetLookupKey({ targetKind: "individual", name: "student-1" }),
					["42"],
				],
			]),
		});
		const rows: ImportedGradeRow[] = [
			{ kind: "individual", name: "student-1", "q1:r-num": value },
		];

		const plan = prepareGradeImport({ rows, context });

		expect(plan.writes).toEqual(expectedWrites);
		expect(plan.blockingDiagnostics).toEqual(expectedDiagnostics);
	},
);

test("prepareGradeImport reports an unknown column as a blocking diagnostic", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
		]),
		targetIdsByLookup: new Map([
			[
				targetLookupKey({ targetKind: "individual", name: "student-1" }),
				["42"],
			],
		]),
	});

	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: "student-1",
			"q1:r-bool": "true",
			mystery_column: "oops",
		},
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([
		{ type: "unknown-column", column: "mystery_column" },
	]);
});

test("prepareGradeImport reports derived export columns as ignored, never blocking", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
		]),
		rubricIds: new Set(["q1"]),
		targetIdsByLookup: new Map([
			[
				targetLookupKey({ targetKind: "individual", name: "student-1" }),
				["42"],
			],
		]),
	});

	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: "student-1",
			"q1:r-bool": "true",
			"q1:r-bool:marks": "2",
			"q1:total": "2",
			final_total: "2",
		},
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([]);
	expect(plan.ignoredColumns).toEqual([
		"q1:r-bool:marks",
		"q1:total",
		"final_total",
	]);
	expect(plan.writes).toHaveLength(1);
});

test("prepareGradeImport lists existing values of targeted pairs as overwrites", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
			[
				"q1:r-num",
				{
					id: "r-num",
					kind: "number",
					rubricId: "q1",
					optionsLabels: [],
					minValue: 0,
					maxValue: 10,
				},
			],
		]),
		targetIdsByLookup: new Map([
			[
				targetLookupKey({ targetKind: "individual", name: "student-1" }),
				["42"],
			],
		]),
		gradedCriterionKeys: new Set([
			gradedCriterionKey({ targetId: "42", criterionId: "r-bool" }),
		]),
	});

	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: "student-1",
			"q1:r-bool": "true",
			"q1:r-num": "7.5",
		},
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.writes).toHaveLength(2);
	expect(plan.overwrites).toEqual([{ targetId: "42", criterionId: "r-bool" }]);
});

test("prepareGradeImport reports duplicate cells with different values and both source locations", () => {
	const context = buildDuplicateCheckContext();
	const rows: ImportedGradeRow[] = [
		{ kind: "individual", name: "student-1", "q1:r-bool": "true" },
		{ kind: "individual", name: "student-1", "q1:r-bool": "false" },
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([
		{
			type: "duplicate-grade-cell",
			first: { row: 2, column: "q1:r-bool" },
			second: { row: 3, column: "q1:r-bool" },
		},
	]);
});

test("prepareGradeImport reports every pair of duplicate cells with identical values", () => {
	const context = buildDuplicateCheckContext();
	const rows: ImportedGradeRow[] = [
		{ kind: "individual", name: "student-1", "q1:r-bool": "true" },
		{ kind: "individual", name: "student-1", "q1:r-bool": "true" },
		{ kind: "individual", name: "student-1", "q1:r-bool": "true" },
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([
		{
			type: "duplicate-grade-cell",
			first: { row: 2, column: "q1:r-bool" },
			second: { row: 3, column: "q1:r-bool" },
		},
		{
			type: "duplicate-grade-cell",
			first: { row: 2, column: "q1:r-bool" },
			second: { row: 4, column: "q1:r-bool" },
		},
		{
			type: "duplicate-grade-cell",
			first: { row: 3, column: "q1:r-bool" },
			second: { row: 4, column: "q1:r-bool" },
		},
	]);
});

test("prepareGradeImport allows repeated target rows with disjoint non-empty criterion cells", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-first",
				{ id: "r-first", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
			[
				"q1:r-second",
				{ id: "r-second", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
		]),
		targetIdsByLookup: new Map([
			[
				targetLookupKey({ targetKind: "individual", name: "student-1" }),
				["42"],
			],
		]),
	});
	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: "student-1",
			"q1:r-first": "true",
			"q1:r-second": "",
		},
		{
			kind: "individual",
			name: "student-1",
			"q1:r-first": "",
			"q1:r-second": "false",
		},
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([]);
	expect(plan.writes).toEqual([
		{
			gradeTargetId: "42",
			rubricId: "q1",
			grade: { criterionId: "r-first", kind: "check", passed: true },
		},
		{
			gradeTargetId: "42",
			rubricId: "q1",
			grade: { criterionId: "r-second", kind: "check", passed: false },
		},
	]);
});

test("prepareGradeImport blocks with no-grade-columns when the header has only derived export columns", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
		]),
		rubricIds: new Set(["q1"]),
		targetIdsByLookup: new Map([
			[
				targetLookupKey({ targetKind: "individual", name: "student-1" }),
				["42"],
			],
		]),
	});

	const rows: ImportedGradeRow[] = [
		{
			kind: "individual",
			name: "student-1",
			"q1:r-bool:marks": "2",
			"q1:total": "2",
			final_total: "2",
		},
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([{ type: "no-grade-columns" }]);
	expect(plan.writes).toEqual([]);
});

test("prepareGradeImport blocks with no-grade-columns on an empty CSV", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
		]),
	});

	const plan = prepareGradeImport({ rows: [], context });

	expect(plan.blockingDiagnostics).toEqual([{ type: "no-grade-columns" }]);
	expect(plan.writes).toEqual([]);
});

test("prepareGradeImport does not block when the header has a grade column with no values", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", optionsLabels: [] },
			],
		]),
		targetIdsByLookup: new Map([
			[
				targetLookupKey({ targetKind: "individual", name: "student-1" }),
				["42"],
			],
		]),
	});

	const rows: ImportedGradeRow[] = [
		{ kind: "individual", name: "student-1", "q1:r-bool": "" },
	];

	const plan = prepareGradeImport({ rows, context });

	expect(plan.blockingDiagnostics).toEqual([]);
	expect(plan.writes).toEqual([]);
});

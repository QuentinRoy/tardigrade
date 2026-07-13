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

test("prepareGradeImport plans one write per non-empty criterion cell of a matched target", () => {
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
			targetId: "42",
			rubricId: "q1",
			grade: { criterionId: "r-bool", kind: "check", passed: true },
		},
		{
			targetId: "42",
			rubricId: "q1",
			grade: { criterionId: "r-num", kind: "number", score: 7.5 },
		},
	]);
});

test("prepareGradeImport reports an unmatched target as a blocking diagnostic", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
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
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
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
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
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

test("prepareGradeImport reports an unknown column as a blocking diagnostic", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
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
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
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
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
			],
			[
				"q1:r-num",
				{ id: "r-num", kind: "number", rubricId: "q1", ordinalLabels: [] },
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

test("prepareGradeImport blocks with no-grade-columns when the header has only derived export columns", () => {
	const context = buildContext({
		criteriaByColumn: new Map([
			[
				"q1:r-bool",
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
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
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
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
				{ id: "r-bool", kind: "check", rubricId: "q1", ordinalLabels: [] },
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

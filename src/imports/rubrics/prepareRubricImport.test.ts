import { expect, test } from "vitest";
import type { ImportedRubrics } from "#imports/types.ts";
import {
	prepareRubricImport,
	type RubricImportContext,
} from "./prepareRubricImport.ts";

function buildContext(
	overrides: Partial<RubricImportContext> = {},
): RubricImportContext {
	return { existingCriteriaById: new Map(), ...overrides };
}

test("prepareRubricImport plans rubric and criterion upserts from parsed rubrics", () => {
	const rubrics: ImportedRubrics = [
		{
			id: "q1",
			label: "Rubric 1",
			criteria: [{ id: "r1", kind: "check", label: "Criterion 1", marks: 2 }],
		},
	];

	const plan = prepareRubricImport({ rubrics, context: buildContext() });

	expect(plan.writes).toEqual(rubrics);
	expect(plan.blockingDiagnostics).toEqual([]);
	expect(plan.criterionKindChanges).toEqual([]);
});

test("prepareRubricImport blocks a criterion type change when grades are linked", () => {
	const rubrics: ImportedRubrics = [
		{
			id: "q1",
			label: "Rubric 1",
			criteria: [
				{
					id: "r1",
					kind: "options",
					label: "Criterion 1",
					marks: { good: 1, bad: 0 },
				},
			],
		},
	];

	const context = buildContext({
		existingCriteriaById: new Map([
			["r1", { kind: "check", rubricId: "q1", gradedTargetCount: 3 }],
		]),
	});

	const plan = prepareRubricImport({ rubrics, context });

	expect(plan.blockingDiagnostics).toEqual([
		{
			kind: "criterion-kind-change-blocked",
			rubricId: "q1",
			criterionId: "r1",
			gradedTargetCount: 3,
		},
	]);
	expect(plan.criterionKindChanges).toEqual([]);
});

test("prepareRubricImport allows and reports a criterion type change with no linked grades", () => {
	const rubrics: ImportedRubrics = [
		{
			id: "q1",
			label: "Rubric 1",
			criteria: [
				{
					id: "r1",
					kind: "options",
					label: "Criterion 1",
					marks: { good: 1, bad: 0 },
				},
			],
		},
	];

	const context = buildContext({
		existingCriteriaById: new Map([
			["r1", { kind: "check", rubricId: "q1", gradedTargetCount: 0 }],
		]),
	});

	const plan = prepareRubricImport({ rubrics, context });

	expect(plan.blockingDiagnostics).toEqual([]);
	expect(plan.criterionKindChanges).toEqual([
		{ rubricId: "q1", criterionId: "r1", fromKind: "check", toKind: "options" },
	]);
});

test("prepareRubricImport blocks when an imported criterion id belongs to another rubric", () => {
	const rubrics: ImportedRubrics = [
		{
			id: "q2",
			label: "Rubric 2",
			criteria: [{ id: "r1", kind: "check", label: "Criterion 1", marks: 2 }],
		},
	];

	const context = buildContext({
		existingCriteriaById: new Map([
			["r1", { kind: "check", rubricId: "q1", gradedTargetCount: 0 }],
		]),
	});

	const plan = prepareRubricImport({ rubrics, context });

	expect(plan.blockingDiagnostics).toEqual([
		{
			kind: "criterion-rubric-mismatch",
			criterionId: "r1",
			importRubricId: "q2",
			existingRubricId: "q1",
		},
	]);
});

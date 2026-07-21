import { expect, test } from "vitest";
import type { NormalizedImportedGradeTarget } from "#imports/types.ts";
import {
	prepareStudentImport,
	type StudentImportContext,
} from "./prepareStudentImport.ts";

function buildContext(
	overrides: Partial<StudentImportContext> = {},
): StudentImportContext {
	return {
		existingStudentIds: new Set(),
		existingIndividualGradeTargetStudentIds: new Set(),
		existingGroupGradeTargetGroupNames: new Set(),
		...overrides,
	};
}

test("prepareStudentImport classifies existing students and grade targets as updated", () => {
	const targets: NormalizedImportedGradeTarget[] = [
		{
			id: "target-s1",
			kind: "individual",
			students: [{ id: "s1", lastName: "Doe", firstName: "Jane" }],
		},
		{
			id: "group-alpha",
			kind: "group",
			group: "Alpha",
			students: [{ id: "s2", lastName: "Roe", firstName: "Sam" }],
		},
	];

	const context = buildContext({
		existingStudentIds: new Set(["s1"]),
		existingIndividualGradeTargetStudentIds: new Set(["s1"]),
		existingGroupGradeTargetGroupNames: new Set(["Alpha"]),
	});

	const plan = prepareStudentImport({ targets, context });

	expect(plan.createdStudentIds).toEqual(["s2"]);
	expect(plan.updatedStudentIds).toEqual(["s1"]);
	expect(plan.createdGradeTargetIds).toEqual([]);
	expect(plan.updatedGradeTargetIds).toEqual(["target-s1", "group-alpha"]);
});

test("prepareStudentImport plans student and grade-target upserts from parsed targets", () => {
	const targets: NormalizedImportedGradeTarget[] = [
		{
			id: "target-s1",
			kind: "individual",
			students: [{ id: "s1", lastName: "Doe", firstName: "Jane" }],
		},
	];

	const plan = prepareStudentImport({ targets, context: buildContext() });

	expect(plan.writes).toEqual(targets);
	expect(plan.createdStudentIds).toEqual(["s1"]);
	expect(plan.updatedStudentIds).toEqual([]);
	expect(plan.createdGradeTargetIds).toEqual(["target-s1"]);
	expect(plan.updatedGradeTargetIds).toEqual([]);
});

test("prepareStudentImport classifies an existing group as updated even with a new member", () => {
	const targets: NormalizedImportedGradeTarget[] = [
		{
			id: "group-beta",
			kind: "group",
			group: "Beta",
			students: [
				{ id: "s1", lastName: "Doe", firstName: "Jane" },
				{ id: "s2", lastName: "Roe", firstName: "Sam" },
			],
		},
	];

	const context = buildContext({
		existingStudentIds: new Set(["s1"]),
		existingGroupGradeTargetGroupNames: new Set(["Beta"]),
	});

	const plan = prepareStudentImport({ targets, context });

	expect(plan.createdStudentIds).toEqual(["s2"]);
	expect(plan.updatedStudentIds).toEqual(["s1"]);
	expect(plan.createdGradeTargetIds).toEqual([]);
	expect(plan.updatedGradeTargetIds).toEqual(["group-beta"]);
});

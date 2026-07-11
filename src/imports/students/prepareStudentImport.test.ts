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
		existingStudentsById: new Map(),
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
		existingStudentsById: new Map([
			["s1", { lastName: "Doe", firstName: "Jane" }],
		]),
		existingIndividualGradeTargetStudentIds: new Set(["s1"]),
		existingGroupGradeTargetGroupNames: new Set(["Alpha"]),
	});

	const plan = prepareStudentImport({ targets, context });

	expect(plan.createdStudentIds).toEqual(["s2"]);
	expect(plan.updatedStudentIds).toEqual(["s1"]);
	expect(plan.createdGradeTargetIds).toEqual([]);
	expect(plan.updatedGradeTargetIds).toEqual(["target-s1", "group-alpha"]);
});

test("prepareStudentImport reports group membership changes for existing students", () => {
	const targets: NormalizedImportedGradeTarget[] = [
		{
			id: "group-beta",
			kind: "group",
			group: "Beta",
			students: [{ id: "s1", lastName: "Doe", firstName: "Jane" }],
		},
		{
			id: "target-s2",
			kind: "individual",
			students: [{ id: "s2", lastName: "Roe", firstName: "Sam" }],
		},
		{
			id: "group-gamma",
			kind: "group",
			group: "Gamma",
			students: [{ id: "s3", lastName: "Lee", firstName: "Kim" }],
		},
	];

	const context = buildContext({
		existingStudentsById: new Map([
			["s1", { lastName: "Doe", firstName: "Jane", groupName: "Alpha" }],
			["s2", { lastName: "Roe", firstName: "Sam", groupName: "Alpha" }],
			["s3", { lastName: "Lee", firstName: "Kim", groupName: "Gamma" }],
		]),
	});

	const plan = prepareStudentImport({ targets, context });

	expect(plan.groupMembershipChanges).toEqual([
		{ studentId: "s1", fromGroup: "Alpha", toGroup: "Beta" },
		{ studentId: "s2", fromGroup: "Alpha", toGroup: undefined },
	]);
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
	expect(plan.groupMembershipChanges).toEqual([]);
});

import { expect, test } from "vitest";
import type { NormalizedImportedSubmission } from "#imports/types.ts";
import {
	prepareStudentImport,
	type StudentImportContext,
} from "./prepareStudentImport.ts";

function buildContext(
	overrides: Partial<StudentImportContext> = {},
): StudentImportContext {
	return {
		existingStudentsById: new Map(),
		existingIndividualSubmissionStudentIds: new Set(),
		existingGroupSubmissionGroupNames: new Set(),
		...overrides,
	};
}

test("prepareStudentImport classifies existing students and submissions as updated", () => {
	const submissions: NormalizedImportedSubmission[] = [
		{
			id: "submission-s1",
			type: "individual",
			students: [{ id: "s1", lastName: "Doe", firstName: "Jane" }],
		},
		{
			id: "group-alpha",
			type: "group",
			group: "Alpha",
			students: [{ id: "s2", lastName: "Roe", firstName: "Sam" }],
		},
	];

	const context = buildContext({
		existingStudentsById: new Map([
			["s1", { lastName: "Doe", firstName: "Jane" }],
		]),
		existingIndividualSubmissionStudentIds: new Set(["s1"]),
		existingGroupSubmissionGroupNames: new Set(["Alpha"]),
	});

	const plan = prepareStudentImport({ submissions, context });

	expect(plan.createdStudentIds).toEqual(["s2"]);
	expect(plan.updatedStudentIds).toEqual(["s1"]);
	expect(plan.createdSubmissionIds).toEqual([]);
	expect(plan.updatedSubmissionIds).toEqual(["submission-s1", "group-alpha"]);
});

test("prepareStudentImport reports group membership changes for existing students", () => {
	const submissions: NormalizedImportedSubmission[] = [
		{
			id: "group-beta",
			type: "group",
			group: "Beta",
			students: [{ id: "s1", lastName: "Doe", firstName: "Jane" }],
		},
		{
			id: "submission-s2",
			type: "individual",
			students: [{ id: "s2", lastName: "Roe", firstName: "Sam" }],
		},
		{
			id: "group-gamma",
			type: "group",
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

	const plan = prepareStudentImport({ submissions, context });

	expect(plan.groupMembershipChanges).toEqual([
		{ studentId: "s1", fromGroup: "Alpha", toGroup: "Beta" },
		{ studentId: "s2", fromGroup: "Alpha", toGroup: undefined },
	]);
});

test("prepareStudentImport plans student and submission upserts from parsed submissions", () => {
	const submissions: NormalizedImportedSubmission[] = [
		{
			id: "submission-s1",
			type: "individual",
			students: [{ id: "s1", lastName: "Doe", firstName: "Jane" }],
		},
	];

	const plan = prepareStudentImport({ submissions, context: buildContext() });

	expect(plan.writes).toEqual(submissions);
	expect(plan.createdStudentIds).toEqual(["s1"]);
	expect(plan.updatedStudentIds).toEqual([]);
	expect(plan.createdSubmissionIds).toEqual(["submission-s1"]);
	expect(plan.updatedSubmissionIds).toEqual([]);
	expect(plan.groupMembershipChanges).toEqual([]);
});

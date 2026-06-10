import { expect, test } from "vitest";
import {
	prepareStudentImport,
	type StudentImportContext,
} from "./prepareStudentImport.ts";
import type { NormalizedImportedSubmission } from "./types.ts";

function buildContext(
	overrides: Partial<StudentImportContext> = {},
): StudentImportContext {
	return {
		existingStudentsById: new Map(),
		existingIndividualSubmissionStudentIds: new Set(),
		existingTeamSubmissionTeamNames: new Set(),
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
			id: "team-alpha",
			type: "team",
			team: "Alpha",
			students: [{ id: "s2", lastName: "Roe", firstName: "Sam" }],
		},
	];

	const context = buildContext({
		existingStudentsById: new Map([
			["s1", { lastName: "Doe", firstName: "Jane" }],
		]),
		existingIndividualSubmissionStudentIds: new Set(["s1"]),
		existingTeamSubmissionTeamNames: new Set(["Alpha"]),
	});

	const plan = prepareStudentImport({ submissions, context });

	expect(plan.createdStudentIds).toEqual(["s2"]);
	expect(plan.updatedStudentIds).toEqual(["s1"]);
	expect(plan.createdSubmissionIds).toEqual([]);
	expect(plan.updatedSubmissionIds).toEqual(["submission-s1", "team-alpha"]);
});

test("prepareStudentImport reports team membership changes for existing students", () => {
	const submissions: NormalizedImportedSubmission[] = [
		{
			id: "team-beta",
			type: "team",
			team: "Beta",
			students: [{ id: "s1", lastName: "Doe", firstName: "Jane" }],
		},
		{
			id: "submission-s2",
			type: "individual",
			students: [{ id: "s2", lastName: "Roe", firstName: "Sam" }],
		},
		{
			id: "team-gamma",
			type: "team",
			team: "Gamma",
			students: [{ id: "s3", lastName: "Lee", firstName: "Kim" }],
		},
	];

	const context = buildContext({
		existingStudentsById: new Map([
			["s1", { lastName: "Doe", firstName: "Jane", teamName: "Alpha" }],
			["s2", { lastName: "Roe", firstName: "Sam", teamName: "Alpha" }],
			["s3", { lastName: "Lee", firstName: "Kim", teamName: "Gamma" }],
		]),
	});

	const plan = prepareStudentImport({ submissions, context });

	expect(plan.teamMembershipChanges).toEqual([
		{ studentId: "s1", fromTeam: "Alpha", toTeam: "Beta" },
		{ studentId: "s2", fromTeam: "Alpha", toTeam: undefined },
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
	expect(plan.teamMembershipChanges).toEqual([]);
});

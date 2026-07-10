import { revalidateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { NormalizedImportedSubmission } from "#imports/types.ts";
import { runForcedInterleaving } from "#test/concurrency.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { prepareStudentImport } from "./prepareStudentImport.ts";
import { saveStudentImportPlanInDb, saveStudents } from "./saveStudents.ts";
import { loadStudentImportContextFromDb } from "./studentImportContext.ts";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

function makeSubmissions(
	sharedStudentId: string,
	sharedGroupName: string,
): NormalizedImportedSubmission[] {
	return [
		{
			id: `submission-${sharedStudentId}`,
			type: "individual",
			students: [
				{ id: sharedStudentId, lastName: "Shared", firstName: "Student" },
			],
		},
		{
			id: `submission-${sharedGroupName}`,
			type: "group",
			group: sharedGroupName,
			students: [
				{
					id: `${sharedGroupName}-member`,
					lastName: "Group",
					firstName: "Member",
				},
			],
		},
	];
}

test("saveStudents keeps imported student ids and group names isolated per project", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Project A");
	await using projectB = await createProject(db, "Project B");

	const sharedStudentId = "shared-student";
	const sharedGroupName = "Shared Group";

	const resultA = await saveStudents(
		{
			submissions: makeSubmissions(sharedStudentId, sharedGroupName),
			projectId: projectA.id,
		},
		{ db },
	);
	const resultB = await saveStudents(
		{
			submissions: makeSubmissions(sharedStudentId, sharedGroupName),
			projectId: projectB.id,
		},
		{ db },
	);

	expect(resultA).toEqual({
		createdStudentCount: 2,
		updatedStudentCount: 0,
		createdSubmissionCount: 2,
		updatedSubmissionCount: 0,
	});
	expect(resultB).toEqual({
		createdStudentCount: 2,
		updatedStudentCount: 0,
		createdSubmissionCount: 2,
		updatedSubmissionCount: 0,
	});

	const studentRows = await db
		.selectFrom("student")
		.select(["id", "rowId", "projectId"])
		.where("id", "in", [sharedStudentId, `${sharedGroupName}-member`])
		.orderBy("projectId", "asc")
		.orderBy("id", "asc")
		.execute();

	expect(studentRows).toHaveLength(4);
	expect(
		studentRows
			.filter((row) => row.id === sharedStudentId)
			.map((row) => row.rowId),
	).toHaveLength(2);
	expect(
		new Set(
			studentRows
				.filter((row) => row.id === sharedStudentId)
				.map((row) => row.rowId),
		).size,
	).toBe(2);

	const groupRows = await db
		.selectFrom("group")
		.select(["id", "name", "projectId"])
		.where("name", "=", sharedGroupName)
		.orderBy("projectId", "asc")
		.execute();

	expect(groupRows).toHaveLength(2);
	expect(new Set(groupRows.map((row) => row.projectId)).size).toBe(2);

	const individualSubmissions = await db
		.selectFrom("submission")
		.innerJoin("student", "student.rowId", "submission.studentId")
		.select([
			"submission.id as submissionId",
			"submission.projectId as projectId",
			"student.id as studentId",
			"student.rowId as studentRowId",
		])
		.where("submission.type", "=", "individual")
		.orderBy("submission.projectId", "asc")
		.execute();

	expect(individualSubmissions).toHaveLength(2);
	expect(individualSubmissions.map((row) => row.studentId)).toEqual([
		sharedStudentId,
		sharedStudentId,
	]);
	expect(
		new Set(individualSubmissions.map((row) => row.studentRowId)).size,
	).toBe(2);
});

test("saveStudents classifies re-imported students and submissions as updated", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Re-import Project");

	const submissions = makeSubmissions("returning-student", "Returning Group");

	await saveStudents({ submissions, projectId: project.id }, { db });
	const result = await saveStudents(
		{ submissions, projectId: project.id },
		{ db },
	);

	expect(result).toEqual({
		createdStudentCount: 0,
		updatedStudentCount: 2,
		createdSubmissionCount: 0,
		updatedSubmissionCount: 2,
	});
});

test("saveStudents wrapper invalidates submission and assessment tags after the import commits", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Import Students Cache Project",
	);

	await saveStudents(
		{
			submissions: makeSubmissions("student-cache", "Group Cache"),
			projectId: project.id,
		},
		{ db },
	);

	expect(vi.mocked(revalidateTag).mock.calls).toEqual([
		["submissions", "max"],
		["assessments", "max"],
		["assessments:all", "max"],
	]);
});

// Lighter, overlap-invariant coverage (per the plan): assert the row-level
// contract only (no corruption, no thrown error, last-write-wins), not
// reported counts, which are allowed to drift under concurrent imports.
// Targets the `studentToGroup` delete-then-reinsert path
// (`saveStudents.ts:150`), the spot most plausible to misbehave under
// overlapping writes since it spans a delete and an insert on the same row.
test("saveStudentImportPlanInDb keeps a single group membership when two imports race the same student onto different groups", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Concurrency Student Import Project",
	);

	const sharedStudentId = "shared-student";

	function makeMoveToGroup(groupName: string): NormalizedImportedSubmission[] {
		return [
			{
				id: `submission-${groupName}`,
				type: "group",
				group: groupName,
				students: [
					{ id: sharedStudentId, lastName: "Shared", firstName: "Student" },
				],
			},
		];
	}

	const submissionsToGroupB = makeMoveToGroup("Group B");
	const submissionsToGroupC = makeMoveToGroup("Group C");

	const [contextB, contextC] = await Promise.all([
		loadStudentImportContextFromDb(db, {
			submissions: submissionsToGroupB,
			projectId: project.id,
		}),
		loadStudentImportContextFromDb(db, {
			submissions: submissionsToGroupC,
			projectId: project.id,
		}),
	]);

	const planB = prepareStudentImport({
		submissions: submissionsToGroupB,
		context: contextB,
	});
	const planC = prepareStudentImport({
		submissions: submissionsToGroupC,
		context: contextC,
	});

	await runForcedInterleaving(db, {
		first: (tx) =>
			saveStudentImportPlanInDb(tx, { plan: planB, projectId: project.id }),
		second: (tx) =>
			saveStudentImportPlanInDb(tx, { plan: planC, projectId: project.id }),
	});

	const studentRows = await db
		.selectFrom("student")
		.select("rowId")
		.where("projectId", "=", project.rowId)
		.where("id", "=", sharedStudentId)
		.execute();
	expect(studentRows).toHaveLength(1);
	const studentRowId = studentRows[0]?.rowId;

	const groupMemberships = await db
		.selectFrom("studentToGroup")
		.innerJoin("group", "group.id", "studentToGroup.groupId")
		.select("group.name")
		.where("studentToGroup.studentId", "=", studentRowId ?? -1)
		.execute();

	expect(groupMemberships).toHaveLength(1);
	expect(["Group B", "Group C"]).toContain(groupMemberships[0]?.name);

	// Documents current behavior, not a committed policy: the writer that
	// commits last (the second writer, here) wins.
	expect(groupMemberships[0]?.name).toBe("Group C");
});

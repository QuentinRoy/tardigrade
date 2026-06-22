import { revalidateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import { runForcedInterleaving } from "#test/concurrency.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { prepareStudentImport } from "./prepareStudentImport.ts";
import { saveStudentImportPlanInDb, saveStudents } from "./saveStudents.ts";
import { loadStudentImportContextFromDb } from "./studentImportContext.ts";
import type { NormalizedImportedSubmission } from "./types.ts";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

function makeSubmissions(
	sharedStudentId: string,
	sharedTeamName: string,
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
			id: `submission-${sharedTeamName}`,
			type: "team",
			team: sharedTeamName,
			students: [
				{
					id: `${sharedTeamName}-member`,
					lastName: "Team",
					firstName: "Member",
				},
			],
		},
	];
}

test("saveStudents keeps imported student ids and team names isolated per project", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Project A");
	await using projectB = await createProject(db, "Project B");

	const sharedStudentId = "shared-student";
	const sharedTeamName = "Shared Team";

	const resultA = await saveStudents(
		{
			submissions: makeSubmissions(sharedStudentId, sharedTeamName),
			projectId: projectA.id,
		},
		{ db },
	);
	const resultB = await saveStudents(
		{
			submissions: makeSubmissions(sharedStudentId, sharedTeamName),
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
		.where("id", "in", [sharedStudentId, `${sharedTeamName}-member`])
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

	const teamRows = await db
		.selectFrom("team")
		.select(["id", "name", "projectId"])
		.where("name", "=", sharedTeamName)
		.orderBy("projectId", "asc")
		.execute();

	expect(teamRows).toHaveLength(2);
	expect(new Set(teamRows.map((row) => row.projectId)).size).toBe(2);

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

	const submissions = makeSubmissions("returning-student", "Returning Team");

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
			submissions: makeSubmissions("student-cache", "Team Cache"),
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
// Targets the `studentToTeam` delete-then-reinsert path
// (`saveStudents.ts:150`), the spot most plausible to misbehave under
// overlapping writes since it spans a delete and an insert on the same row.
test("saveStudentImportPlanInDb keeps a single team membership when two imports race the same student onto different teams", async () => {
	await using db = await createTestDb();
	await using project = await createProject(
		db,
		"Concurrency Student Import Project",
	);

	const sharedStudentId = "shared-student";

	function makeMoveToTeam(teamName: string): NormalizedImportedSubmission[] {
		return [
			{
				id: `submission-${teamName}`,
				type: "team",
				team: teamName,
				students: [
					{ id: sharedStudentId, lastName: "Shared", firstName: "Student" },
				],
			},
		];
	}

	const submissionsToTeamB = makeMoveToTeam("Team B");
	const submissionsToTeamC = makeMoveToTeam("Team C");

	const [contextB, contextC] = await Promise.all([
		loadStudentImportContextFromDb(db, {
			submissions: submissionsToTeamB,
			projectId: project.id,
		}),
		loadStudentImportContextFromDb(db, {
			submissions: submissionsToTeamC,
			projectId: project.id,
		}),
	]);

	const planB = prepareStudentImport({
		submissions: submissionsToTeamB,
		context: contextB,
	});
	const planC = prepareStudentImport({
		submissions: submissionsToTeamC,
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

	const teamMemberships = await db
		.selectFrom("studentToTeam")
		.innerJoin("team", "team.id", "studentToTeam.teamId")
		.select("team.name")
		.where("studentToTeam.studentId", "=", studentRowId ?? -1)
		.execute();

	expect(teamMemberships).toHaveLength(1);
	expect(["Team B", "Team C"]).toContain(teamMemberships[0]?.name);

	// Documents current behavior, not a committed policy: the writer that
	// commits last (the second writer, here) wins.
	expect(teamMemberships[0]?.name).toBe("Team C");
});

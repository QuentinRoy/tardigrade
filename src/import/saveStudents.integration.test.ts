import { type Kysely } from "kysely";
import { beforeEach, expect, test, vi } from "vitest";
import type { DB } from "#db/generated/db.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import { saveStudentsInDb } from "./saveStudents.ts";
import type { NormalizedImportedSubmission } from "./types.ts";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

// saveStudents owns the global db + transaction + cache; this thin seam points the
// global db at the test db so the wrapper's invalidation can be asserted.
async function loadSaveStudentsWrapperWithDb(db: Kysely<DB>) {
	vi.resetModules();
	using _kyselyMock = vi.doMock("#db/kysely", () => ({ db }));

	return await import("./saveStudents.ts");
}

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

test("saveStudentsInDb keeps imported student ids and team names isolated per project", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Project A");
	await using projectB = await createProject(db, "Project B");

	const sharedStudentId = "shared-student";
	const sharedTeamName = "Shared Team";

	const resultA = await saveStudentsInDb(db, {
		submissions: makeSubmissions(sharedStudentId, sharedTeamName),
		projectId: projectA.id,
	});
	const resultB = await saveStudentsInDb(db, {
		submissions: makeSubmissions(sharedStudentId, sharedTeamName),
		projectId: projectB.id,
	});

	expect(resultA).toEqual({ submissionCount: 2, studentCount: 2 });
	expect(resultB).toEqual({ submissionCount: 2, studentCount: 2 });

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

test("saveStudents wrapper invalidates submission and assessment tags after the import commits", async () => {
	await using db = await createTestDb();
	const { saveStudents } = await loadSaveStudentsWrapperWithDb(db);
	const { revalidateTag } = await import("next/cache");
	await using project = await createProject(
		db,
		"Import Students Cache Project",
	);

	await saveStudents(
		makeSubmissions("student-cache", "Team Cache"),
		project.id,
	);

	expect(vi.mocked(revalidateTag).mock.calls).toEqual([
		["submissions", "max"],
		["assessments", "max"],
		["assessments:all", "max"],
	]);
});

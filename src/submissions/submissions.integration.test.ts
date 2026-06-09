import type { Kysely } from "kysely";
import { cacheTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import type { DB } from "#db/generated/db.ts";
import { createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import {
	loadSubmissions,
	loadSubmissionsFromDb,
	submissionsCacheTags,
} from "./submissions.ts";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

async function loadProjectPublicId(
	db: Kysely<DB>,
	projectId: string,
): Promise<number> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();

	return project.rowId;
}

async function createStudentAndSubmission(
	db: Kysely<DB>,
	projectId: string,
	studentId: string,
): Promise<string> {
	const projectRowId = await loadProjectPublicId(db, projectId);

	await db
		.insertInto("student")
		.values({
			projectId: projectRowId,
			id: studentId,
			lastName: "Isolation",
			firstName: "Test",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const submission = await db
		.insertInto("submission")
		.values({
			projectId: projectRowId,
			type: "individual",
			studentId: studentRow.rowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	return String(submission.id);
}

async function createTeamAndSubmission(
	db: Kysely<DB>,
	projectId: string,
	teamName: string,
	memberStudentId: string,
): Promise<string> {
	const projectRowId = await loadProjectPublicId(db, projectId);

	await db
		.insertInto("team")
		.values({ projectId: projectRowId, name: teamName })
		.execute();

	const team = await db
		.selectFrom("team")
		.select("id")
		.where("projectId", "=", projectRowId)
		.where("name", "=", teamName)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("student")
		.values({
			projectId: projectRowId,
			id: memberStudentId,
			lastName: "Team",
			firstName: "Member",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select("rowId")
		.where("projectId", "=", projectRowId)
		.where("id", "=", memberStudentId)
		.executeTakeFirstOrThrow();

	await db
		.insertInto("studentToTeam")
		.values({ studentId: studentRow.rowId, teamId: team.id })
		.execute();

	const submission = await db
		.insertInto("submission")
		.values({ projectId: projectRowId, type: "team", teamId: team.id })
		.returning("id")
		.executeTakeFirstOrThrow();

	return String(submission.id);
}

test("loadSubmissionsFromDb returns only individual submissions for the requested project when student ids collide across projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Isolation Project A");
	await using projectB = await createProject(db, "Isolation Project B");

	const sharedStudentId = "shared-student-iso-001";

	const submissionAId = await createStudentAndSubmission(
		db,
		projectA.id,
		sharedStudentId,
	);
	const submissionBId = await createStudentAndSubmission(
		db,
		projectB.id,
		sharedStudentId,
	);

	const { submissions: submissionsA } = await loadSubmissionsFromDb(db, {
		projectId: projectA.id,
	});
	const { submissions: submissionsB } = await loadSubmissionsFromDb(db, {
		projectId: projectB.id,
	});

	expect(submissionsA).toHaveLength(1);
	expect(submissionsB).toHaveLength(1);

	const subA = submissionsA[0];
	const subB = submissionsB[0];

	if (subA == null || subB == null) throw new Error("Expected submissions");

	expect(String(subA.id)).toBe(submissionAId);
	expect(String(subB.id)).toBe(submissionBId);
	expect(subA.id).not.toBe(subB.id);
});

test("loadSubmissions returns only team submissions for the requested project when team names collide across projects", async () => {
	await using db = await createTestDb();
	await using projectA = await createProject(db, "Team Isolation A");
	await using projectB = await createProject(db, "Team Isolation B");

	const sharedTeamName = "Shared Team Iso";

	const submissionAId = await createTeamAndSubmission(
		db,
		projectA.id,
		sharedTeamName,
		"team-member-proj-a",
	);
	const submissionBId = await createTeamAndSubmission(
		db,
		projectB.id,
		sharedTeamName,
		"team-member-proj-b",
	);

	const { submissions: submissionsA } = await loadSubmissionsFromDb(db, {
		projectId: projectA.id,
	});
	const { submissions: submissionsB } = await loadSubmissionsFromDb(db, {
		projectId: projectB.id,
	});

	expect(submissionsA).toHaveLength(1);
	expect(submissionsB).toHaveLength(1);

	const subA = submissionsA[0];
	const subB = submissionsB[0];

	if (subA == null || subB == null) throw new Error("Expected submissions");

	expect(subA.type).toBe("team");
	expect(String(subA.id)).toBe(submissionAId);
	expect(subB.type).toBe("team");
	expect(String(subB.id)).toBe(submissionBId);
	expect(subA.id).not.toBe(subB.id);
});

test("loadSubmissions wrapper delegates to its primitive and declares its cache tags", async () => {
	await using db = await createTestDb();
	await using project = await createProject(db, "Submissions Wrapper Project");
	const submissionId = await createStudentAndSubmission(
		db,
		project.id,
		"wrapper-student-001",
	);

	const submissions = await loadSubmissions({ projectId: project.id }, { db });

	expect(submissions.map((submission) => submission.id)).toEqual([
		submissionId,
	]);

	const declaredTags = vi.mocked(cacheTag).mock.calls.map((call) => call[0]);
	expect(declaredTags).toEqual(submissionsCacheTags());
});

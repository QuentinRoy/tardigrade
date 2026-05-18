import type { Kysely } from "kysely";
import { vi } from "vitest";
import { createIntegrationTest } from "../test/integrationTest";
import type { DB } from "./types";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  updateTag: vi.fn(),
}));

const { test, expect } = createIntegrationTest(import.meta.url);

async function createStudentAndSubmission(
  db: Kysely<DB>,
  projectId: number,
  studentId: string,
): Promise<string> {
  await db
    .insertInto("student")
    .values({
      projectId,
      id: studentId,
      lastName: "Isolation",
      firstName: "Test",
    })
    .execute();

  const studentRow = await db
    .selectFrom("student")
    .select("rowId")
    .where("projectId", "=", projectId)
    .where("id", "=", studentId)
    .executeTakeFirstOrThrow();

  const submission = await db
    .insertInto("submission")
    .values({
      projectId,
      type: "individual",
      studentId: studentRow.rowId,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return String(submission.id);
}

async function createTeamAndSubmission(
  db: Kysely<DB>,
  projectId: number,
  teamName: string,
  memberStudentId: string,
): Promise<string> {
  await db.insertInto("team").values({ projectId, name: teamName }).execute();

  const team = await db
    .selectFrom("team")
    .select("id")
    .where("projectId", "=", projectId)
    .where("name", "=", teamName)
    .executeTakeFirstOrThrow();

  await db
    .insertInto("student")
    .values({
      projectId,
      id: memberStudentId,
      lastName: "Team",
      firstName: "Member",
    })
    .execute();

  const studentRow = await db
    .selectFrom("student")
    .select("rowId")
    .where("projectId", "=", projectId)
    .where("id", "=", memberStudentId)
    .executeTakeFirstOrThrow();

  await db
    .insertInto("studentToTeam")
    .values({ studentId: studentRow.rowId, teamId: team.id })
    .execute();

  const submission = await db
    .insertInto("submission")
    .values({ projectId, type: "team", teamId: team.id })
    .returning("id")
    .executeTakeFirstOrThrow();

  return String(submission.id);
}

async function loadSubmissionsWithDb(db: Kysely<DB>, projectId: number) {
  vi.resetModules();
  vi.doMock("./kysely", () => ({ db }));
  const { loadSubmissions } = await import("./submissions");
  vi.doUnmock("./kysely");
  return loadSubmissions(projectId);
}

test("loadSubmissions returns only individual submissions for the requested project when student ids collide across projects", async ({
  db,
  createProject,
}) => {
  const projectAId = await createProject("Isolation Project A");
  const projectBId = await createProject("Isolation Project B");

  const sharedStudentId = "shared-student-iso-001";

  const submissionAId = await createStudentAndSubmission(
    db,
    projectAId,
    sharedStudentId,
  );
  const submissionBId = await createStudentAndSubmission(
    db,
    projectBId,
    sharedStudentId,
  );

  const submissionsA = await loadSubmissionsWithDb(db, projectAId);
  const submissionsB = await loadSubmissionsWithDb(db, projectBId);

  expect(submissionsA).toHaveLength(1);
  expect(submissionsB).toHaveLength(1);

  const subA = submissionsA[0];
  const subB = submissionsB[0];

  if (subA == null || subB == null) throw new Error("Expected submissions");

  expect(subA.id).toBe(submissionAId);
  expect(subB.id).toBe(submissionBId);
  expect(subA.id).not.toBe(subB.id);
});

test("loadSubmissions returns only team submissions for the requested project when team names collide across projects", async ({
  db,
  createProject,
}) => {
  const projectAId = await createProject("Team Isolation A");
  const projectBId = await createProject("Team Isolation B");

  const sharedTeamName = "Shared Team Iso";

  const submissionAId = await createTeamAndSubmission(
    db,
    projectAId,
    sharedTeamName,
    "team-member-proj-a",
  );
  const submissionBId = await createTeamAndSubmission(
    db,
    projectBId,
    sharedTeamName,
    "team-member-proj-b",
  );

  const submissionsA = await loadSubmissionsWithDb(db, projectAId);
  const submissionsB = await loadSubmissionsWithDb(db, projectBId);

  expect(submissionsA).toHaveLength(1);
  expect(submissionsB).toHaveLength(1);

  const subA = submissionsA[0];
  const subB = submissionsB[0];

  if (subA == null || subB == null) throw new Error("Expected submissions");

  expect(subA.type).toBe("team");
  expect(subA.id).toBe(submissionAId);
  expect(subB.type).toBe("team");
  expect(subB.id).toBe(submissionBId);
  expect(subA.id).not.toBe(subB.id);
});

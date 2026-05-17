import { vi } from "vitest";
import { createIntegrationTest } from "../test/integrationTest";
import type { NormalizedImportedSubmission } from "./types";

vi.mock("server-only", () => ({}));

const { test, expect } = createIntegrationTest(import.meta.url);

function makeSubmissions(
  sharedStudentId: string,
  sharedTeamName: string,
): NormalizedImportedSubmission[] {
  return [
    {
      id: `submission-${sharedStudentId}`,
      type: "individual",
      students: [
        {
          id: sharedStudentId,
          lastName: "Shared",
          firstName: "Student",
        },
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

test("saveStudents keeps imported student ids and team names isolated per project", async ({
  db,
  createProject,
}) => {
  vi.doMock("../db/kysely", () => ({ db }));
  const { saveStudents } = await import("./saveStudents");

  const projectAId = await createProject("Project A");
  const projectBId = await createProject("Project B");

  const sharedStudentId = "shared-student";
  const sharedTeamName = "Shared Team";

  const resultA = await saveStudents(
    makeSubmissions(sharedStudentId, sharedTeamName),
    projectAId,
  );
  const resultB = await saveStudents(
    makeSubmissions(sharedStudentId, sharedTeamName),
    projectBId,
  );

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

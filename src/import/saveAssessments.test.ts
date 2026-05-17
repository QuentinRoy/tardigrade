import { type Kysely } from "kysely";
import { vi } from "vitest";
import type { DB } from "../db/types";
import { buildTestId } from "../test/dbIntegration";
import { createIntegrationTest } from "../test/integrationTest";
import type { ImportedAssessmentRow } from "./types";

vi.mock("server-only", () => ({}));

const { test, expect } = createIntegrationTest(import.meta.url);

async function createAssessmentFixture(
  db: Kysely<DB>,
  projectId: number,
): Promise<{
  questionId: string;
  studentId: string;
  submissionId: string;
  rubricId: string;
}> {
  const questionId = buildTestId("question");
  const studentId = buildTestId("student");
  const rubricId = buildTestId("rubric");

  await db
    .insertInto("student")
    .values({
      projectId,
      id: studentId,
      lastName: "Import",
      firstName: "Student",
    })
    .execute();

  const studentRow = await db
    .selectFrom("student")
    .select(["rowId", "id"])
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

  await db
    .insertInto("question")
    .values({
      projectId,
      id: questionId,
      label: "Import question",
      position: 0,
    })
    .execute();

  await db
    .insertInto("rubric")
    .values({
      id: rubricId,
      projectId,
      questionId,
      type: "boolean",
      position: 0,
      label: "Correctness",
    })
    .execute();

  await db
    .insertInto("booleanRubric")
    .values({
      rubricId,
      marks: 2,
      falseMarks: 0,
    })
    .execute();

  return {
    questionId,
    studentId,
    submissionId: String(submission.id),
    rubricId,
  };
}

test("saveAssessments does not persist valid rows when a later row fails validation", async ({
  db,
  createProject,
}) => {
  vi.doMock("../db/kysely", () => ({ db }));
  const { saveAssessments } = await import("./saveAssessments");

  const projectId = await createProject("Atomic Import Project");
  const fixture = await createAssessmentFixture(db, projectId);

  const rows: ImportedAssessmentRow[] = [
    {
      submission_type: "individual",
      submitter: fixture.studentId,
      [`${fixture.questionId}:${fixture.rubricId}`]: "true",
    },
    {
      submission_type: "individual",
      submitter: fixture.studentId,
      [`${fixture.questionId}:${fixture.rubricId}`]: "not-a-boolean",
    },
  ];

  await expect(saveAssessments(rows, projectId)).rejects.toThrow(
    "Assessment import errors:",
  );

  const persistedAssessments = await db
    .selectFrom("assessment")
    .select("id")
    .where("projectId", "=", projectId)
    .execute();

  expect(persistedAssessments).toHaveLength(0);
});

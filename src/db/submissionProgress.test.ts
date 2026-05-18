import type { Kysely } from "kysely";
import { vi } from "vitest";
import { buildTestId } from "../test/dbIntegration";
import { createIntegrationTest } from "../test/integrationTest";
import type { DB } from "./types";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  updateTag: vi.fn(),
}));

const { test, expect } = createIntegrationTest(import.meta.url);

type ProjectFixture = {
  questionId: string;
  rubricRowId: number;
  submissionId: number;
};

async function createProgressFixture(
  db: Kysely<DB>,
  projectId: number,
  sharedQuestionId: string,
  sharedRubricId: string,
): Promise<ProjectFixture> {
  const studentId = buildTestId("student");

  await db
    .insertInto("student")
    .values({
      projectId,
      id: studentId,
      lastName: "Progress",
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
    .values({ projectId, type: "individual", studentId: studentRow.rowId })
    .returning("id")
    .executeTakeFirstOrThrow();

  await db
    .insertInto("question")
    .values({ projectId, id: sharedQuestionId, label: "Shared Q", position: 0 })
    .execute();

  const question = await db
    .selectFrom("question")
    .select(["rowId"])
    .where("projectId", "=", projectId)
    .where("id", "=", sharedQuestionId)
    .executeTakeFirstOrThrow();

  const rubricRows = await db
    .insertInto("rubric")
    .values({
      id: sharedRubricId,
      projectId,
      questionId: question.rowId,
      type: "boolean",
      position: 0,
      label: "Correct",
    })
    .returning(["rowId"])
    .execute();

  const rubric = rubricRows[0];
  if (rubric == null) throw new Error("Expected rubric row");

  await db
    .insertInto("booleanRubric")
    .values({ rubricId: rubric.rowId, marks: 1, falseMarks: 0 })
    .execute();

  return {
    questionId: sharedQuestionId,
    rubricRowId: rubric.rowId,
    submissionId: submission.id,
  };
}

async function addAssessment(
  db: Kysely<DB>,
  projectId: number,
  submissionId: number,
  questionRowId: number,
  rubricRowId: number,
): Promise<void> {
  const assessment = await db
    .insertInto("assessment")
    .values({ projectId, submissionId, questionId: questionRowId })
    .returning("id")
    .executeTakeFirstOrThrow();

  await db
    .insertInto("rubricAssessment")
    .values({
      assessmentId: assessment.id,
      rubricId: rubricRowId,
      type: "boolean",
    })
    .execute();

  const rubricAssessment = await db
    .selectFrom("rubricAssessment")
    .select("id")
    .where("assessmentId", "=", assessment.id)
    .where("rubricId", "=", rubricRowId)
    .executeTakeFirstOrThrow();

  await db
    .insertInto("booleanRubricAssessment")
    .values({ rubricAssessmentId: rubricAssessment.id, passed: true })
    .execute();
}

async function loadProgressWithDb(
  db: Kysely<DB>,
  questionId: string,
  projectId: number,
) {
  vi.resetModules();
  vi.doMock("./kysely", () => ({ db }));
  vi.doMock("next/cache", () => ({
    cacheTag: vi.fn(),
    cacheLife: vi.fn(),
    updateTag: vi.fn(),
  }));
  const { loadSubmissionQuestionProgress } = await import(
    "./submissionProgress"
  );
  vi.doUnmock("./kysely");
  return loadSubmissionQuestionProgress(questionId, projectId);
}

async function loadOverviewProgressWithDb(db: Kysely<DB>, projectId: number) {
  vi.resetModules();
  vi.doMock("./kysely", () => ({ db }));
  vi.doMock("next/cache", () => ({
    cacheTag: vi.fn(),
    cacheLife: vi.fn(),
    updateTag: vi.fn(),
  }));
  const { loadSubmissionOverviewProgress } = await import(
    "./submissionProgress"
  );
  vi.doUnmock("./kysely");
  return loadSubmissionOverviewProgress(projectId);
}

test("loadSubmissionQuestionProgress counts only assessments within the requested project when question ids collide across projects", async ({
  db,
  createProject,
}) => {
  const projectAId = await createProject("Progress Isolation A");
  const projectBId = await createProject("Progress Isolation B");

  const sharedQuestionId = "shared-q-progress-iso";
  const sharedRubricId = "shared-rubric-progress-iso";

  const fixtureA = await createProgressFixture(
    db,
    projectAId,
    sharedQuestionId,
    sharedRubricId,
  );
  const fixtureB = await createProgressFixture(
    db,
    projectBId,
    sharedQuestionId,
    sharedRubricId,
  );

  // Add assessment only for project B
  const questionBRow = await db
    .selectFrom("question")
    .select("rowId")
    .where("projectId", "=", projectBId)
    .where("id", "=", sharedQuestionId)
    .executeTakeFirstOrThrow();

  await addAssessment(
    db,
    projectBId,
    fixtureB.submissionId,
    questionBRow.rowId,
    fixtureB.rubricRowId,
  );

  const progressA = await loadProgressWithDb(db, sharedQuestionId, projectAId);
  const progressB = await loadProgressWithDb(db, sharedQuestionId, projectBId);

  const submissionAId = String(fixtureA.submissionId);
  const submissionBId = String(fixtureB.submissionId);

  // Project A submission has no assessment — should show 0 completed
  expect(progressA[submissionAId]).toEqual({ completed: 0, total: 1 });

  // Project B submission has a complete assessment — should show 1 completed
  expect(progressB[submissionBId]).toEqual({ completed: 1, total: 1 });

  // Project A result must not contain project B's submission id
  expect(progressA[submissionBId]).toBeUndefined();

  // Project B result must not contain project A's submission id
  expect(progressB[submissionAId]).toBeUndefined();
});

test("loadSubmissionOverviewProgress counts only questions and assessments within the requested project when question ids collide across projects", async ({
  db,
  createProject,
}) => {
  const projectAId = await createProject("Overview Progress Isolation A");
  const projectBId = await createProject("Overview Progress Isolation B");

  const sharedQuestionId = "shared-q-overview-iso";
  const sharedRubricId = "shared-rubric-overview-iso";

  const fixtureA = await createProgressFixture(
    db,
    projectAId,
    sharedQuestionId,
    sharedRubricId,
  );
  const fixtureB = await createProgressFixture(
    db,
    projectBId,
    sharedQuestionId,
    sharedRubricId,
  );

  // Add assessment only for project B
  const questionBRow = await db
    .selectFrom("question")
    .select("rowId")
    .where("projectId", "=", projectBId)
    .where("id", "=", sharedQuestionId)
    .executeTakeFirstOrThrow();

  await addAssessment(
    db,
    projectBId,
    fixtureB.submissionId,
    questionBRow.rowId,
    fixtureB.rubricRowId,
  );

  const overviewA = await loadOverviewProgressWithDb(db, projectAId);
  const overviewB = await loadOverviewProgressWithDb(db, projectBId);

  const submissionAId = String(fixtureA.submissionId);
  const submissionBId = String(fixtureB.submissionId);

  // Project A has 1 question, 0 completed for its submission
  expect(overviewA[submissionAId]).toEqual({ completed: 0, total: 1 });

  // Project B has 1 question, 1 completed for its submission
  expect(overviewB[submissionBId]).toEqual({ completed: 1, total: 1 });

  // Results must not bleed across projects
  expect(overviewA[submissionBId]).toBeUndefined();
  expect(overviewB[submissionAId]).toBeUndefined();
});

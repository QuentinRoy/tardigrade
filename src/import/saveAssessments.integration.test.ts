import { type Kysely } from "kysely";
import { expect, test, vi } from "vitest";
import type {
  SaveAssessmentParams,
  SaveAssessmentResult,
} from "../db/assessments";
import type { DB } from "../db/generated/db";
import { buildTestId, createTestDb } from "../test/dbIntegration";
import { createProject } from "../test/projects";
import type { ImportedAssessmentRow } from "./types";

vi.mock("server-only", () => ({}));

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

  const question = await db
    .selectFrom("question")
    .select(["id", "rowId"])
    .where("projectId", "=", projectId)
    .where("id", "=", questionId)
    .executeTakeFirstOrThrow();

  const rubric = await db
    .insertInto("rubric")
    .values({
      id: rubricId,
      projectId,
      questionId: question.rowId,
      type: "boolean",
      position: 0,
      label: "Correctness",
    })
    .returning(["id", "rowId"])
    .execute();

  const createdRubric = rubric[0];

  if (createdRubric == null) {
    throw new Error("Expected rubric row to be created for fixture setup.");
  }

  await db
    .insertInto("booleanRubric")
    .values({
      rubricId: createdRubric.rowId,
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

async function loadSaveAssessments(params: {
  db: Kysely<DB>;
  saveAssessmentWithDbMock?: (
    db: Kysely<DB>,
    input: SaveAssessmentParams,
  ) => Promise<SaveAssessmentResult>;
}): Promise<typeof import("./saveAssessments").saveAssessments> {
  vi.resetModules();
  vi.doMock("../db/kysely", () => ({ db: params.db }));

  if (params.saveAssessmentWithDbMock) {
    vi.doMock("../db/assessments", async () => {
      const actual =
        await vi.importActual<typeof import("../db/assessments")>(
          "../db/assessments",
        );

      return {
        ...actual,
        saveAssessmentWithDb: (
          queryDb: Kysely<DB>,
          input: SaveAssessmentParams,
        ) =>
          params.saveAssessmentWithDbMock?.(queryDb, input) ??
          Promise.resolve({ success: true }),
      };
    });
  } else {
    vi.doUnmock("../db/assessments");
  }

  const { saveAssessments } = await import("./saveAssessments");

  vi.doUnmock("../db/assessments");
  vi.doUnmock("../db/kysely");

  return saveAssessments;
}

test("saveAssessments does not persist valid rows when a later row fails validation", async () => {
  await using db = await createTestDb();
  const saveAssessments = await loadSaveAssessments({ db });

  await using project = await createProject(db, "Atomic Import Project");
  const projectPublicId = project.id;
  const fixture = await createAssessmentFixture(db, project.rowId);

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

  await expect(saveAssessments(rows, projectPublicId)).rejects.toThrow(
    "Assessment import errors:",
  );

  const persistedAssessments = await db
    .selectFrom("assessment")
    .select("id")
    .where("projectId", "=", project.rowId)
    .execute();

  expect(persistedAssessments).toHaveLength(0);
});

test("saveAssessments rejects unknown columns before writing any assessment", async () => {
  await using db = await createTestDb();
  const saveAssessments = await loadSaveAssessments({ db });

  await using project = await createProject(db, "Unknown Column Project");
  const projectPublicId = project.id;
  const fixture = await createAssessmentFixture(db, project.rowId);

  const rows: ImportedAssessmentRow[] = [
    {
      submission_type: "individual",
      submitter: fixture.studentId,
      unknown_column: "oops",
      [`${fixture.questionId}:${fixture.rubricId}`]: "true",
    },
  ];

  await expect(saveAssessments(rows, projectPublicId)).rejects.toThrow(
    'Unrecognized column: "unknown_column"',
  );

  const persistedAssessments = await db
    .selectFrom("assessment")
    .select("id")
    .where("projectId", "=", project.rowId)
    .execute();

  expect(persistedAssessments).toHaveLength(0);
});

test("saveAssessments skips rows with no matching submission mapping", async () => {
  await using db = await createTestDb();
  const saveAssessments = await loadSaveAssessments({ db });

  await using project = await createProject(db, "Missing Submitter Project");
  const projectPublicId = project.id;
  const fixture = await createAssessmentFixture(db, project.rowId);

  const rows: ImportedAssessmentRow[] = [
    {
      submission_type: "individual",
      submitter: buildTestId("missing-student"),
      [`${fixture.questionId}:${fixture.rubricId}`]: "true",
    },
  ];

  await expect(saveAssessments(rows, projectPublicId)).resolves.toEqual({
    assessmentCount: 0,
  });

  const persistedAssessments = await db
    .selectFrom("assessment")
    .select("id")
    .where("projectId", "=", project.rowId)
    .execute();

  expect(persistedAssessments).toHaveLength(0);
});

test("saveAssessments rolls back all writes if a later transactional write fails", async () => {
  await using db = await createTestDb();
  await using project = await createProject(
    db,
    "Transactional Rollback Project",
  );
  const projectPublicId = project.id;
  const fixture = await createAssessmentFixture(db, project.rowId);

  let callCount = 0;
  const saveAssessments = await loadSaveAssessments({
    db,
    saveAssessmentWithDbMock: async (queryDb, input) => {
      const actual =
        await vi.importActual<typeof import("../db/assessments")>(
          "../db/assessments",
        );

      callCount += 1;
      if (callCount === 2) {
        return {
          success: false,
          error: "Forced failure for rollback verification.",
        };
      }

      return actual.saveAssessmentWithDb(queryDb, input);
    },
  });

  const rows: ImportedAssessmentRow[] = [
    {
      submission_type: "individual",
      submitter: fixture.studentId,
      [`${fixture.questionId}:${fixture.rubricId}`]: "true",
    },
    {
      submission_type: "individual",
      submitter: fixture.studentId,
      [`${fixture.questionId}:${fixture.rubricId}`]: "false",
    },
  ];

  await expect(saveAssessments(rows, projectPublicId)).rejects.toThrow(
    "Forced failure for rollback verification.",
  );

  const persistedAssessments = await db
    .selectFrom("assessment")
    .select("id")
    .where("projectId", "=", project.rowId)
    .execute();

  expect(persistedAssessments).toHaveLength(0);
});

test("saveAssessments links assessments only to the target project even when the same student id exists in another project", async () => {
  await using db = await createTestDb();
  const saveAssessments = await loadSaveAssessments({ db });

  await using projectA = await createProject(db, "Cross-Project Isolation A");
  await using projectB = await createProject(db, "Cross-Project Isolation B");
  const projectBPublicId = projectB.id;

  // The same student external id exists in both projects.
  // Each project has its own question/rubric ids (to avoid saveAssessmentWithDb
  // ambiguity on shared question text ids, which is a separate concern).
  const sharedStudentId = "shared-student-cross-proj";

  async function buildFixtureInProject(projectId: number) {
    const questionId = buildTestId("question");
    const rubricId = buildTestId("rubric");

    await db
      .insertInto("student")
      .values({
        projectId,
        id: sharedStudentId,
        lastName: "CrossProj",
        firstName: "Student",
      })
      .execute();

    const studentRow = await db
      .selectFrom("student")
      .select("rowId")
      .where("projectId", "=", projectId)
      .where("id", "=", sharedStudentId)
      .executeTakeFirstOrThrow();

    await db
      .insertInto("submission")
      .values({ projectId, type: "individual", studentId: studentRow.rowId })
      .execute();

    await db
      .insertInto("question")
      .values({ projectId, id: questionId, label: "Q", position: 0 })
      .execute();

    const question = await db
      .selectFrom("question")
      .select("rowId")
      .where("projectId", "=", projectId)
      .where("id", "=", questionId)
      .executeTakeFirstOrThrow();

    const rubricRows = await db
      .insertInto("rubric")
      .values({
        id: rubricId,
        projectId,
        questionId: question.rowId,
        type: "boolean",
        position: 0,
        label: "Correct",
      })
      .returning("rowId")
      .execute();

    const rubric = rubricRows[0];
    if (rubric == null) throw new Error("Expected rubric row");

    await db
      .insertInto("booleanRubric")
      .values({ rubricId: rubric.rowId, marks: 1, falseMarks: 0 })
      .execute();

    return { questionId, rubricId };
  }

  // Build fixtures; only capture project B's ids for the import rows
  await buildFixtureInProject(projectA.rowId);
  const { questionId: questionBId, rubricId: rubricBId } =
    await buildFixtureInProject(projectB.rowId);

  // Import assessments targeting project B only using project B's rubric column
  const rows: ImportedAssessmentRow[] = [
    {
      submission_type: "individual",
      submitter: sharedStudentId,
      [`${questionBId}:${rubricBId}`]: "true",
    },
  ];

  await saveAssessments(rows, projectBPublicId);

  // Project A must have zero assessments
  const projectAAssessments = await db
    .selectFrom("assessment")
    .select("id")
    .where("projectId", "=", projectA.rowId)
    .execute();

  expect(projectAAssessments).toHaveLength(0);

  // Project B must have exactly one assessment
  const projectBAssessments = await db
    .selectFrom("assessment")
    .select("id")
    .where("projectId", "=", projectB.rowId)
    .execute();

  expect(projectBAssessments).toHaveLength(1);
});

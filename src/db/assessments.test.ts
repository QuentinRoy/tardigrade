import { type Kysely } from "kysely";
import { describe, vi } from "vitest";
import { buildTestId } from "../test/dbIntegration";
import { createIntegrationTest } from "../test/integrationTest";
import type { DB } from "./types";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  updateTag: vi.fn(),
}));

const { test, expect } = createIntegrationTest(import.meta.url);

type AssessmentFixture = {
  questionId: string;
  studentId: string;
  studentRowId: number;
  submissionId: string;
  rubricIds: {
    boolean: string;
    ordinal: string;
    numerical: string;
  };
};

async function createAssessmentFixture(
  db: Kysely<DB>,
  projectId: number,
): Promise<AssessmentFixture> {
  const questionId = buildTestId("q");
  const studentId = buildTestId("student");
  const booleanRubricId = buildTestId("rubric-boolean");
  const ordinalRubricId = buildTestId("rubric-ordinal");
  const numericalRubricId = buildTestId("rubric-numerical");

  await db
    .insertInto("student")
    .values({
      projectId,
      id: studentId,
      lastName: "Integration",
      firstName: "Test",
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
      label: "Integration question",
      position: 0,
    })
    .execute();

  const question = await db
    .selectFrom("question")
    .select(["id", "rowId"])
    .where("projectId", "=", projectId)
    .where("id", "=", questionId)
    .executeTakeFirstOrThrow();

  const insertedRubrics = await db
    .insertInto("rubric")
    .values([
      {
        id: booleanRubricId,
        projectId,
        questionId: question.rowId,
        type: "boolean",
        position: 0,
        label: "Boolean rubric",
      },
      {
        id: ordinalRubricId,
        projectId,
        questionId: question.rowId,
        type: "ordinal",
        position: 1,
        label: "Ordinal rubric",
      },
      {
        id: numericalRubricId,
        projectId,
        questionId: question.rowId,
        type: "numerical",
        position: 2,
        label: "Numerical rubric",
      },
    ])
    .returning(["id", "rowId"])
    .execute();

  const rubricRowIdById = new Map(
    insertedRubrics.map((rubric) => [rubric.id, rubric.rowId]),
  );

  const booleanRubricRowId = rubricRowIdById.get(booleanRubricId);
  const ordinalRubricRowId = rubricRowIdById.get(ordinalRubricId);
  const numericalRubricRowId = rubricRowIdById.get(numericalRubricId);

  if (
    booleanRubricRowId == null ||
    ordinalRubricRowId == null ||
    numericalRubricRowId == null
  ) {
    throw new Error("Expected inserted rubrics to be returned with row ids.");
  }

  await db
    .insertInto("booleanRubric")
    .values({
      rubricId: booleanRubricRowId,
      marks: 2,
    })
    .execute();

  const ordinalRubric = await db
    .insertInto("ordinalRubric")
    .values({
      rubricId: ordinalRubricRowId,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  await db
    .insertInto("ordinalRubricValue")
    .values([
      {
        ordinalRubricId: ordinalRubric.id,
        label: "A",
        marks: 3,
      },
      {
        ordinalRubricId: ordinalRubric.id,
        label: "B",
        marks: 1,
      },
    ])
    .execute();

  await db
    .insertInto("numericalRubric")
    .values({
      rubricId: numericalRubricRowId,
      minScore: 0,
      maxScore: 10,
      minMarks: 0,
      maxMarks: 5,
    })
    .execute();

  const fixture = {
    questionId,
    studentId,
    studentRowId: studentRow.rowId,
    submissionId: String(submission.id),
    rubricIds: {
      boolean: booleanRubricId,
      ordinal: ordinalRubricId,
      numerical: numericalRubricId,
    },
  };

  return fixture;
}

async function cleanupFixture(
  db: Kysely<DB>,
  fixture: AssessmentFixture,
): Promise<void> {
  await db
    .deleteFrom("submission")
    .where("id", "=", Number(fixture.submissionId))
    .execute();

  await db
    .deleteFrom("question")
    .where("id", "=", fixture.questionId)
    .execute();

  await db
    .deleteFrom("student")
    .where("rowId", "=", fixture.studentRowId)
    .execute();
}

describe("assessment DB integration", () => {
  test("round-trips boolean, ordinal and numerical assessments", async ({
    db,
    createProject,
  }) => {
    vi.doMock("./kysely", () => ({ db }));
    const { loadAssessment, saveAssessment } = await import("./assessments");
    const projectId = await createProject("Assessment Integration Project");
    const fixture = await createAssessmentFixture(db, projectId);

    try {
      const results = await Promise.all([
        saveAssessment({
          submissionId: fixture.submissionId,
          questionId: fixture.questionId,
          rubric: {
            rubricId: fixture.rubricIds.boolean,
            type: "boolean",
            passed: true,
          },
        }),
        saveAssessment({
          submissionId: fixture.submissionId,
          questionId: fixture.questionId,
          rubric: {
            rubricId: fixture.rubricIds.ordinal,
            type: "ordinal",
            selectedLabel: "B",
          },
        }),
        saveAssessment({
          submissionId: fixture.submissionId,
          questionId: fixture.questionId,
          rubric: {
            rubricId: fixture.rubricIds.numerical,
            type: "numerical",
            score: 7.5,
          },
        }),
      ]);

      expect(results).toEqual([
        { success: true },
        { success: true },
        { success: true },
      ]);

      const loaded = await loadAssessment(
        fixture.submissionId,
        fixture.questionId,
      );

      const byRubricId = new Map(
        loaded.map((value) => [value.rubricId, value]),
      );

      expect(byRubricId.get(fixture.rubricIds.boolean)).toEqual({
        rubricId: fixture.rubricIds.boolean,
        type: "boolean",
        passed: true,
      });

      expect(byRubricId.get(fixture.rubricIds.ordinal)).toEqual({
        rubricId: fixture.rubricIds.ordinal,
        type: "ordinal",
        selectedLabel: "B",
      });

      expect(byRubricId.get(fixture.rubricIds.numerical)).toEqual({
        rubricId: fixture.rubricIds.numerical,
        type: "numerical",
        score: 7.5,
      });
    } finally {
      await cleanupFixture(db, fixture);
    }
  });

  test("returns a validation error for invalid ordinal label", async ({
    db,
    createProject,
  }) => {
    vi.doMock("./kysely", () => ({ db }));
    const { saveAssessment } = await import("./assessments");
    const projectId = await createProject("Assessment Integration Project");
    const fixture = await createAssessmentFixture(db, projectId);

    try {
      const result = await saveAssessment({
        submissionId: fixture.submissionId,
        questionId: fixture.questionId,
        rubric: {
          rubricId: fixture.rubricIds.ordinal,
          type: "ordinal",
          selectedLabel: "Z",
        },
      });

      expect(result).toEqual({
        success: false,
        error: "Invalid ordinal value.",
      });
    } finally {
      await cleanupFixture(db, fixture);
    }
  });

  test("returns a validation error for out-of-range numerical score", async ({
    db,
    createProject,
  }) => {
    vi.doMock("./kysely", () => ({ db }));
    const { saveAssessment } = await import("./assessments");
    const projectId = await createProject("Assessment Integration Project");
    const fixture = await createAssessmentFixture(db, projectId);

    try {
      const result = await saveAssessment({
        submissionId: fixture.submissionId,
        questionId: fixture.questionId,
        rubric: {
          rubricId: fixture.rubricIds.numerical,
          type: "numerical",
          score: 11,
        },
      });

      expect(result).toEqual({
        success: false,
        error: "Score must be at most 10.",
      });
    } finally {
      await cleanupFixture(db, fixture);
    }
  });
});

import { vi } from "vitest";
import { createIntegrationTest } from "../test/integrationTest";
import type { ImportedQuestions } from "./types";

vi.mock("server-only", () => ({}));

const { test, expect } = createIntegrationTest(import.meta.url);

function makeQuestions(params: {
  questionLabel: string;
  rubricLabel: string;
}): ImportedQuestions {
  return [
    {
      id: "q1",
      label: params.questionLabel,
      rubrics: [
        {
          id: "r1",
          type: "boolean",
          label: params.rubricLabel,
          marks: 2,
          falseMarks: 0,
        },
      ],
    },
  ];
}

test("saveQuestions allows the same question and rubric ids in different projects", async ({
  db,
  createProject,
}) => {
  vi.doMock("../db/kysely", () => ({ db }));
  const { saveQuestions } = await import("./saveQuestions");

  const projectAId = await createProject("Import Project A");
  const projectBId = await createProject("Import Project B");

  const resultA = await saveQuestions(
    makeQuestions({
      questionLabel: "Question A",
      rubricLabel: "Rubric A",
    }),
    projectAId,
  );

  const resultB = await saveQuestions(
    makeQuestions({
      questionLabel: "Question B",
      rubricLabel: "Rubric B",
    }),
    projectBId,
  );

  expect(resultA).toEqual({ questionCount: 1, rubricCount: 1 });
  expect(resultB).toEqual({ questionCount: 1, rubricCount: 1 });

  const questions = await db
    .selectFrom("question")
    .select(["projectId", "id", "label"])
    .where("id", "=", "q1")
    .orderBy("projectId", "asc")
    .execute();

  expect(questions).toHaveLength(2);
  expect(questions[0]?.label).toBe("Question A");
  expect(questions[1]?.label).toBe("Question B");

  const rubrics = await db
    .selectFrom("rubric")
    .select(["projectId", "id", "label"])
    .where("id", "=", "r1")
    .orderBy("projectId", "asc")
    .execute();

  expect(rubrics).toHaveLength(2);
  expect(rubrics[0]?.label).toBe("Rubric A");
  expect(rubrics[1]?.label).toBe("Rubric B");
});

test("saveQuestions updates only the target project rows", async ({
  db,
  createProject,
}) => {
  vi.doMock("../db/kysely", () => ({ db }));
  const { saveQuestions } = await import("./saveQuestions");

  const projectAId = await createProject("Isolation Project A");
  const projectBId = await createProject("Isolation Project B");

  await saveQuestions(
    makeQuestions({
      questionLabel: "A initial",
      rubricLabel: "A rubric initial",
    }),
    projectAId,
  );

  await saveQuestions(
    makeQuestions({
      questionLabel: "B initial",
      rubricLabel: "B rubric initial",
    }),
    projectBId,
  );

  await saveQuestions(
    makeQuestions({
      questionLabel: "A updated",
      rubricLabel: "A rubric updated",
    }),
    projectAId,
  );

  const questionA = await db
    .selectFrom("question")
    .select(["label"])
    .where("projectId", "=", projectAId)
    .where("id", "=", "q1")
    .executeTakeFirstOrThrow();

  const questionB = await db
    .selectFrom("question")
    .select(["label"])
    .where("projectId", "=", projectBId)
    .where("id", "=", "q1")
    .executeTakeFirstOrThrow();

  const rubricA = await db
    .selectFrom("rubric")
    .select(["label"])
    .where("projectId", "=", projectAId)
    .where("id", "=", "r1")
    .executeTakeFirstOrThrow();

  const rubricB = await db
    .selectFrom("rubric")
    .select(["label"])
    .where("projectId", "=", projectBId)
    .where("id", "=", "r1")
    .executeTakeFirstOrThrow();

  expect(questionA.label).toBe("A updated");
  expect(questionB.label).toBe("B initial");
  expect(rubricA.label).toBe("A rubric updated");
  expect(rubricB.label).toBe("B rubric initial");
});

test("saveQuestions still upserts duplicate ids within the same project", async ({
  db,
  createProject,
}) => {
  vi.doMock("../db/kysely", () => ({ db }));
  const { saveQuestions } = await import("./saveQuestions");

  const projectId = await createProject("Single Project Upsert");

  await saveQuestions(
    makeQuestions({
      questionLabel: "Before",
      rubricLabel: "Rubric before",
    }),
    projectId,
  );

  await saveQuestions(
    makeQuestions({
      questionLabel: "After",
      rubricLabel: "Rubric after",
    }),
    projectId,
  );

  const questions = await db
    .selectFrom("question")
    .select(["id", "label"])
    .where("projectId", "=", projectId)
    .where("id", "=", "q1")
    .execute();

  const rubrics = await db
    .selectFrom("rubric")
    .select(["id", "label"])
    .where("projectId", "=", projectId)
    .where("id", "=", "r1")
    .execute();

  expect(questions).toHaveLength(1);
  expect(rubrics).toHaveLength(1);
  expect(questions[0]?.label).toBe("After");
  expect(rubrics[0]?.label).toBe("Rubric after");
});

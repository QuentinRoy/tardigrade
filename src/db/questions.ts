import "server-only";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { QuestionsValidationError } from "@/questions/errors";
import { db } from "./kysely";
import type { Grid, Question, Rubric, RubricType } from "./types";

function toNumber(value: string | number): number {
  if (typeof value === "number") return value;
  return parseFloat(value);
}

function toRubric(data: {
  id: string;
  type: RubricType;
  description: string | null;
  label: string | null;
  booleanRubric: { marks: number; falseMarks: number } | null;
  ordinalRubric: { marks: { label: string; marks: number }[] } | null;
  numericalRubric: {
    minScore: number;
    maxScore: number;
    minMarks: number;
    maxMarks: number;
    reversed: boolean;
  } | null;
}): Rubric {
  if (data.type === "ordinal" && data.ordinalRubric) {
    const marks = Object.fromEntries(
      data.ordinalRubric.marks.map((item) => [
        item.label,
        toNumber(item.marks),
      ]),
    );
    return {
      id: data.id,
      description: data.description ?? undefined,
      label: data.label ?? undefined,
      type: "ordinal",
      marks,
    };
  }

  if (data.type === "numerical" && data.numericalRubric) {
    return {
      id: data.id,
      description: data.description ?? undefined,
      label: data.label ?? undefined,
      type: "numerical",
      minScore: toNumber(data.numericalRubric.minScore),
      maxScore: toNumber(data.numericalRubric.maxScore),
      minMarks: toNumber(data.numericalRubric.minMarks),
      maxMarks: toNumber(data.numericalRubric.maxMarks),
      reversed: data.numericalRubric.reversed,
    };
  }

  return {
    id: data.id,
    description: data.description ?? undefined,
    label: data.label ?? undefined,
    type: "boolean",
    marks: data.booleanRubric ? toNumber(data.booleanRubric.marks) : 0,
    falseMarks: data.booleanRubric
      ? toNumber(data.booleanRubric.falseMarks)
      : 0,
  };
}

type QuestionRow = {
  id: string;
  label: string | null;
  rubrics: {
    id: string;
    type: RubricType;
    description: string | null;
    label: string | null;
    booleanRubric: { marks: number; falseMarks: number } | null;
    ordinalRubric: { marks: { label: string; marks: number }[] } | null;
    numericalRubric: {
      minScore: number;
      maxScore: number;
      minMarks: number;
      maxMarks: number;
      reversed: boolean;
    } | null;
  }[];
};

async function loadQuestionsFromDb(): Promise<QuestionRow[]> {
  "use cache";
  cacheTag("questions");
  cacheLife({ revalidate: 60 * 60 });

  const [questions, rubrics, booleanRubrics, numericalRubrics, ordinalMarks] =
    await Promise.all([
      db
        .selectFrom("question")
        .select(["id", "label", "position"])
        .orderBy("position", "asc")
        .execute(),
      db
        .selectFrom("rubric")
        .select([
          "id",
          "questionId",
          "position",
          "description",
          "label",
          "type",
        ])
        .orderBy("position", "asc")
        .execute(),
      db
        .selectFrom("booleanRubric")
        .select(["rubricId", "marks", "falseMarks"])
        .execute(),
      db
        .selectFrom("numericalRubric")
        .select([
          "rubricId",
          "minScore",
          "maxScore",
          "minMarks",
          "maxMarks",
          "reversed",
        ])
        .execute(),
      db
        .selectFrom("ordinalRubric")
        .innerJoin(
          "ordinalRubricValue",
          "ordinalRubricValue.ordinalRubricId",
          "ordinalRubric.id",
        )
        .select([
          "ordinalRubric.rubricId as rubricId",
          "ordinalRubricValue.label as label",
          "ordinalRubricValue.marks as marks",
        ])
        .orderBy("ordinalRubricValue.marks", "desc")
        .orderBy("ordinalRubricValue.label", "asc")
        .execute(),
    ]);

  const booleanRubricById = new Map(
    booleanRubrics.map((row) => [
      row.rubricId,
      { marks: toNumber(row.marks), falseMarks: toNumber(row.falseMarks) },
    ]),
  );

  const numericalRubricById = new Map(
    numericalRubrics.map((row) => [
      row.rubricId,
      {
        minScore: toNumber(row.minScore),
        maxScore: toNumber(row.maxScore),
        minMarks: toNumber(row.minMarks),
        maxMarks: toNumber(row.maxMarks),
        reversed: row.reversed,
      },
    ]),
  );

  const ordinalMarksByRubricId = new Map<
    string,
    { label: string; marks: number }[]
  >();
  for (const row of ordinalMarks) {
    const list = ordinalMarksByRubricId.get(row.rubricId) ?? [];
    list.push({ label: row.label, marks: toNumber(row.marks) });
    ordinalMarksByRubricId.set(row.rubricId, list);
  }

  const rubricsByQuestionId = new Map<
    string,
    Array<{
      id: string;
      questionId: string;
      description: string | null;
      label: string | null;
      type: RubricType;
    }>
  >();
  for (const rubric of rubrics) {
    const list = rubricsByQuestionId.get(rubric.questionId) ?? [];
    list.push(rubric);
    rubricsByQuestionId.set(rubric.questionId, list);
  }

  return questions.map((question) => {
    const questionRubrics = rubricsByQuestionId.get(question.id) ?? [];

    return {
      id: question.id,
      label: question.label,
      rubrics: questionRubrics.map((rubric) => ({
        id: rubric.id,
        type: rubric.type,
        description: rubric.description,
        label: rubric.label,
        booleanRubric: booleanRubricById.get(rubric.id) ?? null,
        ordinalRubric: ordinalMarksByRubricId.has(rubric.id)
          ? { marks: ordinalMarksByRubricId.get(rubric.id) ?? [] }
          : null,
        numericalRubric: numericalRubricById.get(rubric.id) ?? null,
      })),
    };
  });
}

export async function loadQuestions(): Promise<Grid> {
  "use cache";
  cacheTag("questions");

  const rows = await loadQuestionsFromDb();

  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        label: row.label ?? undefined,
        rubrics: row.rubrics.map(toRubric),
      },
    ]),
  );
}

export async function loadQuestion(
  questionId: string,
): Promise<Question | undefined> {
  const rows = await loadQuestionsFromDb();
  const row = rows.find((item) => item.id === questionId);

  if (row == null) {
    return undefined;
  }

  return {
    label: row.label ?? undefined,
    rubrics: row.rubrics.map(toRubric),
  };
}

export type ManagedRubricInput =
  | {
      previousId?: string;
      id: string;
      description?: string;
      label?: string;
      type: "boolean";
      marks: number;
      falseMarks?: number;
    }
  | {
      previousId?: string;
      id: string;
      description?: string;
      label?: string;
      type: "ordinal";
      marks: Record<string, number>;
    }
  | {
      previousId?: string;
      id: string;
      description?: string;
      label?: string;
      type: "numerical";
      minScore: number;
      maxScore: number;
      minMarks: number;
      maxMarks: number;
      reversed: boolean;
    };

export type ManagedQuestionInput = {
  originalId?: string;
  id: string;
  label?: string;
  rubrics: ManagedRubricInput[];
};

export type ManagedQuestionSummary = {
  id: string;
  label?: string;
  position: number;
  assessmentCount: number;
  rubricCount: number;
};

export type ManagedQuestionDetails = ManagedQuestionSummary & {
  question: Question;
};

type NormalizedRubricRow = {
  sourceId: string;
  id: string;
  questionId: string;
  position: number;
  description: string | null;
  label: string | null;
  type: RubricType;
};

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (trimmed == null || trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function toManagedRubricRows(
  questionId: string,
  rubrics: ManagedRubricInput[],
): NormalizedRubricRow[] {
  return rubrics.map((rubric, position) => ({
    sourceId: rubric.previousId?.trim() || rubric.id,
    id: rubric.id,
    questionId,
    position,
    description: normalizeOptionalText(rubric.description),
    label: normalizeOptionalText(rubric.label),
    type: rubric.type,
  }));
}

function assertUniqueIds(label: string, ids: string[]): void {
  const counts = new Map<string, number[]>();

  ids.forEach((id, index) => {
    const key = id.trim();
    if (key.length === 0) {
      return;
    }

    const indexes = counts.get(key) ?? [];
    indexes.push(index);
    counts.set(key, indexes);
  });

  const duplicateIndexes = [...counts.values()].filter(
    (indexes) => indexes.length > 1,
  );
  if (duplicateIndexes.length === 0) {
    return;
  }

  const rubrics = ids.map(() => ({}) as { id?: string });
  for (const indexes of duplicateIndexes) {
    for (const index of indexes) {
      rubrics[index] = {
        id: `${label} must be unique.`,
      };
    }
  }

  throw new QuestionsValidationError({
    fieldErrors: { rubrics },
  });
}

export async function loadManagedQuestions(): Promise<
  ManagedQuestionDetails[]
> {
  const [rows, counts] = await Promise.all([
    loadQuestionsFromDb(),
    db
      .selectFrom("assessment")
      .select(({ fn }) => [
        "questionId",
        fn.count<number>("assessment.id").as("assessmentCount"),
      ])
      .groupBy("questionId")
      .execute(),
  ]);

  const assessmentCountByQuestionId = new Map(
    counts.map((count) => [count.questionId, Number(count.assessmentCount)]),
  );

  return rows.map((row, position) => ({
    id: row.id,
    label: row.label ?? undefined,
    position,
    assessmentCount: assessmentCountByQuestionId.get(row.id) ?? 0,
    rubricCount: row.rubrics.length,
    question: {
      label: row.label ?? undefined,
      rubrics: row.rubrics.map(toRubric),
    },
  }));
}

export async function getQuestionDeleteImpact(questionId: string): Promise<{
  assessmentCount: number;
}> {
  const row = await db
    .selectFrom("assessment")
    .select(({ fn }) => [fn.count<number>("id").as("assessmentCount")])
    .where("questionId", "=", questionId)
    .executeTakeFirst();

  return {
    assessmentCount: Number(row?.assessmentCount ?? 0),
  };
}

export async function saveManagedQuestion(
  input: ManagedQuestionInput,
): Promise<{ id: string }> {
  const requestedId = input.id.trim();
  const originalId = input.originalId?.trim() || requestedId;

  if (requestedId.length === 0) {
    throw new Error("Question id is required.");
  }

  assertUniqueIds(
    "Rubric ids",
    input.rubrics.map((rubric) => rubric.id),
  );

  const normalizedRubrics = toManagedRubricRows(requestedId, input.rubrics);
  assertUniqueIds(
    "Rubric source ids",
    normalizedRubrics.map((rubric) => rubric.sourceId),
  );

  await db.transaction().execute(async (tx) => {
    const existingQuestion = await tx
      .selectFrom("question")
      .select(["id", "position"])
      .where("id", "=", originalId)
      .executeTakeFirst();

    const conflictingQuestion =
      originalId !== requestedId
        ? await tx
            .selectFrom("question")
            .select("id")
            .where("id", "=", requestedId)
            .executeTakeFirst()
        : null;

    if (conflictingQuestion != null) {
      throw new QuestionsValidationError({
        fieldErrors: {
          questionId: `Question id '${requestedId}' already exists.`,
        },
      });
    }

    if (existingQuestion == null) {
      const row = await tx
        .selectFrom("question")
        .select(({ fn }) => [fn.max<number>("position").as("maxPosition")])
        .executeTakeFirst();
      const nextPosition = (row?.maxPosition ?? -1) + 1;

      await tx
        .insertInto("question")
        .values({
          id: requestedId,
          label: normalizeOptionalText(input.label),
          position: nextPosition,
        })
        .execute();
    } else {
      await tx
        .updateTable("question")
        .set({
          id: requestedId,
          label: normalizeOptionalText(input.label),
        })
        .where("id", "=", originalId)
        .execute();
    }

    const existingRubrics = await tx
      .selectFrom("rubric")
      .select(["id", "type"])
      .where("questionId", "=", requestedId)
      .execute();

    const existingById = new Map(existingRubrics.map((row) => [row.id, row]));
    const referencedSourceIds = new Set(
      normalizedRubrics.map((rubric) => rubric.sourceId),
    );

    const staleRubricIds = existingRubrics
      .filter((rubric) => !referencedSourceIds.has(rubric.id))
      .map((rubric) => rubric.id);

    if (staleRubricIds.length > 0) {
      await tx.deleteFrom("rubric").where("id", "in", staleRubricIds).execute();
    }

    for (const rubric of normalizedRubrics) {
      const existing = existingById.get(rubric.sourceId);

      if (existing == null) {
        await tx
          .insertInto("rubric")
          .values({
            id: rubric.id,
            questionId: requestedId,
            position: rubric.position,
            description: rubric.description,
            label: rubric.label,
            type: rubric.type,
          })
          .execute();
        continue;
      }

      const isTypeChanged = existing.type !== rubric.type;
      if (isTypeChanged) {
        await tx.deleteFrom("rubric").where("id", "=", existing.id).execute();
        await tx
          .insertInto("rubric")
          .values({
            id: rubric.id,
            questionId: requestedId,
            position: rubric.position,
            description: rubric.description,
            label: rubric.label,
            type: rubric.type,
          })
          .execute();
        continue;
      }

      await tx
        .updateTable("rubric")
        .set({
          id: rubric.id,
          questionId: requestedId,
          position: rubric.position,
          description: rubric.description,
          label: rubric.label,
          type: rubric.type,
        })
        .where("id", "=", existing.id)
        .execute();
    }

    const booleanRows = input.rubrics.flatMap((rubric) =>
      rubric.type === "boolean"
        ? [
            {
              rubricId: rubric.id,
              marks: rubric.marks,
              falseMarks: rubric.falseMarks ?? 0,
            },
          ]
        : [],
    );
    const numericalRows = input.rubrics.flatMap((rubric) =>
      rubric.type === "numerical"
        ? [
            {
              rubricId: rubric.id,
              minScore: rubric.minScore,
              maxScore: rubric.maxScore,
              minMarks: rubric.minMarks,
              maxMarks: rubric.maxMarks,
              reversed: rubric.reversed,
            },
          ]
        : [],
    );
    const ordinalSources = input.rubrics.flatMap((rubric) =>
      rubric.type === "ordinal"
        ? [{ rubricId: rubric.id, marks: rubric.marks }]
        : [],
    );

    if (booleanRows.length > 0) {
      await tx
        .insertInto("booleanRubric")
        .values(booleanRows)
        .onConflict((conflict) =>
          conflict.column("rubricId").doUpdateSet((eb) => ({
            marks: eb.ref("excluded.marks"),
            falseMarks: eb.ref("excluded.falseMarks"),
          })),
        )
        .execute();
    }

    if (numericalRows.length > 0) {
      await tx
        .insertInto("numericalRubric")
        .values(numericalRows)
        .onConflict((conflict) =>
          conflict.column("rubricId").doUpdateSet((eb) => ({
            minScore: eb.ref("excluded.minScore"),
            maxScore: eb.ref("excluded.maxScore"),
            minMarks: eb.ref("excluded.minMarks"),
            maxMarks: eb.ref("excluded.maxMarks"),
            reversed: eb.ref("excluded.reversed"),
          })),
        )
        .execute();
    }

    if (ordinalSources.length > 0) {
      await tx
        .insertInto("ordinalRubric")
        .values(ordinalSources.map((source) => ({ rubricId: source.rubricId })))
        .onConflict((conflict) => conflict.column("rubricId").doNothing())
        .execute();

      const ordinalRubrics = await tx
        .selectFrom("ordinalRubric")
        .select(["id", "rubricId"])
        .where(
          "rubricId",
          "in",
          ordinalSources.map((source) => source.rubricId),
        )
        .execute();

      const ordinalRubricIdByRubricId = new Map(
        ordinalRubrics.map((row) => [row.rubricId, row.id]),
      );
      const ordinalRubricIds = ordinalRubrics.map((row) => row.id);

      const existingOrdinalValues =
        ordinalRubricIds.length === 0
          ? []
          : await tx
              .selectFrom("ordinalRubricValue")
              .select(["id", "ordinalRubricId", "label"])
              .where("ordinalRubricId", "in", ordinalRubricIds)
              .execute();

      const validKeys = new Set(
        ordinalSources.flatMap((source) => {
          const ordinalRubricId = ordinalRubricIdByRubricId.get(
            source.rubricId,
          );
          if (ordinalRubricId == null) {
            return [];
          }

          return Object.keys(source.marks).map(
            (label) => `${ordinalRubricId}::${label}`,
          );
        }),
      );

      const staleIds = existingOrdinalValues
        .filter(
          (value) => !validKeys.has(`${value.ordinalRubricId}::${value.label}`),
        )
        .map((value) => value.id);

      if (staleIds.length > 0) {
        await tx
          .deleteFrom("ordinalRubricValue")
          .where("id", "in", staleIds)
          .execute();
      }

      const ordinalValueRows = ordinalSources.flatMap((source) => {
        const ordinalRubricId = ordinalRubricIdByRubricId.get(source.rubricId);
        if (ordinalRubricId == null) {
          return [];
        }

        return Object.entries(source.marks).map(([label, marks]) => ({
          ordinalRubricId,
          label,
          marks,
        }));
      });

      if (ordinalValueRows.length > 0) {
        await tx
          .insertInto("ordinalRubricValue")
          .values(ordinalValueRows)
          .onConflict((conflict) =>
            conflict
              .columns(["ordinalRubricId", "label"])
              .doUpdateSet((eb) => ({
                marks: eb.ref("excluded.marks"),
              })),
          )
          .execute();
      }
    }
  });

  updateTag("questions");
  updateTag("assessments");
  updateTag("assessments:all");
  updateTag(`assessments:question:${requestedId}`);
  if (originalId !== requestedId) {
    updateTag(`assessments:question:${originalId}`);
  }

  return { id: requestedId };
}

export async function deleteManagedQuestion(
  questionId: string,
): Promise<{ assessmentCount: number }> {
  const impact = await getQuestionDeleteImpact(questionId);

  await db.deleteFrom("question").where("id", "=", questionId).execute();

  updateTag("questions");
  updateTag("assessments");
  updateTag("assessments:all");
  updateTag(`assessments:question:${questionId}`);

  return impact;
}

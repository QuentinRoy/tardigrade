import "server-only";
import { sql } from "kysely";
import { cacheLife } from "next/cache";
import { QuestionsValidationError } from "@/questions/errors";
import { CACHE_TAGS, cacheTags, updateTags } from "./cacheTags";
import { db } from "./kysely";
import { withProjectScope } from "./projectScope";
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

async function loadQuestionsFromDb(projectId?: number): Promise<QuestionRow[]> {
  "use cache";
  cacheTags(CACHE_TAGS.questions);
  cacheLife({ revalidate: 60 * 60 });

  const buildQuestionRows = (
    questions: Array<{ id: string; label: string | null }>,
    rubrics: Array<{
      id: string;
      questionId: string;
      description: string | null;
      label: string | null;
      type: RubricType;
    }>,
    booleanRubrics: Array<{
      rubricId: string;
      marks: number;
      falseMarks: number;
    }>,
    numericalRubrics: Array<{
      rubricId: string;
      minScore: number;
      maxScore: number;
      minMarks: number;
      maxMarks: number;
      reversed: boolean;
    }>,
    ordinalMarks: Array<{
      rubricId: string;
      label: string;
      marks: number;
    }>,
  ): QuestionRow[] => {
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
  };

  if (projectId != null) {
    const [questions, rubrics, booleanRubrics, numericalRubrics, ordinalMarks] =
      await Promise.all([
        db
          .selectFrom("question")
          .where("question.projectId", "=", projectId)
          .select(["id", "label", "position"])
          .orderBy("position", "asc")
          .execute(),
        db
          .selectFrom("rubric")
          .innerJoin("question", "question.rowId", "rubric.questionId")
          .where("rubric.projectId", "=", projectId)
          .select([
            "rubric.id as id",
            "question.id as questionId",
            "rubric.position as position",
            "rubric.description as description",
            "rubric.label as label",
            "rubric.type as type",
          ])
          .orderBy("rubric.position", "asc")
          .execute(),
        db
          .selectFrom("booleanRubric")
          .innerJoin("rubric", "rubric.rowId", "booleanRubric.rubricId")
          .where("rubric.projectId", "=", projectId)
          .select([
            "rubric.id as rubricId",
            "booleanRubric.marks as marks",
            "booleanRubric.falseMarks as falseMarks",
          ])
          .execute(),
        db
          .selectFrom("numericalRubric")
          .innerJoin("rubric", "rubric.rowId", "numericalRubric.rubricId")
          .where("rubric.projectId", "=", projectId)
          .select([
            "rubric.id as rubricId",
            "numericalRubric.minScore as minScore",
            "numericalRubric.maxScore as maxScore",
            "numericalRubric.minMarks as minMarks",
            "numericalRubric.maxMarks as maxMarks",
            "numericalRubric.reversed as reversed",
          ])
          .execute(),
        db
          .selectFrom("ordinalRubric")
          .innerJoin(
            "ordinalRubricValue",
            "ordinalRubricValue.ordinalRubricId",
            "ordinalRubric.id",
          )
          .innerJoin("rubric", "rubric.rowId", "ordinalRubric.rubricId")
          .where("rubric.projectId", "=", projectId)
          .select([
            "rubric.id as rubricId",
            "ordinalRubricValue.label as label",
            "ordinalRubricValue.marks as marks",
          ])
          .orderBy("ordinalRubricValue.marks", "desc")
          .orderBy("ordinalRubricValue.label", "asc")
          .execute(),
      ]);

    return buildQuestionRows(
      questions,
      rubrics,
      booleanRubrics,
      numericalRubrics,
      ordinalMarks,
    );
  }

  const [questions, rubrics, booleanRubrics, numericalRubrics, ordinalMarks] =
    await Promise.all([
      db
        .selectFrom("question")
        .select(["id", "label", "position"])
        .orderBy("position", "asc")
        .execute(),
      db
        .selectFrom("rubric")
        .innerJoin("question", "question.rowId", "rubric.questionId")
        .select([
          "rubric.id as id",
          "question.id as questionId",
          "rubric.position as position",
          "rubric.description as description",
          "rubric.label as label",
          "rubric.type as type",
        ])
        .orderBy("rubric.position", "asc")
        .execute(),
      db
        .selectFrom("booleanRubric")
        .innerJoin("rubric", "rubric.rowId", "booleanRubric.rubricId")
        .select([
          "rubric.id as rubricId",
          "booleanRubric.marks as marks",
          "booleanRubric.falseMarks as falseMarks",
        ])
        .execute(),
      db
        .selectFrom("numericalRubric")
        .innerJoin("rubric", "rubric.rowId", "numericalRubric.rubricId")
        .select([
          "rubric.id as rubricId",
          "numericalRubric.minScore as minScore",
          "numericalRubric.maxScore as maxScore",
          "numericalRubric.minMarks as minMarks",
          "numericalRubric.maxMarks as maxMarks",
          "numericalRubric.reversed as reversed",
        ])
        .execute(),
      db
        .selectFrom("ordinalRubric")
        .innerJoin(
          "ordinalRubricValue",
          "ordinalRubricValue.ordinalRubricId",
          "ordinalRubric.id",
        )
        .innerJoin("rubric", "rubric.rowId", "ordinalRubric.rubricId")
        .select([
          "rubric.id as rubricId",
          "ordinalRubricValue.label as label",
          "ordinalRubricValue.marks as marks",
        ])
        .orderBy("ordinalRubricValue.marks", "desc")
        .orderBy("ordinalRubricValue.label", "asc")
        .execute(),
    ]);

  return buildQuestionRows(
    questions,
    rubrics,
    booleanRubrics,
    numericalRubrics,
    ordinalMarks,
  );
}

export async function loadQuestions(projectId?: number): Promise<Grid> {
  "use cache";
  cacheTags(CACHE_TAGS.questions);

  const rows = await loadQuestionsFromDb(projectId);

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
  projectId?: number,
): Promise<Question | undefined> {
  const rows = await loadQuestionsFromDb(projectId);
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
  rubrics: ManagedRubricInput[],
): NormalizedRubricRow[] {
  return rubrics.map((rubric, position) => ({
    sourceId: rubric.previousId?.trim() || rubric.id,
    id: rubric.id,
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

export async function loadManagedQuestions(
  projectId?: number,
): Promise<ManagedQuestionDetails[]> {
  const countsQuery = db
    .selectFrom("assessment")
    .innerJoin("question", "question.rowId", "assessment.questionId")
    .select(({ fn }) => [
      "question.id as questionId",
      fn.count<number>("assessment.id").as("assessmentCount"),
    ])
    .groupBy("question.id");

  const [rows, counts] = await Promise.all([
    loadQuestionsFromDb(projectId),
    projectId != null
      ? countsQuery.where("assessment.projectId", "=", projectId).execute()
      : countsQuery.execute(),
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

export async function getQuestionDeleteImpact(
  questionId: string,
  projectId?: number,
): Promise<{
  assessmentCount: number;
}> {
  let query = db
    .selectFrom("assessment")
    .innerJoin("question", "question.rowId", "assessment.questionId")
    .select(({ fn }) => [fn.count<number>("id").as("assessmentCount")])
    .where("question.id", "=", questionId);

  if (projectId != null) {
    query = query.where("assessment.projectId", "=", projectId);
  }

  const row = await query.executeTakeFirst();

  return {
    assessmentCount: Number(row?.assessmentCount ?? 0),
  };
}

export async function saveManagedQuestion(
  input: ManagedQuestionInput,
  projectId?: number,
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

  const normalizedRubrics = toManagedRubricRows(input.rubrics);
  assertUniqueIds(
    "Rubric source ids",
    normalizedRubrics.map((rubric) => rubric.sourceId),
  );

  await db.transaction().execute(async (tx) => {
    const scopedExistingQuestion = await tx
      .selectFrom("question")
      .select(["id", "position", "rowId"])
      .where("id", "=", originalId)
      .$if(projectId != null, (query) =>
        query.where("question.projectId", "=", projectId as number),
      )
      .executeTakeFirst();

    const conflictingQuestion =
      originalId !== requestedId
        ? await tx
            .selectFrom("question")
            .select("id")
            .where("id", "=", requestedId)
            .$if(projectId != null, (query) =>
              query.where("question.projectId", "=", projectId as number),
            )
            .executeTakeFirst()
        : null;

    if (conflictingQuestion != null) {
      throw new QuestionsValidationError({
        fieldErrors: {
          questionId: `Question id '${requestedId}' already exists.`,
        },
      });
    }

    if (scopedExistingQuestion == null) {
      const row = await tx
        .selectFrom("question")
        .select(({ fn }) => [fn.max<number>("position").as("maxPosition")])
        .$if(projectId != null, (query) =>
          query.where("question.projectId", "=", projectId as number),
        )
        .executeTakeFirst();
      const nextPosition = (row?.maxPosition ?? -1) + 1;

      await tx
        .insertInto("question")
        .values({
          id: requestedId,
          label: normalizeOptionalText(input.label),
          position: nextPosition,
          projectId,
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
        .$if(projectId != null, (query) =>
          query.where("question.projectId", "=", projectId as number),
        )
        .execute();
    }

    const persistedQuestion = await tx
      .selectFrom("question")
      .select(["id", "rowId"])
      .where("id", "=", requestedId)
      .$if(projectId != null, (query) =>
        query.where("question.projectId", "=", projectId as number),
      )
      .executeTakeFirstOrThrow();

    let existingRubricsQuery = tx
      .selectFrom("rubric")
      .select(["id", "type", "rowId"])
      .where("questionId", "=", persistedQuestion.rowId);

    if (projectId != null) {
      existingRubricsQuery = existingRubricsQuery.where(
        "rubric.projectId",
        "=",
        projectId,
      );
    }

    const existingRubrics = await existingRubricsQuery.execute();

    const existingById = new Map(existingRubrics.map((row) => [row.id, row]));
    const referencedSourceIds = new Set(
      normalizedRubrics.map((rubric) => rubric.sourceId),
    );

    const staleRubricIds = existingRubrics
      .filter((rubric) => !referencedSourceIds.has(rubric.id))
      .map((rubric) => rubric.rowId);

    if (staleRubricIds.length > 0) {
      await tx
        .deleteFrom("rubric")
        .where("rowId", "in", staleRubricIds)
        .$if(projectId != null, (query) =>
          query.where("rubric.projectId", "=", projectId as number),
        )
        .execute();
    }

    for (const rubric of normalizedRubrics) {
      const existing = existingById.get(rubric.sourceId);

      if (existing == null) {
        await tx
          .insertInto("rubric")
          .values({
            id: rubric.id,
            questionId: persistedQuestion.rowId,
            position: rubric.position,
            description: rubric.description,
            label: rubric.label,
            projectId,
            type: rubric.type,
          })
          .execute();
        continue;
      }

      const isTypeChanged = existing.type !== rubric.type;
      if (isTypeChanged) {
        await tx
          .deleteFrom("rubric")
          .where("rowId", "=", existing.rowId)
          .$if(projectId != null, (query) =>
            query.where("rubric.projectId", "=", projectId as number),
          )
          .execute();
        await tx
          .insertInto("rubric")
          .values({
            id: rubric.id,
            questionId: persistedQuestion.rowId,
            position: rubric.position,
            description: rubric.description,
            label: rubric.label,
            projectId,
            type: rubric.type,
          })
          .execute();
        continue;
      }

      await tx
        .updateTable("rubric")
        .set({
          id: rubric.id,
          questionId: persistedQuestion.rowId,
          position: rubric.position,
          description: rubric.description,
          label: rubric.label,
          projectId,
          type: rubric.type,
        })
        .where("rowId", "=", existing.rowId)
        .$if(projectId != null, (query) =>
          query.where("rubric.projectId", "=", projectId as number),
        )
        .execute();
    }

    const rubricRows = await tx
      .selectFrom("rubric")
      .select(["id", "rowId"])
      .where(
        "id",
        "in",
        input.rubrics.map((rubric) => rubric.id),
      )
      .where("questionId", "=", persistedQuestion.rowId)
      .$if(projectId != null, (query) =>
        query.where("rubric.projectId", "=", projectId as number),
      )
      .execute();

    const rubricRowIdById = new Map(
      rubricRows.map((rubric) => [rubric.id, rubric.rowId]),
    );

    const booleanRows = input.rubrics.flatMap((rubric) =>
      rubric.type === "boolean"
        ? (() => {
            const rubricRowId = rubricRowIdById.get(rubric.id);
            if (rubricRowId == null) {
              throw new Error(`Rubric '${rubric.id}' could not be resolved.`);
            }

            return [
              {
                rubricId: rubricRowId,
                marks: rubric.marks,
                falseMarks: rubric.falseMarks ?? 0,
              },
            ];
          })()
        : [],
    );
    const numericalRows = input.rubrics.flatMap((rubric) =>
      rubric.type === "numerical"
        ? (() => {
            const rubricRowId = rubricRowIdById.get(rubric.id);
            if (rubricRowId == null) {
              throw new Error(`Rubric '${rubric.id}' could not be resolved.`);
            }

            return [
              {
                rubricId: rubricRowId,
                minScore: rubric.minScore,
                maxScore: rubric.maxScore,
                minMarks: rubric.minMarks,
                maxMarks: rubric.maxMarks,
                reversed: rubric.reversed,
              },
            ];
          })()
        : [],
    );
    const ordinalSources = input.rubrics.flatMap((rubric) =>
      rubric.type === "ordinal"
        ? (() => {
            const rubricRowId = rubricRowIdById.get(rubric.id);
            if (rubricRowId == null) {
              throw new Error(`Rubric '${rubric.id}' could not be resolved.`);
            }

            return [{ rubricId: rubricRowId, marks: rubric.marks }];
          })()
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

  updateTags(
    CACHE_TAGS.questions,
    CACHE_TAGS.assessments,
    CACHE_TAGS.assessmentsAll,
    `assessments:question:${requestedId}`,
  );
  if (originalId !== requestedId) {
    updateTags(`assessments:question:${originalId}`);
  }

  return { id: requestedId };
}

export async function deleteManagedQuestion(
  questionId: string,
  projectId?: number,
): Promise<{ assessmentCount: number }> {
  const impact = await getQuestionDeleteImpact(questionId, projectId);

  let query = db.deleteFrom("question").where("id", "=", questionId);

  if (projectId != null) {
    query = query.where("question.projectId", "=", projectId);
  }

  await query.execute();

  updateTags(
    CACHE_TAGS.questions,
    CACHE_TAGS.assessments,
    CACHE_TAGS.assessmentsAll,
    `assessments:question:${questionId}`,
  );

  return impact;
}

export async function reorderQuestions(
  updates: Array<{ id: string; position: number }>,
  projectId?: number,
): Promise<void> {
  if (updates.length === 0) {
    return;
  }

  const questionIds = updates.map((u) => u.id);
  const conditions = updates.map(
    ({ id, position }) =>
      sql`when ${sql.ref("id")} = ${sql.lit(id)} then ${sql.lit(position)}`,
  );

  await db
    .updateTable("question")
    .set({
      position: sql`case ${sql.join(conditions, sql` `)} end`,
    })
    .where("id", "in", questionIds)
    .$if(projectId != null, (query) =>
      query.where("question.projectId", "=", projectId as number),
    )
    .execute();

  updateTags(CACHE_TAGS.questions);
}

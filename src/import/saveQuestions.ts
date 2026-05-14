import "server-only";
import { db } from "../db/kysely";
import type { ImportedQuestions } from "./types";

export async function saveQuestions(questions: ImportedQuestions): Promise<{
  questionCount: number;
  rubricCount: number;
}> {
  const questionsById = questions.map((question, position) => ({
    id: question.id,
    label: question.label ?? null,
    position,
  }));

  const rubricRows = questions.flatMap((question) =>
    question.rubrics.map((rubric, position) => ({
      id: rubric.id,
      questionId: question.id,
      position,
      description: rubric.description ?? null,
      label: rubric.label ?? null,
      type: rubric.type,
    })),
  );

  const booleanRubricRows = questions.flatMap((question) =>
    question.rubrics.flatMap((rubric) =>
      rubric.type === "boolean"
        ? [
            {
              rubricId: rubric.id,
              marks: rubric.marks,
              falseMarks: rubric.falseMarks ?? 0,
            },
          ]
        : [],
    ),
  );

  const numericalRubricRows = questions.flatMap((question) =>
    question.rubrics.flatMap((rubric) =>
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
    ),
  );

  const ordinalRubricSources = questions.flatMap((question) =>
    question.rubrics.flatMap((rubric) =>
      rubric.type === "ordinal"
        ? [
            {
              rubricId: rubric.id,
              marks: rubric.marks,
            },
          ]
        : [],
    ),
  );

  const questionIds = questionsById.map((question) => question.id);
  const rubricIds = rubricRows.map((rubric) => rubric.id);
  const rubricTypeById = new Map(
    rubricRows.map((rubric) => [rubric.id, rubric.type]),
  );

  return db.transaction().execute(async (tx) => {
    const existingRubrics =
      rubricIds.length === 0
        ? []
        : await tx
            .selectFrom("rubric")
            .select(["id", "type"])
            .where("id", "in", rubricIds)
            .execute();

    const rubricsToRecreate = existingRubrics.flatMap((rubric) => {
      const nextType = rubricTypeById.get(rubric.id);

      if (nextType == null || nextType === rubric.type) {
        return [];
      }

      return [rubric.id];
    });

    if (rubricsToRecreate.length > 0) {
      await tx
        .deleteFrom("rubric")
        .where("id", "in", rubricsToRecreate)
        .execute();
    }

    if (questionsById.length > 0) {
      await tx
        .insertInto("question")
        .values(questionsById)
        .onConflict((conflict) =>
          conflict.column("id").doUpdateSet((expressionBuilder) => ({
            label: expressionBuilder.ref("excluded.label"),
            position: expressionBuilder.ref("excluded.position"),
          })),
        )
        .execute();
    }

    if (rubricRows.length > 0) {
      await tx
        .insertInto("rubric")
        .values(
          rubricRows.map((rubric) => ({
            id: rubric.id,
            questionId: rubric.questionId,
            position: rubric.position,
            description: rubric.description,
            label: rubric.label,
            type: rubric.type,
          })),
        )
        .onConflict((conflict) =>
          conflict.column("id").doUpdateSet((expressionBuilder) => ({
            questionId: expressionBuilder.ref("excluded.questionId"),
            position: expressionBuilder.ref("excluded.position"),
            description: expressionBuilder.ref("excluded.description"),
            label: expressionBuilder.ref("excluded.label"),
            type: expressionBuilder.ref("excluded.type"),
          })),
        )
        .execute();
    }

    if (booleanRubricRows.length > 0) {
      await tx
        .insertInto("booleanRubric")
        .values(booleanRubricRows)
        .onConflict((conflict) =>
          conflict.column("rubricId").doUpdateSet((expressionBuilder) => ({
            marks: expressionBuilder.ref("excluded.marks"),
            falseMarks: expressionBuilder.ref("excluded.falseMarks"),
          })),
        )
        .execute();
    }

    if (numericalRubricRows.length > 0) {
      await tx
        .insertInto("numericalRubric")
        .values(numericalRubricRows)
        .onConflict((conflict) =>
          conflict.column("rubricId").doUpdateSet((expressionBuilder) => ({
            minScore: expressionBuilder.ref("excluded.minScore"),
            maxScore: expressionBuilder.ref("excluded.maxScore"),
            minMarks: expressionBuilder.ref("excluded.minMarks"),
            maxMarks: expressionBuilder.ref("excluded.maxMarks"),
            reversed: expressionBuilder.ref("excluded.reversed"),
          })),
        )
        .execute();
    }

    if (ordinalRubricSources.length > 0) {
      await tx
        .insertInto("ordinalRubric")
        .values(
          ordinalRubricSources.map((source) => ({ rubricId: source.rubricId })),
        )
        .onConflict((conflict) => conflict.column("rubricId").doNothing())
        .execute();

      const upsertedOrdinalRubrics = await tx
        .selectFrom("ordinalRubric")
        .select(["id", "rubricId"])
        .where(
          "rubricId",
          "in",
          ordinalRubricSources.map((source) => source.rubricId),
        )
        .execute();

      const ordinalRubricIdByRubricId = new Map(
        upsertedOrdinalRubrics.map((row) => [row.rubricId, row.id]),
      );

      const ordinalRubricIds = upsertedOrdinalRubrics.map((row) => row.id);

      const validPairKeys = new Set(
        ordinalRubricSources.flatMap((source) => {
          const ordinalRubricId = ordinalRubricIdByRubricId.get(
            source.rubricId,
          );
          if (ordinalRubricId == null) return [];

          return Object.keys(source.marks).map(
            (label) => `${ordinalRubricId}::${label}`,
          );
        }),
      );

      const existingOrdinalValues =
        ordinalRubricIds.length === 0
          ? []
          : await tx
              .selectFrom("ordinalRubricValue")
              .select(["id", "ordinalRubricId", "label"])
              .where("ordinalRubricId", "in", ordinalRubricIds)
              .execute();

      const staleOrdinalValueIds = existingOrdinalValues
        .filter(
          (value) =>
            !validPairKeys.has(`${value.ordinalRubricId}::${value.label}`),
        )
        .map((value) => value.id);

      if (staleOrdinalValueIds.length > 0) {
        await tx
          .deleteFrom("ordinalRubricValue")
          .where("id", "in", staleOrdinalValueIds)
          .execute();
      }

      const ordinalValueRows = ordinalRubricSources.flatMap((source) => {
        const ordinalRubricId = ordinalRubricIdByRubricId.get(source.rubricId);
        if (ordinalRubricId == null) return [];

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
              .doUpdateSet((expressionBuilder) => ({
                marks: expressionBuilder.ref("excluded.marks"),
              })),
          )
          .execute();
      }
    }

    return {
      questionCount: questionIds.length,
      rubricCount: rubricIds.length,
    };
  });
}

import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { toRubricType } from "./saveUtils";
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
    rubricRows.map((rubric) => [rubric.id, toRubricType(rubric.type)]),
  );

  return prisma.$transaction(async (tx) => {
    const existingRubrics = await tx.rubric.findMany({
      where: { id: { in: rubricIds } },
      select: {
        id: true,
        type: true,
      },
    });

    const rubricsToRecreate = existingRubrics.flatMap((rubric) => {
      const nextType = rubricTypeById.get(rubric.id);

      if (nextType == null || nextType === rubric.type) {
        return [];
      }

      return [rubric.id];
    });

    if (rubricsToRecreate.length > 0) {
      await tx.rubric.deleteMany({
        where: { id: { in: rubricsToRecreate } },
      });
    }

    await Promise.all(
      questionsById.map((question) =>
        tx.question.upsert({
          where: { id: question.id },
          create: question,
          update: {
            label: question.label,
            position: question.position,
          },
        }),
      ),
    );

    await Promise.all(
      rubricRows.map((rubric) =>
        tx.rubric.upsert({
          where: { id: rubric.id },
          create: {
            id: rubric.id,
            questionId: rubric.questionId,
            position: rubric.position,
            description: rubric.description,
            label: rubric.label,
            type: toRubricType(rubric.type),
          },
          update: {
            questionId: rubric.questionId,
            position: rubric.position,
            description: rubric.description,
            label: rubric.label,
            type: toRubricType(rubric.type),
          },
        }),
      ),
    );

    await Promise.all([
      ...booleanRubricRows.map((booleanRubric) =>
        tx.booleanRubric.upsert({
          where: { rubricId: booleanRubric.rubricId },
          create: {
            rubricId: booleanRubric.rubricId,
            marks: new Prisma.Decimal(booleanRubric.marks),
          },
          update: {
            marks: new Prisma.Decimal(booleanRubric.marks),
          },
        }),
      ),
      ...numericalRubricRows.map((numericalRubric) =>
        tx.numericalRubric.upsert({
          where: { rubricId: numericalRubric.rubricId },
          create: {
            rubricId: numericalRubric.rubricId,
            minScore: new Prisma.Decimal(numericalRubric.minScore),
            maxScore: new Prisma.Decimal(numericalRubric.maxScore),
            minMarks: new Prisma.Decimal(numericalRubric.minMarks),
            maxMarks: new Prisma.Decimal(numericalRubric.maxMarks),
          },
          update: {
            minScore: new Prisma.Decimal(numericalRubric.minScore),
            maxScore: new Prisma.Decimal(numericalRubric.maxScore),
            minMarks: new Prisma.Decimal(numericalRubric.minMarks),
            maxMarks: new Prisma.Decimal(numericalRubric.maxMarks),
          },
        }),
      ),
    ]);

    const upsertedOrdinalRubrics = await Promise.all(
      ordinalRubricSources.map((source) =>
        tx.ordinalRubric.upsert({
          where: { rubricId: source.rubricId },
          create: { rubricId: source.rubricId },
          update: {},
          select: { id: true, rubricId: true },
        }),
      ),
    );

    const ordinalRubricIdByRubricId = new Map(
      upsertedOrdinalRubrics.map((r) => [r.rubricId, r.id]),
    );

    if (ordinalRubricSources.length > 0) {
      const ordinalRubricCuids = upsertedOrdinalRubrics.map((r) => r.id);

      const validPairs = ordinalRubricSources.flatMap((source) => {
        const ordinalRubricId = ordinalRubricIdByRubricId.get(source.rubricId);
        if (ordinalRubricId == null) return [];

        return Object.keys(source.marks).map((label) => ({
          AND: [{ ordinalRubricId }, { label }],
        }));
      });

      await Promise.all([
        tx.ordinalRubricValue.deleteMany({
          where: {
            ordinalRubricId: { in: ordinalRubricCuids },
            NOT: { OR: validPairs },
          },
        }),
        ...ordinalRubricSources.flatMap((source) => {
          const ordinalRubricId = ordinalRubricIdByRubricId.get(
            source.rubricId,
          );
          if (ordinalRubricId == null) return [];

          return Object.entries(source.marks).map(([label, mark]) =>
            tx.ordinalRubricValue.upsert({
              where: {
                ordinalRubricId_label: { ordinalRubricId, label },
              },
              create: {
                ordinalRubricId,
                label,
                marks: new Prisma.Decimal(mark),
              },
              update: {
                marks: new Prisma.Decimal(mark),
              },
            }),
          );
        }),
      ]);
    }

    return {
      questionCount: questionIds.length,
      rubricCount: rubricIds.length,
    };
  });
}

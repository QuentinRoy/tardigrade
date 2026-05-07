import { type Prisma, RubricType } from "@prisma/client";
import { cacheLife, cacheTag } from "next/cache";

import { prisma } from "./prisma";
import type { Rubric } from "./rubric";

export type { Rubric } from "./rubric";

export type Question = {
  label?: string;
  rubrics: Rubric[];
  solution?: string;
};

export type Grid = {
  [id: string]: Question;
};

function toNumber(value: Prisma.Decimal | number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (typeof (value as { toNumber?: unknown }).toNumber === "function") {
    return (value as Prisma.Decimal).toNumber();
  }
  return parseFloat(String(value));
}

function toRubric(data: {
  id: string;
  type: RubricType;
  description: string | null;
  label: string | null;
  booleanRubric: { marks: number } | null;
  ordinalRubric: { values: { label: string; score: number }[] } | null;
  numericalRubric: { min: number; max: number } | null;
}): Rubric {
  if (data.type === RubricType.ORDINAL && data.ordinalRubric) {
    const values = Object.fromEntries(
      data.ordinalRubric.values.map((item) => [item.label, item.score]),
    );
    return {
      id: data.id,
      description: data.description ?? undefined,
      label: data.label ?? undefined,
      type: "ordinal",
      values,
    };
  }

  if (data.type === RubricType.NUMERICAL && data.numericalRubric) {
    return {
      id: data.id,
      description: data.description ?? undefined,
      label: data.label ?? undefined,
      type: "numerical",
      min: toNumber(data.numericalRubric.min),
      max: toNumber(data.numericalRubric.max),
    };
  }

  return {
    id: data.id,
    description: data.description ?? undefined,
    label: data.label ?? undefined,
    type: "boolean",
    marks: data.booleanRubric ? toNumber(data.booleanRubric.marks) : 0,
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
    booleanRubric: { marks: number } | null;
    ordinalRubric: { values: { label: string; score: number }[] } | null;
    numericalRubric: { min: number; max: number } | null;
  }[];
};

async function loadQuestionsFromDb(): Promise<QuestionRow[]> {
  "use cache";
  cacheTag("questions");
  cacheLife({ revalidate: 60 * 60 });

  const rows = await prisma.question.findMany({
    select: {
      id: true,
      label: true,
      rubrics: {
        select: {
          id: true,
          type: true,
          description: true,
          label: true,
          booleanRubric: { select: { marks: true } },
          ordinalRubric: {
            select: {
              values: {
                select: { label: true, score: true },
                orderBy: [
                  { score: "desc" as const },
                  { label: "asc" as const },
                ],
              },
            },
          },
          numericalRubric: { select: { min: true, max: true } },
        },
        orderBy: { position: "asc" as const },
      },
    },
    orderBy: { position: "asc" as const },
  });

  return rows.map((question) => ({
    id: question.id,
    label: question.label,
    rubrics: question.rubrics.map((rubric) => {
      const ordinalValues =
        rubric.ordinalRubric?.values.map((item) => ({
          label: item.label,
          score: toNumber(item.score),
        })) ?? [];

      return {
        id: rubric.id,
        type: rubric.type,
        description: rubric.description,
        label: rubric.label,
        booleanRubric: rubric.booleanRubric
          ? { marks: toNumber(rubric.booleanRubric.marks) }
          : null,
        ordinalRubric: rubric.ordinalRubric ? { values: ordinalValues } : null,
        numericalRubric:
          rubric.numericalRubric && rubric.numericalRubric.min
            ? {
                min: toNumber(rubric.numericalRubric.min),
                max: toNumber(rubric.numericalRubric.max),
              }
            : null,
      };
    }),
  }));
}

export default async function loadQuestions(): Promise<Grid> {
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

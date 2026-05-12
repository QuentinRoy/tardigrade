import { type Prisma, RubricType } from "@prisma/client";
import { cacheLife, cacheTag } from "next/cache";

import { prisma } from "../db/prisma";
import type { Rubric } from "../rubrics/rubric";

export type { Rubric } from "../rubrics/rubric";

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
  ordinalRubric: { marks: { label: string; score: number }[] } | null;
  numericalRubric: {
    minScore: number;
    maxScore: number;
    minMarks: number;
    maxMarks: number;
  } | null;
}): Rubric {
  if (data.type === RubricType.ORDINAL && data.ordinalRubric) {
    const marks = Object.fromEntries(
      data.ordinalRubric.marks.map((item) => [item.label, item.score]),
    );
    return {
      id: data.id,
      description: data.description ?? undefined,
      label: data.label ?? undefined,
      type: "ordinal",
      marks,
    };
  }

  if (data.type === RubricType.NUMERICAL && data.numericalRubric) {
    return {
      id: data.id,
      description: data.description ?? undefined,
      label: data.label ?? undefined,
      type: "numerical",
      minScore: toNumber(data.numericalRubric.minScore),
      maxScore: toNumber(data.numericalRubric.maxScore),
      minMarks: toNumber(data.numericalRubric.minMarks),
      maxMarks: toNumber(data.numericalRubric.maxMarks),
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
    ordinalRubric: { marks: { label: string; score: number }[] } | null;
    numericalRubric: {
      minScore: number;
      maxScore: number;
      minMarks: number;
      maxMarks: number;
    } | null;
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
              marks: {
                select: { label: true, score: true },
                orderBy: [
                  { score: "desc" as const },
                  { label: "asc" as const },
                ],
              },
            },
          },
          numericalRubric: {
            select: {
              minScore: true,
              maxScore: true,
              minMarks: true,
              maxMarks: true,
            },
          },
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
      const ordinalMarkEntries =
        rubric.ordinalRubric?.marks.map((item) => ({
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
        ordinalRubric: rubric.ordinalRubric
          ? { marks: ordinalMarkEntries }
          : null,
        numericalRubric:
          rubric.numericalRubric != null
            ? {
                minScore: toNumber(rubric.numericalRubric.minScore),
                maxScore: toNumber(rubric.numericalRubric.maxScore),
                minMarks: toNumber(rubric.numericalRubric.minMarks),
                maxMarks: toNumber(rubric.numericalRubric.maxMarks),
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

import { type Prisma, RubricKind } from "@prisma/client";
import { cacheLife, cacheTag } from "next/cache";

import { prisma } from "./prisma";

export type Rubric =
  | {
      id: string;
      label: string;
      marks: number;
      type: "boolean";
    }
  | {
      id: string;
      label: string;
      marks: number;
      type: "ordinal";
      values: (string | number)[];
    }
  | {
      id: string;
      label: string;
      marks: number;
      type: "numerical";
    };

export type Question = {
  label?: string;
  rubrics: Rubric[];
  solution?: string;
};

export type Grid = {
  [id: string]: Question;
};

type DbQuestion = {
  externalId: string;
  label: string;
  rubrics: {
    id: string;
    kind: RubricKind;
    label: string;
    maxMarks: number;
    config: Prisma.JsonValue;
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: Prisma.Decimal | number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (typeof (value as { toNumber?: unknown }).toNumber === "function") {
    return (value as Prisma.Decimal).toNumber();
  }
  return parseFloat(String(value));
}

function toRubric(rubric: {
  id: string;
  kind: RubricKind;
  label: string;
  maxMarks: number;
  config: Prisma.JsonValue;
}): Rubric {
  const marks = toNumber(rubric.maxMarks);

  if (rubric.kind === RubricKind.ORDINAL) {
    const config = isRecord(rubric.config) ? rubric.config : {};
    const values = Array.isArray(config.values)
      ? config.values.filter(
          (value): value is string | number =>
            typeof value === "string" || typeof value === "number",
        )
      : [];
    return {
      id: rubric.id,
      label: rubric.label,
      marks,
      type: "ordinal",
      values,
    };
  }

  if (rubric.kind === RubricKind.NUMERICAL) {
    return {
      id: rubric.id,
      label: rubric.label,
      marks,
      type: "numerical",
    };
  }

  return {
    id: rubric.id,
    label: rubric.label,
    marks,
    type: "boolean",
  };
}

async function loadQuestionsFromDb(): Promise<DbQuestion[]> {
  "use cache";
  cacheTag("questions");
  cacheLife({ revalidate: 60 * 60 });
  const rows = await prisma.question.findMany({
    include: {
      rubrics: {
        orderBy: {
          position: "asc",
        },
      },
    },
    orderBy: {
      position: "asc",
    },
  });
  return rows.map((q) => ({
    externalId: q.externalId,
    label: q.label,
    rubrics: q.rubrics.map((r) => ({
      id: r.id,
      kind: r.kind,
      label: r.label,
      maxMarks: toNumber(r.maxMarks),
      config: r.config,
    })),
  }));
}

function toQuestion(question: DbQuestion): Question {
  return {
    label: question.label,
    rubrics: question.rubrics.map(toRubric),
  };
}

export default async function loadQuestions(): Promise<Grid> {
  const questions = await loadQuestionsFromDb();

  const grid: Grid = Object.fromEntries(
    questions.map((question) => [question.externalId, toQuestion(question)]),
  );

  return grid;
}

export async function loadQuestion(
  questionId: string,
): Promise<Question | undefined> {
  const questions = await loadQuestionsFromDb();
  const question = questions.find((item) => item.externalId === questionId);

  if (question == null) {
    return undefined;
  }

  return toQuestion(question);
}

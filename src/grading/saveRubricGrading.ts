"use server";

import { RubricType } from "@prisma/client";
import { updateTag } from "next/cache";
import { prisma } from "../db/prisma";

export type SaveRubricGradingResult =
  | { success: true }
  | { success: false; error: string };

export async function saveRubricGrading({
  paperId,
  questionId,
  rubricId,
  grading,
}: {
  paperId: string; // id
  questionId: string; // id
  rubricId: string; // id
  grading: string | number | boolean;
}): Promise<SaveRubricGradingResult> {
  const [paper, question, rubric] = await Promise.all([
    prisma.paper.findUnique({ where: { id: paperId } }),
    prisma.question.findUnique({ where: { id: questionId } }),
    prisma.rubric.findUnique({
      where: { id: rubricId },
      include: {
        ordinalRubric: {
          select: {
            marks: {
              select: {
                label: true,
              },
            },
          },
        },
        numericalRubric: {
          select: { minScore: true, maxScore: true },
        },
      },
    }),
  ]);

  if (paper == null || question == null) {
    return { success: false, error: "Paper or question not found." };
  }

  if (rubric == null || rubric.questionId !== question.id) {
    return { success: false, error: "Rubric not found." };
  }

  const assessment = await prisma.assessment.upsert({
    where: {
      paperId_questionId: { paperId: paper.id, questionId: question.id },
    },
    create: { paperId: paper.id, questionId: question.id },
    update: {},
  });

  const rubricScore = await prisma.rubricScore.upsert({
    where: {
      assessmentId_rubricId: {
        assessmentId: assessment.id,
        rubricId,
      },
    },
    create: {
      assessmentId: assessment.id,
      rubricId,
      type:
        rubric.type === RubricType.BOOLEAN
          ? RubricType.BOOLEAN
          : rubric.type === RubricType.ORDINAL
            ? RubricType.ORDINAL
            : RubricType.NUMERICAL,
    },
    update: {
      type:
        rubric.type === RubricType.BOOLEAN
          ? RubricType.BOOLEAN
          : rubric.type === RubricType.ORDINAL
            ? RubricType.ORDINAL
            : RubricType.NUMERICAL,
    },
  });

  if (rubric.type === RubricType.BOOLEAN) {
    if (typeof grading !== "boolean") {
      return { success: false, error: "Invalid boolean value." };
    }
    await Promise.all([
      prisma.booleanRubricScore.upsert({
        where: { rubricScoreId: rubricScore.id },
        create: {
          rubricScoreId: rubricScore.id,
          passed: grading,
        },
        update: { passed: grading },
      }),
      prisma.ordinalRubricScore.deleteMany({
        where: { rubricScoreId: rubricScore.id },
      }),
      prisma.numericalRubricScore.deleteMany({
        where: { rubricScoreId: rubricScore.id },
      }),
    ]);
  } else if (rubric.type === RubricType.ORDINAL) {
    if (typeof grading !== "string") {
      return { success: false, error: "Invalid ordinal value." };
    }

    const allowedValues =
      rubric.ordinalRubric?.marks.map((item) => item.label) ?? [];

    if (!allowedValues.includes(grading)) {
      return { success: false, error: "Invalid ordinal value." };
    }

    await Promise.all([
      prisma.ordinalRubricScore.upsert({
        where: { rubricScoreId: rubricScore.id },
        create: {
          rubricScoreId: rubricScore.id,
          selectedLabel: grading,
        },
        update: { selectedLabel: grading },
      }),
      prisma.booleanRubricScore.deleteMany({
        where: { rubricScoreId: rubricScore.id },
      }),
      prisma.numericalRubricScore.deleteMany({
        where: { rubricScoreId: rubricScore.id },
      }),
    ]);
  } else {
    if (typeof grading !== "number") {
      return { success: false, error: "Invalid numerical value." };
    }

    const parsed = grading;

    if (!Number.isFinite(parsed)) {
      return { success: false, error: "Invalid numerical value." };
    }

    const minScore =
      rubric.numericalRubric?.minScore != null
        ? Number(rubric.numericalRubric.minScore)
        : null;
    const maxScore =
      rubric.numericalRubric?.maxScore != null
        ? Number(rubric.numericalRubric.maxScore)
        : null;

    if (minScore == null || maxScore == null || maxScore <= minScore) {
      return { success: false, error: "Numerical rubric bounds are invalid." };
    }

    if (parsed < minScore) {
      return { success: false, error: `Score must be at least ${minScore}.` };
    }
    if (parsed > maxScore) {
      return { success: false, error: `Score must be at most ${maxScore}.` };
    }

    await Promise.all([
      prisma.numericalRubricScore.upsert({
        where: { rubricScoreId: rubricScore.id },
        create: { rubricScoreId: rubricScore.id, score: parsed },
        update: { score: parsed },
      }),
      prisma.booleanRubricScore.deleteMany({
        where: { rubricScoreId: rubricScore.id },
      }),
      prisma.ordinalRubricScore.deleteMany({
        where: { rubricScoreId: rubricScore.id },
      }),
    ]);
  }

  updateTag(`assessments:${paperId}:${questionId}`);
  updateTag("assessments");

  return { success: true };
}

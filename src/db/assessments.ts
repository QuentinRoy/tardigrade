import { RubricType } from "@prisma/client";
import { cacheTag, updateTag } from "next/cache";
import { prisma } from "./prisma";
import type { AssessmentRubricValue } from "./types";

export type SaveAssessmentResult =
  | { success: true }
  | { success: false; error: string };

export type SaveAssessmentParams = {
  paperId: string;
  questionId: string;
  rubric: AssessmentRubricValue;
};

// Returns typed rubric values for a paper/question assessment.
export async function loadAssessment(
  paperId: string,
  questionId: string,
): Promise<AssessmentRubricValue[]> {
  "use cache";
  cacheTag(`assessments:${paperId}:${questionId}`);

  const assessment = await prisma.assessment.findFirst({
    where: {
      paper: { id: paperId },
      question: { id: questionId },
    },
    include: {
      scores: {
        select: {
          rubricId: true,
          type: true,
          booleanScore: {
            select: {
              passed: true,
            },
          },
          ordinalScore: {
            select: {
              selectedLabel: true,
            },
          },
          numericalScore: {
            select: {
              score: true,
            },
          },
        },
      },
    },
  });

  const result: AssessmentRubricValue[] = [];
  if (assessment == null) return result;

  for (const score of assessment.scores) {
    if (score.booleanScore != null) {
      result.push({
        rubricId: score.rubricId,
        type: "boolean",
        passed: score.booleanScore.passed,
      });
      continue;
    }

    if (score.ordinalScore != null) {
      result.push({
        rubricId: score.rubricId,
        type: "ordinal",
        selectedLabel: score.ordinalScore.selectedLabel,
      });
      continue;
    }

    if (score.numericalScore != null) {
      const numericScore =
        typeof score.numericalScore.score === "number"
          ? score.numericalScore.score
          : parseFloat(String(score.numericalScore.score));
      result.push({
        rubricId: score.rubricId,
        type: "numerical",
        score: numericScore,
      });
    }
  }

  return result;
}

export async function saveAssessment({
  paperId,
  questionId,
  rubric: rubricValue,
}: SaveAssessmentParams): Promise<SaveAssessmentResult> {
  const rubricId = rubricValue.rubricId;

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

  if (
    (rubric.type === RubricType.BOOLEAN && rubricValue.type !== "boolean") ||
    (rubric.type === RubricType.ORDINAL && rubricValue.type !== "ordinal") ||
    (rubric.type === RubricType.NUMERICAL && rubricValue.type !== "numerical")
  ) {
    return { success: false, error: "Rubric type mismatch." };
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

  if (rubricValue.type === "boolean") {
    await Promise.all([
      prisma.booleanRubricScore.upsert({
        where: { rubricScoreId: rubricScore.id },
        create: {
          rubricScoreId: rubricScore.id,
          passed: rubricValue.passed,
        },
        update: { passed: rubricValue.passed },
      }),
      prisma.ordinalRubricScore.deleteMany({
        where: { rubricScoreId: rubricScore.id },
      }),
      prisma.numericalRubricScore.deleteMany({
        where: { rubricScoreId: rubricScore.id },
      }),
    ]);
  } else if (rubricValue.type === "ordinal") {
    const allowedValues =
      rubric.ordinalRubric?.marks.map((item) => item.label) ?? [];

    if (!allowedValues.includes(rubricValue.selectedLabel)) {
      return { success: false, error: "Invalid ordinal value." };
    }

    await Promise.all([
      prisma.ordinalRubricScore.upsert({
        where: { rubricScoreId: rubricScore.id },
        create: {
          rubricScoreId: rubricScore.id,
          selectedLabel: rubricValue.selectedLabel,
        },
        update: { selectedLabel: rubricValue.selectedLabel },
      }),
      prisma.booleanRubricScore.deleteMany({
        where: { rubricScoreId: rubricScore.id },
      }),
      prisma.numericalRubricScore.deleteMany({
        where: { rubricScoreId: rubricScore.id },
      }),
    ]);
  } else {
    const parsed = rubricValue.score;

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

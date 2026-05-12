import "server-only";
import { RubricType } from "@prisma/client";
import { cacheTag, updateTag } from "next/cache";
import { assertNever } from "@/utils/utils";
import { prisma } from "./prisma";
import type { AssessmentRubricValue } from "./types";

export type SaveAssessmentResult =
  | { success: true }
  | { success: false; error: string };

export type SaveAssessmentParams = {
  submissionId: string;
  questionId: string;
  rubric: AssessmentRubricValue;
};

function toDbRubricType(type: AssessmentRubricValue["type"]): RubricType {
  switch (type) {
    case "boolean":
      return RubricType.BOOLEAN;
    case "ordinal":
      return RubricType.ORDINAL;
    case "numerical":
      return RubricType.NUMERICAL;
    default:
      assertNever(type);
  }
}
function toAssessmentRubricType(
  type: RubricType,
): AssessmentRubricValue["type"] {
  switch (type) {
    case RubricType.BOOLEAN:
      return "boolean";
    case RubricType.ORDINAL:
      return "ordinal";
    case RubricType.NUMERICAL:
      return "numerical";
    default:
      assertNever(type);
  }
}

// Returns typed rubric values for a submission/question assessment.
export async function loadAssessment(
  submissionId: string,
  questionId: string,
): Promise<AssessmentRubricValue[]> {
  "use cache";
  cacheTag(`assessments:${submissionId}:${questionId}`);

  const assessment = await prisma.assessment.findFirst({
    where: {
      submission: { id: submissionId },
      question: { id: questionId },
    },
    include: {
      assessments: {
        select: {
          rubricId: true,
          type: true,
          booleanAssessment: {
            select: {
              passed: true,
            },
          },
          ordinalAssessment: {
            select: {
              selectedLabel: true,
            },
          },
          numericalAssessment: {
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

  for (const rubricAssessment of assessment.assessments) {
    if (rubricAssessment.booleanAssessment != null) {
      result.push({
        rubricId: rubricAssessment.rubricId,
        type: "boolean",
        passed: rubricAssessment.booleanAssessment.passed,
      });
      continue;
    }

    if (rubricAssessment.ordinalAssessment != null) {
      result.push({
        rubricId: rubricAssessment.rubricId,
        type: "ordinal",
        selectedLabel: rubricAssessment.ordinalAssessment.selectedLabel,
      });
      continue;
    }

    if (rubricAssessment.numericalAssessment != null) {
      const numericScore =
        typeof rubricAssessment.numericalAssessment.score === "number"
          ? rubricAssessment.numericalAssessment.score
          : parseFloat(String(rubricAssessment.numericalAssessment.score));
      result.push({
        rubricId: rubricAssessment.rubricId,
        type: "numerical",
        score: numericScore,
      });
    }
  }

  return result;
}

export async function saveAssessment({
  submissionId,
  questionId,
  rubric: rubricValue,
}: SaveAssessmentParams): Promise<SaveAssessmentResult> {
  const rubricId = rubricValue.rubricId;

  const [submission, question, rubric] = await Promise.all([
    prisma.submission.findUnique({ where: { id: submissionId } }),
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

  if (submission == null || question == null) {
    return { success: false, error: "Submission or question not found." };
  }

  if (rubric == null || rubric.questionId !== question.id) {
    return { success: false, error: "Rubric not found." };
  }

  if (toAssessmentRubricType(rubric.type) !== rubricValue.type) {
    return { success: false, error: "Rubric type mismatch." };
  }

  const rubricAssessmentType = toDbRubricType(rubricValue.type);

  const assessment = await prisma.assessment.upsert({
    where: {
      submissionId_questionId: {
        submissionId: submission.id,
        questionId: question.id,
      },
    },
    create: { submissionId: submission.id, questionId: question.id },
    update: {},
  });

  const rubricAssessment = await prisma.rubricAssessment.upsert({
    where: {
      assessmentId_rubricId: {
        assessmentId: assessment.id,
        rubricId,
      },
    },
    create: {
      assessmentId: assessment.id,
      rubricId,
      type: rubricAssessmentType,
    },
    update: {
      type: rubricAssessmentType,
    },
  });

  if (rubricValue.type === "boolean") {
    await Promise.all([
      prisma.booleanRubricAssessment.upsert({
        where: { rubricAssessmentId: rubricAssessment.id },
        create: {
          rubricAssessmentId: rubricAssessment.id,
          passed: rubricValue.passed,
        },
        update: { passed: rubricValue.passed },
      }),
      prisma.ordinalRubricAssessment.deleteMany({
        where: { rubricAssessmentId: rubricAssessment.id },
      }),
      prisma.numericalRubricAssessment.deleteMany({
        where: { rubricAssessmentId: rubricAssessment.id },
      }),
    ]);
  } else if (rubricValue.type === "ordinal") {
    const allowedValues =
      rubric.ordinalRubric?.marks.map((item) => item.label) ?? [];

    if (!allowedValues.includes(rubricValue.selectedLabel)) {
      return { success: false, error: "Invalid ordinal value." };
    }

    await Promise.all([
      prisma.ordinalRubricAssessment.upsert({
        where: { rubricAssessmentId: rubricAssessment.id },
        create: {
          rubricAssessmentId: rubricAssessment.id,
          selectedLabel: rubricValue.selectedLabel,
        },
        update: { selectedLabel: rubricValue.selectedLabel },
      }),
      prisma.booleanRubricAssessment.deleteMany({
        where: { rubricAssessmentId: rubricAssessment.id },
      }),
      prisma.numericalRubricAssessment.deleteMany({
        where: { rubricAssessmentId: rubricAssessment.id },
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
      prisma.numericalRubricAssessment.upsert({
        where: { rubricAssessmentId: rubricAssessment.id },
        create: { rubricAssessmentId: rubricAssessment.id, score: parsed },
        update: { score: parsed },
      }),
      prisma.booleanRubricAssessment.deleteMany({
        where: { rubricAssessmentId: rubricAssessment.id },
      }),
      prisma.ordinalRubricAssessment.deleteMany({
        where: { rubricAssessmentId: rubricAssessment.id },
      }),
    ]);
  }

  updateTag(`assessments:${submissionId}:${questionId}`);
  updateTag("assessments");

  return { success: true };
}

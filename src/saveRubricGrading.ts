"use server";

import { updateTag } from "next/cache";
import { prisma } from "./prisma";

export type SaveRubricGradingResult =
  | { success: true }
  | { success: false; error: string };

export async function saveRubricGrading({
  paperId,
  questionId,
  rubricId,
  score,
}: {
  paperId: string; // externalId
  questionId: string; // externalId
  rubricId: string; // DB id
  score: 0 | 1;
}): Promise<SaveRubricGradingResult> {
  const [paper, question] = await Promise.all([
    prisma.paper.findUnique({ where: { externalId: paperId } }),
    prisma.question.findUnique({ where: { externalId: questionId } }),
  ]);

  if (paper == null || question == null) {
    return { success: false, error: "Paper or question not found." };
  }

  const assessment = await prisma.assessment.upsert({
    where: {
      paperId_questionId: { paperId: paper.id, questionId: question.id },
    },
    create: { paperId: paper.id, questionId: question.id },
    update: {},
  });

  await prisma.rubricScore.upsert({
    where: {
      assessmentId_rubricId: {
        assessmentId: assessment.id,
        rubricId,
      },
    },
    create: { assessmentId: assessment.id, rubricId, score },
    update: { score },
  });

  updateTag(`assessments:${paperId}:${questionId}`);

  return { success: true };
}

import { cacheTag } from "next/cache";
import { prisma } from "./prisma";

export type RubricGrading = "passed" | "failed";

// Returns a map from rubricId (DB id) to grading
export async function loadAssessment(
  paperId: string, // externalId
  questionId: string, // externalId
): Promise<Map<string, RubricGrading>> {
  "use cache";
  cacheTag(`assessments:${paperId}:${questionId}`);

  const assessment = await prisma.assessment.findFirst({
    where: {
      paper: { externalId: paperId },
      question: { externalId: questionId },
    },
    include: {
      scores: {
        select: {
          rubricId: true,
          score: true,
        },
      },
    },
  });

  const result = new Map<string, RubricGrading>();
  if (assessment == null) return result;

  for (const score of assessment.scores) {
    const numericScore =
      typeof score.score === "number"
        ? score.score
        : parseFloat(String(score.score));
    result.set(score.rubricId, numericScore >= 0.5 ? "passed" : "failed");
  }

  return result;
}

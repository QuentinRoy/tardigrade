import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "./prisma";
import type { GlobalAssessmentProgress } from "./types";

async function loadGlobalAssessmentProgressFromDb(): Promise<GlobalAssessmentProgress> {
  "use cache";
  cacheTag("questions");
  cacheTag("papers");
  cacheTag("assessments");
  cacheLife({ revalidate: 60 });

  const [papers, questions, assessments, rubricAssessmentsCount] =
    await Promise.all([
      prisma.paper.findMany({ select: { id: true } }),
      prisma.question.findMany({
        select: {
          id: true,
          _count: { select: { rubrics: true } },
        },
      }),
      prisma.assessment.findMany({
        select: {
          paperId: true,
          questionId: true,
          _count: { select: { assessments: true } },
        },
      }),
      prisma.rubricAssessment.count(),
    ]);

  const totalPapers = papers.length;
  const totalQuestions = questions.length;

  const rubricCountByQuestionId = new Map(
    questions.map((question) => [question.id, question._count.rubrics]),
  );

  const totalRubricsInProject = questions.reduce(
    (sum, question) => sum + question._count.rubrics,
    0,
  );
  const totalExpectedRubricAssessments = totalPapers * totalRubricsInProject;

  const zeroRubricQuestionCount = questions.filter(
    (question) => question._count.rubrics === 0,
  ).length;

  const completedQuestionAssessmentsByQuestionId = new Map(
    questions.map((question) => [question.id, 0]),
  );
  const completedQuestionAssessmentsByPaperId = new Map(
    papers.map((paper) => [paper.id, zeroRubricQuestionCount]),
  );

  for (const assessment of assessments) {
    const requiredRubricCount =
      rubricCountByQuestionId.get(assessment.questionId) ?? 0;

    if (requiredRubricCount === 0) {
      continue;
    }

    if (assessment._count.assessments >= requiredRubricCount) {
      completedQuestionAssessmentsByQuestionId.set(
        assessment.questionId,
        (completedQuestionAssessmentsByQuestionId.get(assessment.questionId) ??
          0) + 1,
      );
      completedQuestionAssessmentsByPaperId.set(
        assessment.paperId,
        (completedQuestionAssessmentsByPaperId.get(assessment.paperId) ?? 0) +
          1,
      );
    }
  }

  const completedQuestions =
    totalPapers === 0
      ? 0
      : questions.filter(
          (question) =>
            (completedQuestionAssessmentsByQuestionId.get(question.id) ?? 0) >=
            totalPapers,
        ).length;

  const completedPapers =
    totalQuestions === 0
      ? 0
      : papers.filter(
          (paper) =>
            (completedQuestionAssessmentsByPaperId.get(paper.id) ?? 0) >=
            totalQuestions,
        ).length;

  return {
    papers: {
      completed: completedPapers,
      total: totalPapers,
    },
    questions: {
      completed: completedQuestions,
      total: totalQuestions,
    },
    rubrics: {
      completed: Math.min(
        rubricAssessmentsCount,
        totalExpectedRubricAssessments,
      ),
      total: totalExpectedRubricAssessments,
    },
  };
}

export async function loadGlobalAssessmentProgress(): Promise<GlobalAssessmentProgress> {
  return loadGlobalAssessmentProgressFromDb();
}

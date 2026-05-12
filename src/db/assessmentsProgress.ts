import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "./prisma";
import type { GlobalAssessmentProgress } from "./types";

async function loadGlobalAssessmentProgressFromDb(): Promise<GlobalAssessmentProgress> {
  "use cache";
  cacheTag("questions");
  cacheTag("submissions");
  cacheTag("assessments");
  cacheLife({ revalidate: 60 });

  const [submissions, questions, assessments, rubricAssessmentsCount] =
    await Promise.all([
      prisma.submission.findMany({ select: { id: true } }),
      prisma.question.findMany({
        select: {
          id: true,
          _count: { select: { rubrics: true } },
        },
      }),
      prisma.assessment.findMany({
        select: {
          submissionId: true,
          questionId: true,
          _count: { select: { assessments: true } },
        },
      }),
      prisma.rubricAssessment.count(),
    ]);

  const totalSubmissions = submissions.length;
  const totalQuestions = questions.length;

  const rubricCountByQuestionId = new Map<string, number>(
    questions.map((question) => [question.id, question._count.rubrics]),
  );

  const totalRubricsInProject = questions.reduce(
    (sum, question) => sum + question._count.rubrics,
    0,
  );
  const totalExpectedRubricAssessments =
    totalSubmissions * totalRubricsInProject;

  const zeroRubricQuestionCount = questions.filter(
    (question) => question._count.rubrics === 0,
  ).length;

  const completedQuestionAssessmentsByQuestionId = new Map<string, number>(
    questions.map((question) => [question.id, 0]),
  );
  const completedQuestionAssessmentsBySubmissionId = new Map<string, number>(
    submissions.map((submission) => [submission.id, zeroRubricQuestionCount]),
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
      completedQuestionAssessmentsBySubmissionId.set(
        assessment.submissionId,
        (completedQuestionAssessmentsBySubmissionId.get(
          assessment.submissionId,
        ) ?? 0) + 1,
      );
    }
  }

  const completedQuestions =
    totalSubmissions === 0
      ? 0
      : questions.filter(
          (question) =>
            (completedQuestionAssessmentsByQuestionId.get(question.id) ?? 0) >=
            totalSubmissions,
        ).length;

  const completedSubmissions =
    totalQuestions === 0
      ? 0
      : submissions.filter(
          (submission) =>
            (completedQuestionAssessmentsBySubmissionId.get(submission.id) ??
              0) >= totalQuestions,
        ).length;

  return {
    submissions: {
      completed: completedSubmissions,
      total: totalSubmissions,
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

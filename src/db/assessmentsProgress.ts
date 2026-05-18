import "server-only";
import { cacheLife } from "next/cache";
import { CACHE_TAGS, cacheTags } from "./cacheTags";
import { db } from "./kysely";
import { withProjectScope } from "./projectScope";
import type { GlobalAssessmentProgress } from "./types";

async function loadGlobalAssessmentProgressFromDb(
  projectId?: number,
): Promise<GlobalAssessmentProgress> {
  "use cache";
  cacheTags(
    CACHE_TAGS.questions,
    CACHE_TAGS.submissions,
    CACHE_TAGS.assessments,
  );
  cacheLife({ revalidate: 60 });

  let submissionsQuery = db.selectFrom("submission");
  let questionsQuery = db.selectFrom("question");
  let assessmentsQuery = db.selectFrom("assessment");

  submissionsQuery = withProjectScope(
    submissionsQuery,
    projectId,
    (query, id) => query.where("submission.projectId", "=", id),
  );
  questionsQuery = withProjectScope(questionsQuery, projectId, (query, id) =>
    query.where("question.projectId", "=", id),
  );
  assessmentsQuery = withProjectScope(
    assessmentsQuery,
    projectId,
    (query, id) => query.where("assessment.projectId", "=", id),
  );

  const rubricAssessmentsQuery =
    projectId != null
      ? db
          .selectFrom("rubricAssessment")
          .innerJoin(
            "assessment",
            "assessment.id",
            "rubricAssessment.assessmentId",
          )
          .where("assessment.projectId", "=", projectId)
      : db.selectFrom("rubricAssessment");

  const [submissions, questions, assessments, rubricAssessmentsCount] =
    await Promise.all([
      submissionsQuery.select("id").execute(),
      questionsQuery
        .leftJoin("rubric", "rubric.questionId", "question.rowId")
        .select((expressionBuilder) => [
          "question.id as id",
          expressionBuilder.fn.count<number>("rubric.id").as("rubricCount"),
        ])
        .groupBy("question.id")
        .execute(),
      assessmentsQuery
        .innerJoin("question", "question.rowId", "assessment.questionId")
        .leftJoin(
          "rubricAssessment",
          "rubricAssessment.assessmentId",
          "assessment.id",
        )
        .select((expressionBuilder) => [
          "assessment.submissionId as submissionId",
          "question.id as questionId",
          expressionBuilder.fn
            .count<number>("rubricAssessment.id")
            .as("assessmentCount"),
        ])
        .groupBy(["assessment.submissionId", "question.id"])
        .execute(),
      rubricAssessmentsQuery
        .select((expressionBuilder) =>
          expressionBuilder.fn.countAll<number>().as("count"),
        )
        .executeTakeFirstOrThrow(),
    ]);

  const totalSubmissions = submissions.length;
  const totalQuestions = questions.length;

  const rubricCountByQuestionId = new Map<string, number>(
    questions.map((question) => [question.id, Number(question.rubricCount)]),
  );

  const totalRubricsInProject = questions.reduce(
    (sum, question) => sum + Number(question.rubricCount),
    0,
  );
  const totalExpectedRubricAssessments =
    totalSubmissions * totalRubricsInProject;

  const zeroRubricQuestionCount = questions.filter(
    (question) => Number(question.rubricCount) === 0,
  ).length;

  const completedQuestionAssessmentsByQuestionId = new Map<string, number>(
    questions.map((question) => [question.id, 0]),
  );
  const completedQuestionAssessmentsBySubmissionId = new Map<string, number>(
    submissions.map((submission) => [
      String(submission.id),
      zeroRubricQuestionCount,
    ]),
  );

  for (const assessment of assessments) {
    const requiredRubricCount =
      rubricCountByQuestionId.get(assessment.questionId) ?? 0;

    if (requiredRubricCount === 0) {
      continue;
    }

    const submissionId = String(assessment.submissionId);

    if (Number(assessment.assessmentCount) >= requiredRubricCount) {
      completedQuestionAssessmentsByQuestionId.set(
        assessment.questionId,
        (completedQuestionAssessmentsByQuestionId.get(assessment.questionId) ??
          0) + 1,
      );
      completedQuestionAssessmentsBySubmissionId.set(
        submissionId,
        (completedQuestionAssessmentsBySubmissionId.get(submissionId) ?? 0) + 1,
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
            (completedQuestionAssessmentsBySubmissionId.get(
              String(submission.id),
            ) ?? 0) >= totalQuestions,
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
        Number(rubricAssessmentsCount.count),
        totalExpectedRubricAssessments,
      ),
      total: totalExpectedRubricAssessments,
    },
  };
}

export async function loadGlobalAssessmentProgress(
  projectId?: number,
): Promise<GlobalAssessmentProgress> {
  return loadGlobalAssessmentProgressFromDb(projectId);
}

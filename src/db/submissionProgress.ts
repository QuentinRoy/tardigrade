import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./kysely";

export type SubmissionProgressMetric = {
  completed: number;
  total: number;
};

export async function loadSubmissionQuestionProgress(
  questionId: string,
): Promise<Record<string, SubmissionProgressMetric>> {
  "use cache";
  cacheTag("submissions");
  cacheTag("questions");
  cacheTag("assessments");
  cacheTag(`questions:${questionId}`);
  cacheLife({ revalidate: 60 });

  const [submissions, rubricCountRow, assessmentCounts] = await Promise.all([
    db.selectFrom("submission").select("id").execute(),
    db
      .selectFrom("rubric")
      .where("questionId", "=", questionId)
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom("assessment")
      .leftJoin(
        "rubricAssessment",
        "rubricAssessment.assessmentId",
        "assessment.id",
      )
      .where("assessment.questionId", "=", questionId)
      .select((eb) => [
        "assessment.submissionId as submissionId",
        eb.fn.count<number>("rubricAssessment.id").as("completed"),
      ])
      .groupBy("assessment.submissionId")
      .execute(),
  ]);

  const totalRubrics = Number(rubricCountRow.count);
  const completedBySubmissionId = new Map<string, number>(
    assessmentCounts.map((row) => [
      String(row.submissionId),
      Number(row.completed),
    ]),
  );

  return Object.fromEntries(
    submissions.map((submission) => {
      const submissionId = String(submission.id);
      const completed = Math.min(
        completedBySubmissionId.get(submissionId) ?? 0,
        totalRubrics,
      );

      return [
        submissionId,
        {
          completed,
          total: totalRubrics,
        },
      ];
    }),
  );
}

export async function loadSubmissionOverviewProgress(): Promise<
  Record<string, SubmissionProgressMetric>
> {
  "use cache";
  cacheTag("submissions");
  cacheTag("questions");
  cacheTag("assessments");
  cacheLife({ revalidate: 60 });

  const [submissions, questions, assessments] = await Promise.all([
    db.selectFrom("submission").select("id").execute(),
    db
      .selectFrom("question")
      .leftJoin("rubric", "rubric.questionId", "question.id")
      .select((eb) => [
        "question.id as id",
        eb.fn.count<number>("rubric.id").as("rubricCount"),
      ])
      .groupBy("question.id")
      .execute(),
    db
      .selectFrom("assessment")
      .leftJoin(
        "rubricAssessment",
        "rubricAssessment.assessmentId",
        "assessment.id",
      )
      .select((eb) => [
        "assessment.submissionId as submissionId",
        "assessment.questionId as questionId",
        eb.fn.count<number>("rubricAssessment.id").as("assessmentCount"),
      ])
      .groupBy(["assessment.submissionId", "assessment.questionId"])
      .execute(),
  ]);

  const totalQuestions = questions.length;
  const zeroRubricQuestionCount = questions.filter(
    (question) => Number(question.rubricCount) === 0,
  ).length;

  const rubricCountByQuestionId = new Map<string, number>(
    questions.map((question) => [question.id, Number(question.rubricCount)]),
  );

  const completedQuestionCountBySubmissionId = new Map<string, number>(
    submissions.map((submission) => [
      String(submission.id),
      zeroRubricQuestionCount,
    ]),
  );

  for (const assessment of assessments) {
    const requiredRubrics =
      rubricCountByQuestionId.get(assessment.questionId) ?? 0;
    if (requiredRubrics === 0) {
      continue;
    }

    if (Number(assessment.assessmentCount) >= requiredRubrics) {
      const submissionId = String(assessment.submissionId);
      completedQuestionCountBySubmissionId.set(
        submissionId,
        (completedQuestionCountBySubmissionId.get(submissionId) ?? 0) + 1,
      );
    }
  }

  return Object.fromEntries(
    submissions.map((submission) => {
      const submissionId = String(submission.id);
      const completed = Math.min(
        completedQuestionCountBySubmissionId.get(submissionId) ?? 0,
        totalQuestions,
      );

      return [
        submissionId,
        {
          completed,
          total: totalQuestions,
        },
      ];
    }),
  );
}

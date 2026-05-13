import "server-only";
import { cacheTag, updateTag } from "next/cache";
import { db } from "./kysely";
import type { AssessmentRubricValue } from "./types";

export type SaveAssessmentResult =
  | { success: true }
  | { success: false; error: string };

export type SaveAssessmentParams = {
  submissionId: string;
  questionId: string;
  rubric: AssessmentRubricValue;
};

// Returns typed rubric values for a submission/question assessment.
export async function loadAssessment(
  submissionId: string,
  questionId: string,
): Promise<AssessmentRubricValue[]> {
  "use cache";
  cacheTag(`assessments:${submissionId}:${questionId}`);

  const assessment = await db
    .selectFrom("assessment")
    .where("submissionId", "=", Number(submissionId))
    .where("questionId", "=", questionId)
    .select("id")
    .executeTakeFirst();

  if (!assessment) {
    return [];
  }

  const rubricAssessments = await db
    .selectFrom("rubricAssessment")
    .where("assessmentId", "=", assessment.id)
    .select(["id", "rubricId", "type"])
    .execute();

  const result: AssessmentRubricValue[] = [];

  for (const rubricAssessment of rubricAssessments) {
    if (rubricAssessment.type === "boolean") {
      const booleanAssessment = await db
        .selectFrom("booleanRubricAssessment")
        .where("rubricAssessmentId", "=", rubricAssessment.id)
        .select("passed")
        .executeTakeFirst();

      if (booleanAssessment) {
        result.push({
          rubricId: rubricAssessment.rubricId,
          type: "boolean",
          passed: booleanAssessment.passed,
        });
      }
    } else if (rubricAssessment.type === "ordinal") {
      const ordinalAssessment = await db
        .selectFrom("ordinalRubricAssessment")
        .where("rubricAssessmentId", "=", rubricAssessment.id)
        .select("selectedLabel")
        .executeTakeFirst();

      if (ordinalAssessment) {
        result.push({
          rubricId: rubricAssessment.rubricId,
          type: "ordinal",
          selectedLabel: ordinalAssessment.selectedLabel,
        });
      }
    } else if (rubricAssessment.type === "numerical") {
      const numericalAssessment = await db
        .selectFrom("numericalRubricAssessment")
        .where("rubricAssessmentId", "=", rubricAssessment.id)
        .select("score")
        .executeTakeFirst();

      if (numericalAssessment) {
        const numericScore =
          typeof numericalAssessment.score === "number"
            ? numericalAssessment.score
            : parseFloat(String(numericalAssessment.score));
        result.push({
          rubricId: rubricAssessment.rubricId,
          type: "numerical",
          score: numericScore,
        });
      }
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
    db
      .selectFrom("submission")
      .where("id", "=", Number(submissionId))
      .select("id")
      .executeTakeFirst(),
    db
      .selectFrom("question")
      .where("id", "=", questionId)
      .select("id")
      .executeTakeFirst(),
    db
      .selectFrom("rubric")
      .leftJoin("ordinalRubric", "ordinalRubric.rubricId", "rubric.id")
      .leftJoin(
        "ordinalRubricValue",
        "ordinalRubricValue.ordinalRubricId",
        "ordinalRubric.id",
      )
      .leftJoin("numericalRubric", "numericalRubric.rubricId", "rubric.id")
      .where("rubric.id", "=", rubricId)
      .select([
        "rubric.id",
        "rubric.type",
        "rubric.questionId",
        "ordinalRubricValue.label",
        "numericalRubric.minScore",
        "numericalRubric.maxScore",
      ])
      .executeTakeFirst(),
  ]);

  if (submission == null || question == null) {
    return { success: false, error: "Submission or question not found." };
  }

  if (rubric == null || rubric.questionId !== question.id) {
    return { success: false, error: "Rubric not found." };
  }

  if (rubric.type !== rubricValue.type) {
    return { success: false, error: "Rubric type mismatch." };
  }

  return db.transaction().execute(async (tx) => {
    const _assessment = await tx
      .insertInto("assessment")
      .values({ submissionId: submission.id, questionId: question.id })
      .onConflict((conflict) =>
        conflict.columns(["submissionId", "questionId"]).doNothing(),
      )
      .execute();

    const existingAssessment = await tx
      .selectFrom("assessment")
      .where("submissionId", "=", submission.id)
      .where("questionId", "=", question.id)
      .select("id")
      .executeTakeFirstOrThrow();

    const assessmentId = existingAssessment.id;

    const _rubricAssessment = await tx
      .insertInto("rubricAssessment")
      .values({
        assessmentId,
        rubricId,
        type: rubricValue.type,
      })
      .onConflict((conflict) =>
        conflict
          .columns(["assessmentId", "rubricId"])
          .doUpdateSet({ type: rubricValue.type }),
      )
      .execute();

    const existingRubricAssessment = await tx
      .selectFrom("rubricAssessment")
      .where("assessmentId", "=", assessmentId)
      .where("rubricId", "=", rubricId)
      .select("id")
      .executeTakeFirstOrThrow();

    const rubricAssessmentId = existingRubricAssessment.id;

    if (rubricValue.type === "boolean") {
      await Promise.all([
        tx
          .insertInto("booleanRubricAssessment")
          .values({
            rubricAssessmentId,
            passed: rubricValue.passed,
          })
          .onConflict((conflict) =>
            conflict
              .column("rubricAssessmentId")
              .doUpdateSet({ passed: rubricValue.passed }),
          )
          .execute(),
        tx
          .deleteFrom("ordinalRubricAssessment")
          .where("rubricAssessmentId", "=", rubricAssessmentId)
          .execute(),
        tx
          .deleteFrom("numericalRubricAssessment")
          .where("rubricAssessmentId", "=", rubricAssessmentId)
          .execute(),
      ]);
    } else if (rubricValue.type === "ordinal") {
      const ordinalLabels = await tx
        .selectFrom("ordinalRubricValue")
        .innerJoin(
          "ordinalRubric",
          "ordinalRubric.id",
          "ordinalRubricValue.ordinalRubricId",
        )
        .where("ordinalRubric.rubricId", "=", rubricId)
        .select("ordinalRubricValue.label")
        .execute();

      const allowedValues = ordinalLabels.map((v) => v.label);

      if (!allowedValues.includes(rubricValue.selectedLabel)) {
        return { success: false, error: "Invalid ordinal value." };
      }

      await Promise.all([
        tx
          .insertInto("ordinalRubricAssessment")
          .values({
            rubricAssessmentId,
            selectedLabel: rubricValue.selectedLabel,
          })
          .onConflict((conflict) =>
            conflict
              .column("rubricAssessmentId")
              .doUpdateSet({ selectedLabel: rubricValue.selectedLabel }),
          )
          .execute(),
        tx
          .deleteFrom("booleanRubricAssessment")
          .where("rubricAssessmentId", "=", rubricAssessmentId)
          .execute(),
        tx
          .deleteFrom("numericalRubricAssessment")
          .where("rubricAssessmentId", "=", rubricAssessmentId)
          .execute(),
      ]);
    } else {
      const parsed = rubricValue.score;

      if (!Number.isFinite(parsed)) {
        return { success: false, error: "Invalid numerical value." };
      }

      const numericalRubricData = await tx
        .selectFrom("numericalRubric")
        .where("rubricId", "=", rubricId)
        .select(["minScore", "maxScore"])
        .executeTakeFirst();

      const minScore =
        numericalRubricData?.minScore != null
          ? Number(numericalRubricData.minScore)
          : null;
      const maxScore =
        numericalRubricData?.maxScore != null
          ? Number(numericalRubricData.maxScore)
          : null;

      if (minScore == null || maxScore == null || maxScore <= minScore) {
        return {
          success: false,
          error: "Numerical rubric bounds are invalid.",
        };
      }

      if (parsed < minScore) {
        return {
          success: false,
          error: `Score must be at least ${minScore}.`,
        };
      }
      if (parsed > maxScore) {
        return {
          success: false,
          error: `Score must be at most ${maxScore}.`,
        };
      }

      await Promise.all([
        tx
          .insertInto("numericalRubricAssessment")
          .values({
            rubricAssessmentId,
            score: parsed,
          })
          .onConflict((conflict) =>
            conflict
              .column("rubricAssessmentId")
              .doUpdateSet({ score: parsed }),
          )
          .execute(),
        tx
          .deleteFrom("booleanRubricAssessment")
          .where("rubricAssessmentId", "=", rubricAssessmentId)
          .execute(),
        tx
          .deleteFrom("ordinalRubricAssessment")
          .where("rubricAssessmentId", "=", rubricAssessmentId)
          .execute(),
      ]);
    }

    updateTag(`assessments:${submissionId}:${questionId}`);
    updateTag("assessments");

    return { success: true };
  });
}

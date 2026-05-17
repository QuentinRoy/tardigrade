import "server-only";
import type { Kysely, Transaction } from "kysely";
import { assertNever } from "../utils/utils";
import { cacheTags, updateTags } from "./cacheTags";
import { db } from "./kysely";
import type { AssessmentRubricValue, DB } from "./types";

export type SaveAssessmentResult =
  | { success: true }
  | { success: false; error: string };

export type SaveAssessmentParams = {
  submissionId: string;
  questionId: string;
  rubric: AssessmentRubricValue;
};

type AssessmentWriteDb = Kysely<DB> | Transaction<DB>;

// Returns typed rubric values for a submission/question assessment.
export async function loadAssessment(
  submissionId: string,
  questionId: string,
): Promise<AssessmentRubricValue[]> {
  "use cache";
  cacheTags(`assessments:${submissionId}:${questionId}`);

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
    .leftJoin(
      "booleanRubricAssessment",
      "booleanRubricAssessment.rubricAssessmentId",
      "rubricAssessment.id",
    )
    .leftJoin(
      "ordinalRubricAssessment",
      "ordinalRubricAssessment.rubricAssessmentId",
      "rubricAssessment.id",
    )
    .leftJoin(
      "numericalRubricAssessment",
      "numericalRubricAssessment.rubricAssessmentId",
      "rubricAssessment.id",
    )
    .where("rubricAssessment.assessmentId", "=", assessment.id)
    .select([
      "rubricAssessment.rubricId as rubricId",
      "rubricAssessment.type as type",
      "booleanRubricAssessment.passed as passed",
      "ordinalRubricAssessment.selectedLabel as selectedLabel",
      "numericalRubricAssessment.score as score",
    ])
    .execute();

  const result: AssessmentRubricValue[] = [];

  for (const rubricAssessment of rubricAssessments) {
    switch (rubricAssessment.type) {
      case "boolean": {
        if (rubricAssessment.passed == null) {
          break;
        }

        result.push({
          rubricId: rubricAssessment.rubricId,
          type: "boolean",
          passed: rubricAssessment.passed,
        });
        break;
      }
      case "ordinal": {
        if (rubricAssessment.selectedLabel == null) {
          break;
        }

        result.push({
          rubricId: rubricAssessment.rubricId,
          type: "ordinal",
          selectedLabel: rubricAssessment.selectedLabel,
        });
        break;
      }
      case "numerical": {
        if (rubricAssessment.score == null) {
          break;
        }

        result.push({
          rubricId: rubricAssessment.rubricId,
          type: "numerical",
          score:
            typeof rubricAssessment.score === "number"
              ? rubricAssessment.score
              : parseFloat(String(rubricAssessment.score)),
        });
        break;
      }
      default: {
        assertNever(rubricAssessment.type);
      }
    }
  }

  return result;
}

async function saveAssessmentWithDb(
  queryDb: AssessmentWriteDb,
  { submissionId, questionId, rubric: rubricValue }: SaveAssessmentParams,
): Promise<SaveAssessmentResult> {
  const rubricId = rubricValue.rubricId;

  const [submission, question, rubric] = await Promise.all([
    queryDb
      .selectFrom("submission")
      .where("id", "=", Number(submissionId))
      .select(["id", "projectId"])
      .executeTakeFirst(),
    queryDb
      .selectFrom("question")
      .where("id", "=", questionId)
      .select(["id", "projectId"])
      .executeTakeFirst(),
    queryDb
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

  if (submission.projectId !== question.projectId) {
    return { success: false, error: "Submission or question not found." };
  }

  if (rubric == null || rubric.questionId !== question.id) {
    return { success: false, error: "Rubric not found." };
  }

  if (rubric.type !== rubricValue.type) {
    return { success: false, error: "Rubric type mismatch." };
  }

  await queryDb
    .insertInto("assessment")
    .values({
      projectId: question.projectId,
      submissionId: submission.id,
      questionId: question.id,
    })
    .onConflict((conflict) =>
      conflict.columns(["submissionId", "questionId"]).doNothing(),
    )
    .execute();

  const existingAssessment = await queryDb
    .selectFrom("assessment")
    .where("submissionId", "=", submission.id)
    .where("questionId", "=", question.id)
    .select("id")
    .executeTakeFirstOrThrow();

  const assessmentId = existingAssessment.id;

  await queryDb
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

  const existingRubricAssessment = await queryDb
    .selectFrom("rubricAssessment")
    .where("assessmentId", "=", assessmentId)
    .where("rubricId", "=", rubricId)
    .select("id")
    .executeTakeFirstOrThrow();

  const rubricAssessmentId = existingRubricAssessment.id;

  async function saveBooleanAssessment(
    value: Extract<AssessmentRubricValue, { type: "boolean" }>,
  ): Promise<SaveAssessmentResult | void> {
    await Promise.all([
      queryDb
        .insertInto("booleanRubricAssessment")
        .values({
          rubricAssessmentId,
          passed: value.passed,
        })
        .onConflict((conflict) =>
          conflict
            .column("rubricAssessmentId")
            .doUpdateSet({ passed: value.passed }),
        )
        .execute(),
      queryDb
        .deleteFrom("ordinalRubricAssessment")
        .where("rubricAssessmentId", "=", rubricAssessmentId)
        .execute(),
      queryDb
        .deleteFrom("numericalRubricAssessment")
        .where("rubricAssessmentId", "=", rubricAssessmentId)
        .execute(),
    ]);
  }

  async function saveOrdinalAssessment(
    value: Extract<AssessmentRubricValue, { type: "ordinal" }>,
  ): Promise<SaveAssessmentResult | void> {
    const ordinalLabels = await queryDb
      .selectFrom("ordinalRubricValue")
      .innerJoin(
        "ordinalRubric",
        "ordinalRubric.id",
        "ordinalRubricValue.ordinalRubricId",
      )
      .where("ordinalRubric.rubricId", "=", rubricId)
      .select("ordinalRubricValue.label")
      .execute();

    const allowedValues = ordinalLabels.map((item) => item.label);
    if (!allowedValues.includes(value.selectedLabel)) {
      return { success: false, error: "Invalid ordinal value." };
    }

    await Promise.all([
      queryDb
        .insertInto("ordinalRubricAssessment")
        .values({
          rubricAssessmentId,
          selectedLabel: value.selectedLabel,
        })
        .onConflict((conflict) =>
          conflict
            .column("rubricAssessmentId")
            .doUpdateSet({ selectedLabel: value.selectedLabel }),
        )
        .execute(),
      queryDb
        .deleteFrom("booleanRubricAssessment")
        .where("rubricAssessmentId", "=", rubricAssessmentId)
        .execute(),
      queryDb
        .deleteFrom("numericalRubricAssessment")
        .where("rubricAssessmentId", "=", rubricAssessmentId)
        .execute(),
    ]);
  }

  async function saveNumericalAssessment(
    value: Extract<AssessmentRubricValue, { type: "numerical" }>,
  ): Promise<SaveAssessmentResult | void> {
    const parsed = value.score;
    if (!Number.isFinite(parsed)) {
      return { success: false, error: "Invalid numerical value." };
    }

    const numericalRubricData = await queryDb
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
      return { success: false, error: `Score must be at least ${minScore}.` };
    }
    if (parsed > maxScore) {
      return { success: false, error: `Score must be at most ${maxScore}.` };
    }

    await Promise.all([
      queryDb
        .insertInto("numericalRubricAssessment")
        .values({
          rubricAssessmentId,
          score: parsed,
        })
        .onConflict((conflict) =>
          conflict.column("rubricAssessmentId").doUpdateSet({ score: parsed }),
        )
        .execute(),
      queryDb
        .deleteFrom("booleanRubricAssessment")
        .where("rubricAssessmentId", "=", rubricAssessmentId)
        .execute(),
      queryDb
        .deleteFrom("ordinalRubricAssessment")
        .where("rubricAssessmentId", "=", rubricAssessmentId)
        .execute(),
    ]);
  }

  const result = await (async (): Promise<SaveAssessmentResult | void> => {
    switch (rubricValue.type) {
      case "boolean": {
        return await saveBooleanAssessment(rubricValue);
      }
      case "ordinal": {
        return await saveOrdinalAssessment(rubricValue);
      }
      case "numerical": {
        return await saveNumericalAssessment(rubricValue);
      }
      default: {
        return assertNever(rubricValue);
      }
    }
  })();

  if (result != null) {
    return result;
  }

  return { success: true };
}

export async function saveAssessment({
  submissionId,
  questionId,
  rubric: rubricValue,
}: SaveAssessmentParams): Promise<SaveAssessmentResult> {
  const result = await db.transaction().execute((tx) =>
    saveAssessmentWithDb(tx, {
      submissionId,
      questionId,
      rubric: rubricValue,
    }),
  );

  if (result.success) {
    updateTags(
      `assessments:${submissionId}:${questionId}`,
      "assessments",
      `assessments:question:${questionId}`,
    );
  }

  return result;
}

export { saveAssessmentWithDb };

import "server-only";
import { snakeCase } from "change-case";
import { saveAssessment } from "../db/assessments";
import { db } from "../db/kysely";
import type { AssessmentRubricValue, RubricType } from "../db/types";
import type { ImportedAssessmentRow } from "./types";

const SUBMISSION_TYPE_COLUMN = snakeCase("submissionType");
const SUBMITTER_COLUMN = snakeCase("submitter");
const GRAND_TOTAL_MARKS_COLUMN = snakeCase("grandTotalMarks");

export async function saveAssessments(
  assessmentRows: ImportedAssessmentRow[],
): Promise<{
  assessmentCount: number;
}> {
  const rubrics = await db
    .selectFrom("rubric")
    .innerJoin("question", "question.id", "rubric.questionId")
    .leftJoin("booleanRubric", "booleanRubric.rubricId", "rubric.id")
    .leftJoin("ordinalRubric", "ordinalRubric.rubricId", "rubric.id")
    .leftJoin(
      "ordinalRubricValue",
      "ordinalRubricValue.ordinalRubricId",
      "ordinalRubric.id",
    )
    .leftJoin("numericalRubric", "numericalRubric.rubricId", "rubric.id")
    .select([
      "rubric.id",
      "rubric.type",
      "rubric.questionId",
      "question.id as questionId",
      "booleanRubric.marks",
      "ordinalRubricValue.label",
      "numericalRubric.minScore",
      "numericalRubric.maxScore",
    ])
    .execute();

  const rubricsByKey = new Map<
    string,
    {
      id: string;
      type: RubricType;
      questionId: string;
      ordinalLabels: string[];
      numericalMinMax?: { minScore: number; maxScore: number };
    }
  >();

  for (const row of rubrics) {
    const key = `${row.questionId}:${row.id}`;
    const existing = rubricsByKey.get(key);

    if (!existing) {
      const ordinalLabels =
        row.type === "ordinal" && row.label ? [row.label] : [];
      const numericalMinMax =
        row.type === "numerical" && row.minScore != null && row.maxScore != null
          ? { minScore: Number(row.minScore), maxScore: Number(row.maxScore) }
          : undefined;

      rubricsByKey.set(key, {
        id: row.id,
        type: row.type,
        questionId: row.questionId,
        ordinalLabels,
        numericalMinMax,
      });
    } else if (
      row.type === "ordinal" &&
      row.label &&
      !existing.ordinalLabels.includes(row.label)
    ) {
      existing.ordinalLabels.push(row.label);
    }
  }

  const recognizedColumns = new Set([
    SUBMISSION_TYPE_COLUMN,
    SUBMITTER_COLUMN,
    GRAND_TOTAL_MARKS_COLUMN,
  ]);

  for (const [key] of rubricsByKey) {
    recognizedColumns.add(key);
    recognizedColumns.add(`${key}:marks`);
    const [questionId] = key.split(":");
    recognizedColumns.add(questionId);
  }

  if (assessmentRows.length > 0) {
    const firstRow = assessmentRows[0];
    const headerColumns = Object.keys(firstRow);
    for (const col of headerColumns) {
      if (!recognizedColumns.has(col)) {
        throw new Error(`Unrecognized column: "${col}"`);
      }
    }
  }

  const errorDetails: Array<{
    row: number;
    submission: string;
    error: string;
  }> = [];
  let successCount = 0;

  for (let rowIndex = 0; rowIndex < assessmentRows.length; rowIndex++) {
    const row = assessmentRows[rowIndex];
    const submissionType = row[SUBMISSION_TYPE_COLUMN]?.trim();
    const submitter = row[SUBMITTER_COLUMN]?.trim();
    let resolvedSubmissionId: string | null = null;

    if (submissionType !== "team" && submissionType !== "individual") {
      errorDetails.push({
        row: rowIndex + 2,
        submission: "unknown",
        error: "Missing or invalid submission_type",
      });
      continue;
    }

    if (!submitter) {
      errorDetails.push({
        row: rowIndex + 2,
        submission: "unknown",
        error: "Missing submitter",
      });
      continue;
    }

    const submissions =
      submissionType === "team"
        ? await db
            .selectFrom("submission")
            .innerJoin("team", "team.id", "submission.teamId")
            .where("submission.type", "=", "team")
            .where("team.name", "=", submitter)
            .select("submission.id")
            .execute()
        : await db
            .selectFrom("submission")
            .innerJoin("student", "student.id", "submission.studentId")
            .where("submission.type", "=", "individual")
            .where("student.id", "=", submitter)
            .select("submission.id")
            .execute();

    if (submissions.length > 1) {
      errorDetails.push({
        row: rowIndex + 2,
        submission: submitter,
        error: `Ambiguous submission mapping for ${submissionType ?? "unknown"}:${submitter}`,
      });
      continue;
    }

    resolvedSubmissionId = submissions[0]?.id
      ? String(submissions[0].id)
      : null;

    const submissionId = resolvedSubmissionId;

    if (!submissionId) {
      continue;
    }

    for (const [columnKey, rubricInfo] of rubricsByKey) {
      const value = row[columnKey]?.trim();

      if (!value) {
        continue;
      }

      try {
        let assessment: AssessmentRubricValue;

        if (rubricInfo.type === "boolean") {
          const passed = value.toLowerCase() === "true";
          assessment = {
            rubricId: rubricInfo.id,
            type: "boolean" as const,
            passed,
          };
        } else if (rubricInfo.type === "ordinal") {
          if (rubricInfo.ordinalLabels.length > 0) {
            const labelExists = rubricInfo.ordinalLabels.includes(value);
            if (!labelExists) {
              throw new Error(
                `Invalid ordinal value "${value}" for rubric ${rubricInfo.id}`,
              );
            }
          }
          assessment = {
            rubricId: rubricInfo.id,
            type: "ordinal" as const,
            selectedLabel: value,
          };
        } else if (rubricInfo.type === "numerical") {
          const score = parseFloat(value);
          if (Number.isNaN(score)) {
            throw new Error(`Invalid numerical value "${value}"`);
          }
          assessment = {
            rubricId: rubricInfo.id,
            type: "numerical" as const,
            score,
          };
        } else {
          throw new Error(`Unknown rubric type: ${rubricInfo.type}`);
        }

        await saveAssessment({
          submissionId,
          questionId: rubricInfo.questionId,
          rubric: assessment,
        });
        successCount++;
      } catch (error) {
        errorDetails.push({
          row: rowIndex + 2,
          submission: submissionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (errorDetails.length > 0) {
    const errorMessages = errorDetails
      .map((e) => `Row ${e.row} (${e.submission}): ${e.error}`)
      .join("\n");
    throw new Error(`Assessment import errors:\n${errorMessages}`);
  }

  return {
    assessmentCount: successCount,
  };
}

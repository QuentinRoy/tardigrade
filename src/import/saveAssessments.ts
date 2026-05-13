import "server-only";
import { RubricType } from "@prisma/client";
import { snakeCase } from "change-case";
import { saveAssessment } from "../db/assessments";
import { prisma } from "../db/prisma";
import type { AssessmentRubricValue } from "../db/types";
import type { ImportedAssessmentRow } from "./types";

const SUBMISSION_TYPE_COLUMN = snakeCase("submissionType");
const SUBMITTER_COLUMN = snakeCase("submitter");
const GRAND_TOTAL_MARKS_COLUMN = snakeCase("grandTotalMarks");

export async function saveAssessments(
  assessmentRows: ImportedAssessmentRow[],
): Promise<{
  assessmentCount: number;
}> {
  const rubrics = await prisma.rubric.findMany({
    include: {
      question: true,
      booleanRubric: true,
      ordinalRubric: {
        include: {
          marks: true,
        },
      },
      numericalRubric: true,
    },
  });

  const rubricsByKey = new Map<string, (typeof rubrics)[0]>();
  for (const rubric of rubrics) {
    const key = `${rubric.question.id}:${rubric.id}`;
    rubricsByKey.set(key, rubric);
  }

  const recognizedColumns = new Set([
    SUBMISSION_TYPE_COLUMN,
    SUBMITTER_COLUMN,
    GRAND_TOTAL_MARKS_COLUMN,
  ]);

  for (const rubric of rubrics) {
    recognizedColumns.add(`${rubric.question.id}:${rubric.id}`);
    recognizedColumns.add(`${rubric.question.id}:${rubric.id}:marks`);
    recognizedColumns.add(rubric.question.id);
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
    const submissionTypeRaw = row[SUBMISSION_TYPE_COLUMN]?.trim().toUpperCase();
    const submitter = row[SUBMITTER_COLUMN]?.trim();
    let resolvedSubmissionId: string | null = null;

    if (submissionTypeRaw !== "TEAM" && submissionTypeRaw !== "INDIVIDUAL") {
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
      submissionTypeRaw === "TEAM"
        ? await prisma.submission.findMany({
            where: {
              type: "TEAM",
              team: {
                is: {
                  name: submitter,
                },
              },
            },
            select: {
              id: true,
            },
          })
        : await prisma.submission.findMany({
            where: {
              type: "INDIVIDUAL",
              student: {
                is: {
                  id: submitter,
                },
              },
            },
            select: {
              id: true,
            },
          });

    if (submissions.length > 1) {
      errorDetails.push({
        row: rowIndex + 2,
        submission: submitter,
        error: `Ambiguous submission mapping for ${submissionTypeRaw}:${submitter}`,
      });
      continue;
    }

    resolvedSubmissionId = submissions[0]?.id ?? null;

    const submissionId = resolvedSubmissionId;

    if (!submissionId) {
      continue;
    }

    for (const [columnKey, rubric] of rubricsByKey) {
      const value = row[columnKey]?.trim();

      if (!value) {
        continue;
      }

      try {
        let assessment: AssessmentRubricValue;

        if (rubric.type === RubricType.BOOLEAN) {
          const passed = value.toLowerCase() === "true";
          assessment = {
            rubricId: rubric.id,
            type: "boolean" as const,
            passed,
          };
        } else if (rubric.type === RubricType.ORDINAL) {
          if (rubric.ordinalRubric) {
            const labelExists = rubric.ordinalRubric.marks.some(
              (v) => v.label === value,
            );
            if (!labelExists) {
              throw new Error(
                `Invalid ordinal value "${value}" for rubric ${rubric.id}`,
              );
            }
          }
          assessment = {
            rubricId: rubric.id,
            type: "ordinal" as const,
            selectedLabel: value,
          };
        } else if (rubric.type === RubricType.NUMERICAL) {
          const score = parseFloat(value);
          if (Number.isNaN(score)) {
            throw new Error(`Invalid numerical value "${value}"`);
          }
          assessment = {
            rubricId: rubric.id,
            type: "numerical" as const,
            score,
          };
        } else {
          throw new Error(`Unknown rubric type: ${rubric.type}`);
        }

        await saveAssessment({
          submissionId,
          questionId: rubric.question.id,
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

import "server-only";
import { RubricType } from "@prisma/client";
import { saveAssessment } from "../db/assessments";
import { prisma } from "../db/prisma";
import type { AssessmentRubricValue } from "../db/types";
import type { ImportedAssessmentRow } from "./types";

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
          values: true,
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
    "submissionId",
    "submissionType",
    "submitter",
    "grand total marks",
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
    const submissionId = row.submissionId?.trim();

    if (!submissionId) {
      errorDetails.push({
        row: rowIndex + 2,
        submission: "unknown",
        error: "Missing submissionId",
      });
      continue;
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
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
            const labelExists = rubric.ordinalRubric.values.some(
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

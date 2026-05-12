import "server-only";
import { Prisma, SubmissionType } from "@prisma/client";
import {
  buildAssessmentKey,
  buildSubmissionExportHeaders,
  buildSubmissionExportRow,
  type ExportOptions,
  type ExportQuestionPlan,
} from "@/export/submissionExportCsv";
import { prisma } from "./prisma";

function toNumber(value: Prisma.Decimal | number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (typeof (value as { toNumber?: unknown }).toNumber === "function") {
    return (value as Prisma.Decimal).toNumber();
  }
  return parseFloat(String(value));
}

async function assertSubmissionInvariants() {
  const invalidSubmissions = await prisma.submission.count({
    where: {
      OR: [
        { type: SubmissionType.TEAM, teamId: null },
        { type: SubmissionType.INDIVIDUAL, studentId: null },
      ],
    },
  });

  if (invalidSubmissions > 0) {
    throw new Error(
      `Unexpected submission data: found ${invalidSubmissions} submissions without required owner.`,
    );
  }
}

async function loadQuestionPlan(): Promise<ExportQuestionPlan[]> {
  const questions = await prisma.question.findMany({
    select: {
      id: true,
      label: true,
      position: true,
      rubrics: {
        select: {
          id: true,
          label: true,
          description: true,
          position: true,
          type: true,
          booleanRubric: {
            select: {
              marks: true,
            },
          },
          ordinalRubric: {
            select: {
              marks: {
                select: {
                  label: true,
                  marks: true,
                },
              },
            },
          },
          numericalRubric: {
            select: {
              minScore: true,
              maxScore: true,
              minMarks: true,
              maxMarks: true,
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { position: "asc" },
  });

  return questions.map((question) => ({
    id: question.id,
    label: question.label ?? question.id,
    rubrics: question.rubrics.map((rubric) => {
      const rubricLabel = rubric.label ?? rubric.description ?? rubric.id;

      if (rubric.type === "BOOLEAN") {
        return {
          id: rubric.id,
          label: rubricLabel,
          type: "boolean" as const,
          marks:
            rubric.booleanRubric != null
              ? toNumber(rubric.booleanRubric.marks)
              : 0,
        };
      }

      if (rubric.type === "ORDINAL") {
        return {
          id: rubric.id,
          label: rubricLabel,
          type: "ordinal" as const,
          marksByLabel: Object.fromEntries(
            (rubric.ordinalRubric?.marks ?? []).map((item) => [
              item.label,
              toNumber(item.marks),
            ]),
          ),
        };
      }

      return {
        id: rubric.id,
        label: rubricLabel,
        type: "numerical" as const,
        minScore:
          rubric.numericalRubric != null
            ? toNumber(rubric.numericalRubric.minScore)
            : 0,
        maxScore:
          rubric.numericalRubric != null
            ? toNumber(rubric.numericalRubric.maxScore)
            : 0,
        minMarks:
          rubric.numericalRubric != null
            ? toNumber(rubric.numericalRubric.minMarks)
            : 0,
        maxMarks:
          rubric.numericalRubric != null
            ? toNumber(rubric.numericalRubric.maxMarks)
            : 0,
      };
    }),
  }));
}

export async function createSubmissionExport(options: ExportOptions): Promise<{
  headers: string[];
  rows: AsyncGenerator<string[]>;
}> {
  await assertSubmissionInvariants();

  const questions = await loadQuestionPlan();
  const headers = buildSubmissionExportHeaders(questions, options);

  async function* rows(): AsyncGenerator<string[]> {
    const stream = prisma.submission.cursorStream(
      {
        orderBy: { id: "asc" },
        select: {
          id: true,
          type: true,
          team: { select: { name: true } },
          student: { select: { id: true } },
          assessments: {
            select: {
              questionId: true,
              assessments: {
                select: {
                  rubricId: true,
                  booleanAssessment: { select: { passed: true } },
                  ordinalAssessment: { select: { selectedLabel: true } },
                  numericalAssessment: { select: { score: true } },
                },
              },
            },
          },
        },
      },
      {
        batchSize: 100,
      },
    );

    for await (const submission of stream) {
      const valuesByKey = new Map();

      for (const assessment of submission.assessments) {
        for (const rubricAssessment of assessment.assessments) {
          const key = buildAssessmentKey(
            assessment.questionId,
            rubricAssessment.rubricId,
          );

          if (rubricAssessment.booleanAssessment != null) {
            valuesByKey.set(key, {
              rubricId: rubricAssessment.rubricId,
              type: "boolean",
              passed: rubricAssessment.booleanAssessment.passed,
            });
            continue;
          }

          if (rubricAssessment.ordinalAssessment != null) {
            valuesByKey.set(key, {
              rubricId: rubricAssessment.rubricId,
              type: "ordinal",
              selectedLabel: rubricAssessment.ordinalAssessment.selectedLabel,
            });
            continue;
          }

          if (rubricAssessment.numericalAssessment != null) {
            valuesByKey.set(key, {
              rubricId: rubricAssessment.rubricId,
              type: "numerical",
              score: toNumber(rubricAssessment.numericalAssessment.score),
            });
          }
        }
      }

      yield buildSubmissionExportRow({
        submission: {
          id: submission.id,
          type: submission.type,
          teamName: submission.team?.name,
          studentId: submission.student?.id,
        },
        questions,
        options,
        valuesByKey,
      });
    }
  }

  return {
    headers,
    rows: rows(),
  };
}

import "server-only";
import { once } from "node:events";
import { stringify } from "csv-stringify";
import { db } from "../db/kysely";
import type { AssessmentRubricValue, SubmissionSubmitter } from "../db/types";
import {
  type AssessedRubric,
  attachAssessment,
  markRubric,
} from "../rubrics/rubric";
import { assertNever } from "../utils/utils";
import {
  buildAssessmentKey,
  buildSubmissionExportHeaders,
  buildSubmissionExportRecord,
  type ExportOptions,
  type ExportQuestionPlan,
  type SubmissionExportAssessmentValue,
  type SubmissionExportDataRow,
  type SubmissionExportQuestionData,
  type SubmissionExportRecord,
  type SubmissionExportRubricData,
} from "./submissionExportCsv";

function toNumber(value: string | number): number {
  if (typeof value === "number") return value;
  return parseFloat(value);
}

function toSubmissionSubmitter(params: {
  id: string;
  type: "team" | "individual";
  teamName: string | null;
  studentId: string | null;
}): SubmissionSubmitter {
  if (params.type === "team") {
    if (params.teamName == null || params.teamName.length === 0) {
      throw new Error(
        `Submission ${params.id} has type team but no team is linked.`,
      );
    }

    return {
      id: params.id,
      type: "team",
      teamName: params.teamName,
    };
  }

  if (params.studentId == null || params.studentId.length === 0) {
    throw new Error(
      `Submission ${params.id} has type individual but no student is linked.`,
    );
  }

  return {
    id: params.id,
    type: "individual",
    studentId: params.studentId,
  };
}

async function assertSubmissionInvariants(projectId: string) {
  const invalidSubmissions = await db
    .selectFrom("project")
    .where("project.id", "=", projectId)
    .leftJoin("submission", "project.rowId", "submission.projectId")
    .select((expressionBuilder) => expressionBuilder.fn.countAll().as("count"))
    .where((expressionBuilder) =>
      expressionBuilder.or([
        expressionBuilder.and([
          expressionBuilder("type", "=", "team"),
          expressionBuilder("teamId", "is", null),
        ]),
        expressionBuilder.and([
          expressionBuilder("type", "=", "individual"),
          expressionBuilder("studentId", "is", null),
        ]),
      ])
    )
    .executeTakeFirstOrThrow();

  const invalidCount = Number(invalidSubmissions.count);

  if (invalidCount > 0) {
    throw new Error(
      `Unexpected submission data: found ${invalidCount} submissions without required owner.`,
    );
  }
}

async function loadQuestionPlan(
  projectId: string,
): Promise<ExportQuestionPlan[]> {
  const { rowId: projectRowId } = await db
    .selectFrom("project")
    .where("project.id", "=", projectId)
    .select("project.rowId")
    .executeTakeFirstOrThrow();
  const [questions, rubrics, booleanRubrics, numericalRubrics, ordinalMarks] =
    await Promise.all([
      db
        .selectFrom("question")
        .where("question.projectId", "=", projectRowId)
        .select(["id", "position"])
        .orderBy("position", "asc")
        .execute(),
      db
        .selectFrom("rubric")
        .innerJoin("question", "question.rowId", "rubric.questionId")
        .where("rubric.projectId", "=", projectRowId)
        .select([
          "rubric.id as id",
          "question.id as questionId",
          "rubric.position as position",
          "rubric.type as type",
        ])
        .orderBy("rubric.position", "asc")
        .execute(),
      db
        .selectFrom("booleanRubric")
        .innerJoin("rubric", "rubric.rowId", "booleanRubric.rubricId")
        .where("rubric.projectId", "=", projectRowId)
        .select([
          "rubric.id as rubricId",
          "booleanRubric.marks as marks",
          "booleanRubric.falseMarks as falseMarks",
        ])
        .execute(),
      db
        .selectFrom("numericalRubric")
        .innerJoin("rubric", "rubric.rowId", "numericalRubric.rubricId")
        .where("rubric.projectId", "=", projectRowId)
        .select([
          "rubric.id as rubricId",
          "numericalRubric.minScore as minScore",
          "numericalRubric.maxScore as maxScore",
          "numericalRubric.minMarks as minMarks",
          "numericalRubric.maxMarks as maxMarks",
          "numericalRubric.reversed as reversed",
        ])
        .execute(),
      db
        .selectFrom("ordinalRubric")
        .innerJoin(
          "ordinalRubricValue",
          "ordinalRubricValue.ordinalRubricId",
          "ordinalRubric.id",
        )
        .innerJoin("rubric", "rubric.rowId", "ordinalRubric.rubricId")
        .where("rubric.projectId", "=", projectRowId)
        .select([
          "rubric.id as rubricId",
          "ordinalRubricValue.label as label",
          "ordinalRubricValue.marks as marks",
        ])
        .execute(),
    ]);

  const rubricsByQuestionId = new Map<string, (typeof rubrics)[number][]>();
  for (const rubric of rubrics) {
    const list = rubricsByQuestionId.get(rubric.questionId) ?? [];
    list.push(rubric);
    rubricsByQuestionId.set(rubric.questionId, list);
  }

  const booleanRubricById = new Map(
    booleanRubrics.map((row) => [row.rubricId, row]),
  );
  const numericalRubricById = new Map(
    numericalRubrics.map((row) => [row.rubricId, row]),
  );
  const ordinalMarksByRubricId = new Map<
    string,
    { label: string; marks: number }[]
  >();
  for (const row of ordinalMarks) {
    const list = ordinalMarksByRubricId.get(row.rubricId) ?? [];
    list.push({ label: row.label, marks: row.marks });
    ordinalMarksByRubricId.set(row.rubricId, list);
  }

  return questions.map((question) => ({
    id: question.id,
    rubrics: (rubricsByQuestionId.get(question.id) ?? []).map((rubric) => {
      if (rubric.type === "boolean") {
        const booleanRubric = booleanRubricById.get(rubric.id);
        if (booleanRubric == null) {
          throw new Error(
            `Unexpected data: missing booleanRubric row for rubric ${rubric.id}.`,
          );
        }
        return {
          id: rubric.id,
          type: "boolean" as const,
          marks: toNumber(booleanRubric.marks),
          falseMarks: toNumber(booleanRubric.falseMarks),
        };
      }

      if (rubric.type === "ordinal") {
        const marks = ordinalMarksByRubricId.get(rubric.id) ?? [];
        return {
          id: rubric.id,
          type: "ordinal" as const,
          marks: Object.fromEntries(
            marks.map((item) => [item.label, toNumber(item.marks)]),
          ),
        };
      }

      const numericalRubric = numericalRubricById.get(rubric.id);
      if (numericalRubric == null) {
        throw new Error(
          `Unexpected data: missing numericalRubric row for rubric ${rubric.id}.`,
        );
      }
      return {
        id: rubric.id,
        type: "numerical" as const,
        minScore: toNumber(numericalRubric.minScore),
        maxScore: toNumber(numericalRubric.maxScore),
        minMarks: toNumber(numericalRubric.minMarks),
        maxMarks: toNumber(numericalRubric.maxMarks),
        reversed: numericalRubric.reversed,
      };
    }),
  }));
}

export async function createSubmissionExport(projectId: string): Promise<{
  questions: ExportQuestionPlan[];
  rows: AsyncGenerator<SubmissionExportDataRow>;
}> {
  await assertSubmissionInvariants(projectId);

  const questions = await loadQuestionPlan(projectId);

  function getAssessmentValue(
    rubric: AssessedRubric,
  ): SubmissionExportAssessmentValue | undefined {
    if (rubric.assessment == null) {
      return undefined;
    }

    switch (rubric.type) {
      case "boolean": {
        return rubric.assessment.passed;
      }
      case "ordinal": {
        return rubric.assessment.selectedLabel;
      }
      case "numerical": {
        return rubric.assessment.score;
      }
      default: {
        return assertNever(rubric);
      }
    }
  }

  function buildQuestionData(
    valuesByKey: Map<string, AssessmentRubricValue>,
  ): SubmissionExportQuestionData[] {
    return questions.map((question) => ({
      questionId: question.id,
      rubrics: question.rubrics.map((rubric) => {
        const assessedRubric = attachAssessment(
          rubric,
          valuesByKey.get(buildAssessmentKey(question.id, rubric.id)),
        );

        const rowRubric: SubmissionExportRubricData = {
          rubricId: rubric.id,
        };

        const assessment = getAssessmentValue(assessedRubric);
        if (assessment != null) {
          rowRubric.assessment = assessment;
        }

        if (assessedRubric.assessment != null) {
          rowRubric.marks = markRubric(assessedRubric);
        }

        return rowRubric;
      }),
    }));
  }

  function buildCurrentSubmissionExportRow(params: {
    submissionId: number;
    submissionType: "team" | "individual" | null;
    teamName: string | null;
    studentId: string | null;
    valuesByKey: Map<string, AssessmentRubricValue>;
  }): SubmissionExportDataRow {
    if (params.submissionType == null) {
      throw new Error("Missing submission type while streaming export.");
    }

    return {
      submission: toSubmissionSubmitter({
        id: String(params.submissionId),
        type: params.submissionType,
        teamName: params.teamName,
        studentId: params.studentId,
      }),
      questions: buildQuestionData(params.valuesByKey),
    };
  }

  async function* rows(): AsyncGenerator<SubmissionExportDataRow> {
    const stream = db
      .selectFrom("project")
      .where("project.id", "=", projectId)
      .leftJoin("submission", "project.rowId", "submission.projectId")
      .leftJoin("team", "team.id", "submission.teamId")
      .leftJoin("student", "student.rowId", "submission.studentId")
      .leftJoin("assessment", "assessment.submissionId", "submission.id")
      .leftJoin("question", "question.rowId", "assessment.questionId")
      .leftJoin(
        "rubricAssessment",
        "rubricAssessment.assessmentId",
        "assessment.id",
      )
      .leftJoin("rubric", "rubric.rowId", "rubricAssessment.rubricId")
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
      .select([
        "submission.id as submissionId",
        "submission.type as submissionType",
        "team.name as teamName",
        "student.id as studentId",
        "question.id as questionId",
        "rubric.id as rubricId",
        "booleanRubricAssessment.passed as booleanPassed",
        "ordinalRubricAssessment.selectedLabel as ordinalSelectedLabel",
        "numericalRubricAssessment.score as numericalScore",
      ])
      .orderBy("submission.id", "asc")
      .orderBy("assessment.id", "asc")
      .orderBy("rubricAssessment.id", "asc")
      .stream(200);

    let currentSubmissionId: number | null = null;
    let currentSubmissionType: "team" | "individual" | null = null;
    let currentTeamName: string | null = null;
    let currentStudentId: string | null = null;
    let currentValuesByKey = new Map<string, AssessmentRubricValue>();

    for await (const row of stream) {
      if (
        currentSubmissionId != null &&
        row.submissionId !== currentSubmissionId
      ) {
        yield buildCurrentSubmissionExportRow({
          submissionId: currentSubmissionId,
          submissionType: currentSubmissionType,
          teamName: currentTeamName,
          studentId: currentStudentId,
          valuesByKey: currentValuesByKey,
        });

        currentValuesByKey = new Map<string, AssessmentRubricValue>();
      }

      currentSubmissionId = row.submissionId;
      currentSubmissionType = row.submissionType;
      currentTeamName = row.teamName;
      currentStudentId = row.studentId;

      if (row.questionId == null || row.rubricId == null) {
        continue;
      }

      const key = buildAssessmentKey(row.questionId, row.rubricId);

      if (row.booleanPassed != null) {
        currentValuesByKey.set(key, {
          rubricId: row.rubricId,
          type: "boolean",
          passed: row.booleanPassed,
        });
        continue;
      }

      if (row.ordinalSelectedLabel != null) {
        currentValuesByKey.set(key, {
          rubricId: row.rubricId,
          type: "ordinal",
          selectedLabel: row.ordinalSelectedLabel,
        });
        continue;
      }

      if (row.numericalScore != null) {
        currentValuesByKey.set(key, {
          rubricId: row.rubricId,
          type: "numerical",
          score: toNumber(row.numericalScore),
        });
      }
    }

    if (currentSubmissionId != null) {
      yield buildCurrentSubmissionExportRow({
        submissionId: currentSubmissionId,
        submissionType: currentSubmissionType,
        teamName: currentTeamName,
        studentId: currentStudentId,
        valuesByKey: currentValuesByKey,
      });
    }
  }

  return { questions, rows: rows() };
}

async function* toSubmissionExportRecords(params: {
  rows: AsyncIterable<SubmissionExportDataRow>;
  options: ExportOptions;
}): AsyncGenerator<SubmissionExportRecord> {
  for await (const row of params.rows) {
    yield buildSubmissionExportRecord({ row, options: params.options });
  }
}

export function createCsvSubmissionExportDataStream(params: {
  questions: ExportQuestionPlan[];
  rows: AsyncIterable<SubmissionExportDataRow>;
  options: ExportOptions;
}): ReadableStream<Uint8Array> {
  const headers = buildSubmissionExportHeaders(
    params.questions,
    params.options,
  );

  return createCsvSubmissionExportStream({
    headers,
    rows: toSubmissionExportRecords({
      rows: params.rows,
      options: params.options,
    }),
  });
}

export function createCsvSubmissionExportStream(exportData: {
  headers: string[];
  rows: AsyncIterable<SubmissionExportRecord>;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const stringifier = stringify({
        header: true,
        columns: exportData.headers,
        cast: {
          boolean: (value: boolean) => String(value),
        },
      });

      stringifier.on("data", (chunk: string | Buffer) => {
        if (typeof chunk === "string") {
          controller.enqueue(encoder.encode(chunk));
          return;
        }

        controller.enqueue(new Uint8Array(chunk));
      });

      stringifier.on("end", () => {
        controller.close();
      });

      stringifier.on("error", (error) => {
        controller.error(error);
      });

      try {
        for await (const row of exportData.rows) {
          if (!stringifier.write(row)) {
            await once(stringifier, "drain");
          }
        }

        stringifier.end();
      } catch (error) {
        const streamError = error instanceof Error
          ? error
          : new Error("Failed to stream submission CSV.");
        stringifier.destroy(streamError);
      }
    },
  });
}

export async function createCsvSubmissionExport(
  options: ExportOptions,
  projectId: string,
): Promise<ReadableStream<Uint8Array>> {
  const exportData = await createSubmissionExport(projectId);
  return createCsvSubmissionExportDataStream({
    questions: exportData.questions,
    rows: exportData.rows,
    options,
  });
}

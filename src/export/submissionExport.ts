import "server-only";
import {
  buildAssessmentKey,
  buildSubmissionExportHeaders,
  buildSubmissionExportRow,
  type ExportOptions,
  type ExportQuestionPlan,
} from "@/export/submissionExportCsv";
import { db } from "../db/kysely";
import type { AssessmentRubricValue, SubmissionSubmitter } from "../db/types";

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

async function assertSubmissionInvariants() {
  const invalidSubmissions = await db
    .selectFrom("submission")
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
      ]),
    )
    .executeTakeFirstOrThrow();

  const invalidCount = Number(invalidSubmissions.count);

  if (invalidCount > 0) {
    throw new Error(
      `Unexpected submission data: found ${invalidCount} submissions without required owner.`,
    );
  }
}

async function loadQuestionPlan(): Promise<ExportQuestionPlan[]> {
  const [questions, rubrics, booleanRubrics, numericalRubrics, ordinalMarks] =
    await Promise.all([
      db
        .selectFrom("question")
        .select(["id", "label", "position"])
        .orderBy("position", "asc")
        .execute(),
      db
        .selectFrom("rubric")
        .select([
          "id",
          "questionId",
          "label",
          "description",
          "position",
          "type",
        ])
        .orderBy("position", "asc")
        .execute(),
      db
        .selectFrom("booleanRubric")
        .select(["rubricId", "marks", "falseMarks"])
        .execute(),
      db
        .selectFrom("numericalRubric")
        .select([
          "rubricId",
          "minScore",
          "maxScore",
          "minMarks",
          "maxMarks",
          "reversed",
        ])
        .execute(),
      db
        .selectFrom("ordinalRubric")
        .innerJoin(
          "ordinalRubricValue",
          "ordinalRubricValue.ordinalRubricId",
          "ordinalRubric.id",
        )
        .select([
          "ordinalRubric.rubricId as rubricId",
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
    label: question.label ?? question.id,
    rubrics: (rubricsByQuestionId.get(question.id) ?? []).map((rubric) => {
      const rubricLabel = rubric.label ?? rubric.description ?? rubric.id;

      if (rubric.type === "boolean") {
        const booleanRubric = booleanRubricById.get(rubric.id);
        return {
          id: rubric.id,
          label: rubricLabel,
          type: "boolean" as const,
          marks: booleanRubric != null ? toNumber(booleanRubric.marks) : 0,
          falseMarks:
            booleanRubric != null ? toNumber(booleanRubric.falseMarks) : 0,
        };
      }

      if (rubric.type === "ordinal") {
        const marks = ordinalMarksByRubricId.get(rubric.id) ?? [];
        return {
          id: rubric.id,
          label: rubricLabel,
          type: "ordinal" as const,
          marks: Object.fromEntries(
            marks.map((item) => [item.label, toNumber(item.marks)]),
          ),
        };
      }

      const numericalRubric = numericalRubricById.get(rubric.id);
      return {
        id: rubric.id,
        label: rubricLabel,
        type: "numerical" as const,
        minScore:
          numericalRubric != null ? toNumber(numericalRubric.minScore) : 0,
        maxScore:
          numericalRubric != null ? toNumber(numericalRubric.maxScore) : 0,
        minMarks:
          numericalRubric != null ? toNumber(numericalRubric.minMarks) : 0,
        maxMarks:
          numericalRubric != null ? toNumber(numericalRubric.maxMarks) : 0,
        reversed: numericalRubric != null ? numericalRubric.reversed : false,
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
    const stream = db
      .selectFrom("submission")
      .leftJoin("team", "team.id", "submission.teamId")
      .leftJoin("student", "student.id", "submission.studentId")
      .leftJoin("assessment", "assessment.submissionId", "submission.id")
      .leftJoin(
        "rubricAssessment",
        "rubricAssessment.assessmentId",
        "assessment.id",
      )
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
        "assessment.questionId as questionId",
        "rubricAssessment.rubricId as rubricId",
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
        if (currentSubmissionType == null) {
          throw new Error("Missing submission type while streaming export.");
        }

        yield buildSubmissionExportRow({
          submission: toSubmissionSubmitter({
            id: String(currentSubmissionId),
            type: currentSubmissionType,
            teamName: currentTeamName,
            studentId: currentStudentId,
          }),
          questions,
          options,
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
      if (currentSubmissionType == null) {
        throw new Error("Missing submission type while finalizing export.");
      }

      yield buildSubmissionExportRow({
        submission: toSubmissionSubmitter({
          id: String(currentSubmissionId),
          type: currentSubmissionType,
          teamName: currentTeamName,
          studentId: currentStudentId,
        }),
        questions,
        options,
        valuesByKey: currentValuesByKey,
      });
    }
  }

  return {
    headers,
    rows: rows(),
  };
}

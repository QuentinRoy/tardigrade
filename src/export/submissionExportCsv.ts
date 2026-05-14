import type {
  AssessmentRubricValue,
  Rubric,
  SubmissionSubmitter,
} from "@/db/types";
import { markRubric } from "../rubrics/rubric";
import { assertNever } from "../utils/utils";

export type ExportInclude = "rubric-assessment" | "rubric-marks";

export type ExportOptions = {
  includeRubricAssessment: boolean;
  includeRubricMarks: boolean;
};

type RubricOfType<TType extends Rubric["type"]> = Extract<
  Rubric,
  { type: TType }
>;

type ExportRubricLabel = {
  label: string;
};

type ExportBooleanRubricPlan = ExportRubricLabel &
  Pick<RubricOfType<"boolean">, "id" | "type" | "marks">;

type ExportOrdinalRubricPlan = ExportRubricLabel &
  Pick<RubricOfType<"ordinal">, "id" | "type" | "marks">;

type ExportNumericalRubricPlan = ExportRubricLabel &
  Pick<
    RubricOfType<"numerical">,
    | "id"
    | "type"
    | "minScore"
    | "maxScore"
    | "minMarks"
    | "maxMarks"
    | "reversed"
  >;

export type ExportRubricPlan =
  | ExportBooleanRubricPlan
  | ExportOrdinalRubricPlan
  | ExportNumericalRubricPlan;

export type ExportQuestionPlan = {
  id: string;
  label: string;
  rubrics: ExportRubricPlan[];
};

export function parseExportOptions(
  searchParams: URLSearchParams,
): ExportOptions {
  const includes = searchParams.getAll("include");

  const includeSet = new Set<ExportInclude>();
  for (const include of includes) {
    if (include === "rubric-assessment" || include === "rubric-marks") {
      includeSet.add(include);
      continue;
    }

    throw new Error(`Invalid include option: ${include}`);
  }

  return {
    includeRubricAssessment: includeSet.has("rubric-assessment"),
    includeRubricMarks: includeSet.has("rubric-marks"),
  };
}

export function buildAssessmentKey(
  questionId: string,
  rubricId: string,
): string {
  return `${questionId}::${rubricId}`;
}

export function getSubmissionExportIdentifier(
  submission: SubmissionSubmitter,
): string {
  if (submission.type === "team") {
    if (submission.teamName == null || submission.teamName.length === 0) {
      throw new Error(
        `Submission ${submission.id} has type team but no team is linked.`,
      );
    }
    return submission.teamName;
  }

  if (submission.studentId == null || submission.studentId.length === 0) {
    throw new Error(
      `Submission ${submission.id} has type individual but no student is linked.`,
    );
  }

  return submission.studentId;
}

const COLUMN_PART_SEPARATOR = ":";

function getRubricKey(questionId: string, rubricId: string): string {
  return `${questionId}${COLUMN_PART_SEPARATOR}${rubricId}`;
}

function getAssessmentColumnName(questionId: string, rubricId: string): string {
  return `${getRubricKey(questionId, rubricId)}`;
}

function getMarksColumnName(questionId: string, rubricId: string): string {
  return `${getRubricKey(questionId, rubricId)}${COLUMN_PART_SEPARATOR}marks`;
}

export function buildSubmissionExportHeaders(
  questions: ExportQuestionPlan[],
  options: ExportOptions,
): string[] {
  const headers = ["submission_type", "submitter"];

  for (const question of questions) {
    for (const rubric of question.rubrics) {
      if (options.includeRubricAssessment) {
        headers.push(getAssessmentColumnName(question.id, rubric.id));
      }
      if (options.includeRubricMarks) {
        headers.push(getMarksColumnName(question.id, rubric.id));
      }
    }

    headers.push(question.id);
  }

  headers.push("grand_total_marks");
  return headers;
}

function getRubricAssessmentDisplay(value: AssessmentRubricValue): string {
  switch (value.type) {
    case "boolean": {
      return value.passed ? "true" : "false";
    }
    case "ordinal": {
      return value.selectedLabel;
    }
    case "numerical": {
      return String(value.score);
    }
    default: {
      return assertNever(value);
    }
  }
}

export function buildSubmissionExportRow(params: {
  submission: SubmissionSubmitter;
  questions: ExportQuestionPlan[];
  options: ExportOptions;
  valuesByKey: Map<string, AssessmentRubricValue>;
}): string[] {
  const { submission, questions, options, valuesByKey } = params;
  const row: string[] = [
    submission.type,
    getSubmissionExportIdentifier(submission),
  ];

  let grandTotalMarks = 0;

  for (const question of questions) {
    let questionTotalMarks = 0;

    for (const rubric of question.rubrics) {
      const value = valuesByKey.get(buildAssessmentKey(question.id, rubric.id));
      const rubricMarks =
        value != null ? markRubric({ rubric, value }) : undefined;

      if (options.includeRubricAssessment) {
        row.push(value != null ? getRubricAssessmentDisplay(value) : "");
      }

      if (options.includeRubricMarks) {
        row.push(rubricMarks != null ? String(rubricMarks) : "");
      }

      if (rubricMarks != null) {
        questionTotalMarks += rubricMarks;
      }
    }

    grandTotalMarks += questionTotalMarks;
    row.push(String(questionTotalMarks));
  }

  row.push(String(grandTotalMarks));
  return row;
}

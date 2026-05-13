import type { AssessmentRubricValue, SubmissionSubmitter } from "@/db/types";
import { assertNever } from "@/utils/utils";

export type ExportInclude = "rubric-assessment" | "rubric-marks";

export type ExportOptions = {
  includeRubricAssessment: boolean;
  includeRubricMarks: boolean;
};

export type ExportRubricPlan =
  | {
      id: string;
      label: string;
      type: "boolean";
      marks: number;
    }
  | {
      id: string;
      label: string;
      type: "ordinal";
      marksByLabel: Record<string, number>;
    }
  | {
      id: string;
      label: string;
      type: "numerical";
      minScore: number;
      maxScore: number;
      minMarks: number;
      maxMarks: number;
    };

export type ExportQuestionPlan = {
  id: string;
  label: string;
  rubrics: ExportRubricPlan[];
};

export type SubmissionIdentity = SubmissionSubmitter;

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
  submission: SubmissionIdentity,
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

function numericalScoreToMarks(
  rubric: Extract<ExportRubricPlan, { type: "numerical" }>,
  score: number,
): number {
  const scoreRange = rubric.maxScore - rubric.minScore;
  if (scoreRange <= 0) {
    return rubric.minMarks;
  }

  return (
    rubric.minMarks +
    ((score - rubric.minScore) * (rubric.maxMarks - rubric.minMarks)) /
      scoreRange
  );
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

function getRubricMarks(
  rubric: ExportRubricPlan,
  value: AssessmentRubricValue,
): number {
  switch (rubric.type) {
    case "boolean": {
      if (value.type !== "boolean") {
        return 0;
      }
      return value.passed ? rubric.marks : 0;
    }
    case "ordinal": {
      if (value.type !== "ordinal") {
        return 0;
      }
      return rubric.marksByLabel[value.selectedLabel] ?? 0;
    }
    case "numerical": {
      if (value.type !== "numerical") {
        return 0;
      }
      return numericalScoreToMarks(rubric, value.score);
    }
    default: {
      return assertNever(rubric);
    }
  }
}

export function buildSubmissionExportRow(params: {
  submission: SubmissionIdentity;
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

      if (options.includeRubricAssessment) {
        row.push(value != null ? getRubricAssessmentDisplay(value) : "");
      }

      if (options.includeRubricMarks) {
        if (value == null) {
          row.push("");
        } else {
          row.push(String(getRubricMarks(rubric, value)));
        }
      }

      if (value != null) {
        questionTotalMarks += getRubricMarks(rubric, value);
      }
    }

    grandTotalMarks += questionTotalMarks;
    row.push(String(questionTotalMarks));
  }

  row.push(String(grandTotalMarks));
  return row;
}

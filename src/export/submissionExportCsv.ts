import type { Rubric, SubmissionSubmitter } from "@/db/types";

export type ExportOptions = {
  includeRubricAssessment: boolean;
  includeRubricMarks: boolean;
};

type RubricOfType<TType extends Rubric["type"]> = Extract<
  Rubric,
  { type: TType }
>;

type ExportBooleanRubricPlan = Pick<
  RubricOfType<"boolean">,
  "id" | "type" | "marks" | "falseMarks"
>;

type ExportOrdinalRubricPlan = Pick<
  RubricOfType<"ordinal">,
  "id" | "type" | "marks"
>;

type ExportNumericalRubricPlan = Pick<
  RubricOfType<"numerical">,
  "id" | "type" | "minScore" | "maxScore" | "minMarks" | "maxMarks" | "reversed"
>;

export type ExportRubricPlan =
  | ExportBooleanRubricPlan
  | ExportOrdinalRubricPlan
  | ExportNumericalRubricPlan;

export type ExportQuestionPlan = {
  id: string;
  rubrics: ExportRubricPlan[];
};

export type SubmissionExportAssessmentValue = string | number | boolean;

export type SubmissionExportRubricData = {
  rubricId: string;
  assessment?: SubmissionExportAssessmentValue;
  marks?: number;
};

export type SubmissionExportQuestionData = {
  questionId: string;
  rubrics: SubmissionExportRubricData[];
};

export type SubmissionExportDataRow = {
  submission: SubmissionSubmitter;
  questions: SubmissionExportQuestionData[];
};

export type SubmissionExportValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type SubmissionExportRecord = {
  [columnName: string]: SubmissionExportValue;
};

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

export function buildSubmissionExportRecord(params: {
  row: SubmissionExportDataRow;
  options: ExportOptions;
}): SubmissionExportRecord {
  const {
    row: { submission, questions },
    options,
  } = params;
  const row: SubmissionExportRecord = {
    submission_type: submission.type,
    submitter: getSubmissionExportIdentifier(submission),
  };

  let grandTotalMarks = 0;
  let hasMissingAssessment = false;

  for (const question of questions) {
    let questionTotalMarks = 0;
    let isQuestionFullyAssessed = true;

    for (const rubric of question.rubrics) {
      if (rubric.assessment == null) {
        isQuestionFullyAssessed = false;
      }

      if (options.includeRubricAssessment) {
        const assessmentValue = rubric.assessment;
        if (assessmentValue != null) {
          row[getAssessmentColumnName(question.questionId, rubric.rubricId)] =
            assessmentValue;
        }
      }

      if (options.includeRubricMarks) {
        if (rubric.marks != null) {
          row[getMarksColumnName(question.questionId, rubric.rubricId)] =
            rubric.marks;
        }
      }

      if (rubric.marks != null) {
        questionTotalMarks += rubric.marks;
      }
    }

    if (isQuestionFullyAssessed) {
      grandTotalMarks += questionTotalMarks;
      row[question.questionId] = questionTotalMarks;
      continue;
    }

    hasMissingAssessment = true;
  }

  if (!hasMissingAssessment) {
    row.grand_total_marks = grandTotalMarks;
  }

  return row;
}

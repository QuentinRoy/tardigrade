import {
  attachAssessment,
  getRubricMaxMarks,
  markRubric,
} from "../rubrics/rubric";
import { getSubmissionLabel } from "../submissions/getSubmissionLabel";
import type {
  AssessmentRubricValue,
  Grid,
  Rubric,
  RubricType,
  Submission,
} from "./types";

type RubricPropertyDetails =
  | {
      type: "boolean";
      trueMarks: number;
      falseMarks: number;
    }
  | {
      type: "ordinal";
      marksByLabel: Array<{ label: string; marks: number }>;
    }
  | {
      type: "numerical";
      minScore: number;
      maxScore: number;
      minMarks: number;
      maxMarks: number;
      reversed: boolean;
    };

export type RubricOverviewPopupDetails = {
  label?: string;
  description?: string;
  type: RubricType;
  properties: RubricPropertyDetails;
};

export type RubricOverviewRow = {
  rubricId: string;
  questionId: string;
  questionLabel: string;
  maxMarks: number;
  averageMarks: number | null;
  averagePercent: number | null;
  assessedCount: number;
  totalCount: number;
  completionPercent: number;
  details: RubricOverviewPopupDetails;
};

export type RubricOverviewStudentCell = {
  rubricId: string;
  marks: number | null;
  maxMarks: number;
  assessed: boolean;
};

export type RubricOverviewStudentRow = {
  submissionId: string;
  submissionLabel: string;
  marks: number;
  maxMarks: number;
  averagePercent: number | null;
  completedRubrics: number;
  totalRubrics: number;
  rubrics: RubricOverviewStudentCell[];
};

export type RubricOverviewSummary = {
  assessedRubrics: number;
  totalRubrics: number;
  completionPercent: number;
  classAveragePercent: number | null;
};

export type RubricOverviewData = {
  summary: RubricOverviewSummary;
  rubrics: RubricOverviewRow[];
  students: RubricOverviewStudentRow[];
};

export type RubricOverviewAssessmentRecord = {
  submissionId: number;
  rubricId: string;
  type: RubricType;
  passed: boolean | null;
  selectedLabel: string | null;
  score: number | null;
};

type OrderedRubric = {
  rubric: Rubric;
  rubricId: string;
  questionId: string;
  questionLabel: string;
  maxMarks: number;
};

function toAssessmentValue(
  record: RubricOverviewAssessmentRecord,
): AssessmentRubricValue | null {
  switch (record.type) {
    case "boolean":
      if (record.passed == null) {
        return null;
      }
      return {
        rubricId: record.rubricId,
        type: "boolean",
        passed: record.passed,
      };
    case "ordinal":
      if (record.selectedLabel == null) {
        return null;
      }
      return {
        rubricId: record.rubricId,
        type: "ordinal",
        selectedLabel: record.selectedLabel,
      };
    case "numerical":
      if (record.score == null) {
        return null;
      }
      return {
        rubricId: record.rubricId,
        type: "numerical",
        score: record.score,
      };
    default:
      return null;
  }
}

function toPopupDetails(rubric: Rubric): RubricOverviewPopupDetails {
  switch (rubric.type) {
    case "boolean":
      return {
        label: rubric.label,
        description: rubric.description,
        type: rubric.type,
        properties: {
          type: "boolean",
          trueMarks: rubric.marks,
          falseMarks: rubric.falseMarks,
        },
      };
    case "ordinal":
      return {
        label: rubric.label,
        description: rubric.description,
        type: rubric.type,
        properties: {
          type: "ordinal",
          marksByLabel: Object.entries(rubric.marks).map(([label, marks]) => ({
            label,
            marks,
          })),
        },
      };
    case "numerical":
      return {
        label: rubric.label,
        description: rubric.description,
        type: rubric.type,
        properties: {
          type: "numerical",
          minScore: rubric.minScore,
          maxScore: rubric.maxScore,
          minMarks: rubric.minMarks,
          maxMarks: rubric.maxMarks,
          reversed: rubric.reversed,
        },
      };
  }
}

export function buildRubricOverviewData({
  submissions,
  questionGrid,
  assessmentRecords,
}: {
  submissions: Submission[];
  questionGrid: Grid;
  assessmentRecords: RubricOverviewAssessmentRecord[];
}): RubricOverviewData {
  const orderedRubrics: OrderedRubric[] = [];

  for (const [questionId, question] of Object.entries(questionGrid)) {
    const questionLabel = question.label ?? questionId;
    for (const rubric of question.rubrics) {
      orderedRubrics.push({
        rubric,
        rubricId: rubric.id,
        questionId,
        questionLabel,
        maxMarks: getRubricMaxMarks(rubric),
      });
    }
  }

  const rubricById = new Map(
    orderedRubrics.map((item) => [item.rubricId, item]),
  );

  const rubricStats = new Map(
    orderedRubrics.map((item) => [
      item.rubricId,
      {
        marksSum: 0,
        assessedCount: 0,
      },
    ]),
  );

  const studentRows = new Map(
    submissions.map((submission) => {
      const rubricCells: RubricOverviewStudentCell[] = orderedRubrics.map(
        (item) => ({
          rubricId: item.rubricId,
          marks: null,
          maxMarks: item.maxMarks,
          assessed: false,
        }),
      );

      return [
        submission.id,
        {
          submissionId: submission.id,
          submissionLabel: getSubmissionLabel(submission),
          marks: 0,
          maxMarks: 0,
          averagePercent: null,
          completedRubrics: 0,
          totalRubrics: orderedRubrics.length,
          rubrics: rubricCells,
        },
      ];
    }),
  );

  const rubricCellIndexByRubricId = new Map(
    orderedRubrics.map((rubric, index) => [rubric.rubricId, index]),
  );

  for (const record of assessmentRecords) {
    const rubricMeta = rubricById.get(record.rubricId);
    if (rubricMeta == null) {
      continue;
    }

    const assessmentValue = toAssessmentValue(record);
    if (assessmentValue == null) {
      continue;
    }

    const assessedRubric = attachAssessment(rubricMeta.rubric, assessmentValue);
    const marks = markRubric(assessedRubric);
    const submissionId = String(record.submissionId);
    const student = studentRows.get(submissionId);
    const rubricStat = rubricStats.get(record.rubricId);
    const cellIndex = rubricCellIndexByRubricId.get(record.rubricId);

    if (student == null || rubricStat == null || cellIndex == null) {
      continue;
    }

    const existingCell = student.rubrics[cellIndex];
    if (existingCell == null || existingCell.assessed) {
      continue;
    }

    student.rubrics[cellIndex] = {
      ...existingCell,
      marks,
      assessed: true,
    };

    student.marks += marks;
    student.maxMarks += rubricMeta.maxMarks;
    student.completedRubrics += 1;

    rubricStat.assessedCount += 1;
    rubricStat.marksSum += marks;
  }

  const students = [...studentRows.values()].map((row) => ({
    ...row,
    averagePercent: row.maxMarks > 0 ? (row.marks / row.maxMarks) * 100 : null,
  }));

  const rubrics = orderedRubrics.map((item) => {
    const stats = rubricStats.get(item.rubricId);
    const assessedCount = stats?.assessedCount ?? 0;
    const averageMarks =
      assessedCount > 0 && stats != null
        ? stats.marksSum / assessedCount
        : null;
    const averagePercent =
      averageMarks != null && item.maxMarks > 0
        ? (averageMarks / item.maxMarks) * 100
        : null;

    return {
      rubricId: item.rubricId,
      questionId: item.questionId,
      questionLabel: item.questionLabel,
      maxMarks: item.maxMarks,
      averageMarks,
      averagePercent,
      assessedCount,
      totalCount: submissions.length,
      completionPercent:
        submissions.length > 0 ? (assessedCount / submissions.length) * 100 : 0,
      details: toPopupDetails(item.rubric),
    };
  });

  const assessedRubrics = rubrics.reduce(
    (sum, rubric) => sum + rubric.assessedCount,
    0,
  );
  const totalRubrics = rubrics.reduce(
    (sum, rubric) => sum + rubric.totalCount,
    0,
  );
  const totalMarks = students.reduce((sum, student) => sum + student.marks, 0);
  const totalMaxMarks = students.reduce(
    (sum, student) => sum + student.maxMarks,
    0,
  );

  return {
    summary: {
      assessedRubrics,
      totalRubrics,
      completionPercent:
        totalRubrics > 0 ? (assessedRubrics / totalRubrics) * 100 : 0,
      classAveragePercent:
        totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : null,
    },
    rubrics,
    students,
  };
}

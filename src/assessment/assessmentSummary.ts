import {
  getRubricMaxMarks,
  markBooleanRubric,
  markNumericalRubric,
  markRubric,
} from "../rubrics/rubric";
import type { AssessedRubric } from "./assessment";

export type AssessmentSummary = {
  marks: number;
  maxMarks: number;
  completedRubrics: number;
  totalRubrics: number;
  completedQuestions?: number;
  totalQuestions?: number;
};

function accumulateRubricMarks(
  summary: { marks: number; maxMarks: number },
  rubric: AssessedRubric,
) {
  if (rubric.assessment == null) {
    return;
  }

  const rubricMarks = getRubricMaxMarks(rubric);
  summary.maxMarks += rubricMarks;
  summary.marks += markRubric({ rubric, value: rubric.assessment });

  if (rubric.type === "boolean") {
    summary.marks += markBooleanRubric(rubric, rubric.assessment.passed);
    return;
  }

  if (rubric.type === "ordinal") {
    summary.marks += rubric.marks[rubric.assessment.selectedLabel] ?? 0;
    return;
  }

  summary.marks += markNumericalRubric(rubric, rubric.assessment.score);
}

export function summarizeRubrics(rubrics: AssessedRubric[]): AssessmentSummary {
  const summary = {
    marks: 0,
    maxMarks: 0,
    completedRubrics: 0,
    totalRubrics: 0,
  };

  rubrics.forEach((rubric) => {
    summary.totalRubrics += 1;
    if (rubric.assessment != null) {
      summary.completedRubrics += 1;
    }
    accumulateRubricMarks(summary, rubric);
  });

  return summary;
}

export function summarizeQuestionSections(
  questions: Array<{ rubrics: AssessedRubric[] }>,
): AssessmentSummary {
  const summary = {
    marks: 0,
    maxMarks: 0,
    completedRubrics: 0,
    totalRubrics: 0,
    completedQuestions: 0,
  };

  questions.forEach((question) => {
    let questionRubricsLeft = 0;

    question.rubrics.forEach((rubric) => {
      summary.totalRubrics += 1;

      if (rubric.assessment != null) {
        summary.completedRubrics += 1;
        accumulateRubricMarks(summary, rubric);
      } else {
        questionRubricsLeft += 1;
      }
    });

    if (question.rubrics.length > 0 && questionRubricsLeft === 0) {
      summary.completedQuestions += 1;
    }
  });

  return {
    ...summary,
    totalQuestions: questions.length,
  };
}

import { Simplify } from "@/utils/utils";
import { RubricType, SubmissionType } from "./generated/db";

export * from "./generated/db";

type ProgressMetric = {
  completed: number;
  total: number;
};

export type GlobalAssessmentProgress = {
  submissions: ProgressMetric;
  questions: ProgressMetric;
  rubrics: ProgressMetric;
};

type SubmissionBase = { id: string; type: SubmissionType };
export type Submission = Simplify<
  SubmissionBase &
    (
      | { type: "individual"; studentName: string; teamName?: undefined }
      | { type: "team"; studentId?: undefined; teamName: string }
    )
>;

type RubricBase = {
  id: string;
  description?: string | undefined;
  label?: string | undefined;
  type: RubricType;
};
export type Rubric = Simplify<
  RubricBase &
    (
      | { type: "boolean"; marks: number }
      | { type: "ordinal"; marks: Record<string, number> }
      | {
          type: "numerical";
          minScore: number;
          maxScore: number;
          minMarks: number;
          maxMarks: number;
        }
    )
>;

type AssessmentRubricValueBase = {
  rubricId: string;
  type: RubricType;
};
export type AssessmentRubricValue = Simplify<
  AssessmentRubricValueBase &
    (
      | { type: "boolean"; passed: boolean }
      | { type: "ordinal"; selectedLabel: string }
      | { type: "numerical"; score: number }
    )
>;

export type Question = {
  label?: string;
  rubrics: Rubric[];
  solution?: string;
};

export type Grid = {
  [id: string]: Question;
};

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

type SubmissionBase = {
  id: string;
  type: SubmissionType;
};

type SubmissionDisplay = {
  displayLabel?: string;
  memberNames?: string[];
  searchKeys?: string[];
};

export type Submission =
  | Simplify<
      SubmissionDisplay &
        SubmissionBase & {
          type: "individual";
          studentName: string;
          teamName?: undefined;
        }
    >
  | Simplify<
      SubmissionDisplay &
        SubmissionBase & {
          type: "team";
          studentName?: undefined;
          teamName: string;
        }
    >;

export type SubmissionSubmitter =
  | Simplify<
      SubmissionBase & {
        type: "individual";
        studentId: string;
        teamName?: undefined;
      }
    >
  | Simplify<
      SubmissionBase & {
        type: "team";
        studentId?: undefined;
        teamName: string;
      }
    >;

type RubricBase = {
  id: string;
  description?: string | undefined;
  label?: string | undefined;
  type: RubricType;
};
export type Rubric =
  | Simplify<
      RubricBase & {
        type: "boolean";
        marks: number;
      }
    >
  | Simplify<
      RubricBase & {
        type: "ordinal";
        marks: Record<string, number>;
      }
    >
  | Simplify<
      RubricBase & {
        type: "numerical";
        minScore: number;
        maxScore: number;
        minMarks: number;
        maxMarks: number;
      }
    >;

type AssessmentRubricValueBase = {
  rubricId: string;
  type: RubricType;
};
export type AssessmentRubricValue =
  | Simplify<
      AssessmentRubricValueBase & {
        type: "boolean";
        passed: boolean;
      }
    >
  | Simplify<
      AssessmentRubricValueBase & {
        type: "ordinal";
        selectedLabel: string;
      }
    >
  | Simplify<
      AssessmentRubricValueBase & {
        type: "numerical";
        score: number;
      }
    >;

export type Question = {
  label?: string;
  rubrics: Rubric[];
  solution?: string;
};

export type Grid = {
  [id: string]: Question;
};

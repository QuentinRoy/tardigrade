export type AssessmentRubricValue =
  | {
      rubricId: string;
      type: "boolean";
      passed: boolean;
    }
  | {
      rubricId: string;
      type: "ordinal";
      selectedLabel: string;
    }
  | {
      rubricId: string;
      type: "numerical";
      score: number;
    };

type ProgressMetric = {
  completed: number;
  total: number;
};

export type GlobalAssessmentProgress = {
  submissions: ProgressMetric;
  questions: ProgressMetric;
  rubrics: ProgressMetric;
};

export type Submission = {
  id: string;
  type: "INDIVIDUAL" | "TEAM";
  studentName?: string;
  teamName?: string;
};

export type Rubric =
  | {
      id: string;
      description?: string | undefined;
      label?: string | undefined;
      type: "boolean";
      marks: number;
    }
  | {
      id: string;
      description?: string | undefined;
      label?: string | undefined;
      type: "ordinal";
      marks: Record<string, number>;
    }
  | {
      id: string;
      description?: string | undefined;
      label?: string | undefined;
      type: "numerical";
      minScore: number;
      maxScore: number;
      minMarks: number;
      maxMarks: number;
    };

export type Question = {
  label?: string;
  rubrics: Rubric[];
  solution?: string;
};

export type Grid = {
  [id: string]: Question;
};

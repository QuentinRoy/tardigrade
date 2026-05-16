import type { Rubric } from "@/db/types";

export type QuestionEditorValue = {
  id: string;
  label?: string;
  rubrics: RubricEditorValue[];
};

export type RubricEditorValue =
  | {
      previousId?: string;
      id: string;
      description?: string;
      label?: string;
      type: "boolean";
      marks: number;
      falseMarks?: number;
    }
  | {
      previousId?: string;
      id: string;
      description?: string;
      label?: string;
      type: "ordinal";
      marks: Record<string, number>;
    }
  | {
      previousId?: string;
      id: string;
      description?: string;
      label?: string;
      type: "numerical";
      minScore: number;
      maxScore: number;
      minMarks: number;
      maxMarks: number;
      reversed: boolean;
    };

export type QuestionManagementItem = {
  id: string;
  label?: string;
  position: number;
  assessmentCount: number;
  rubricCount: number;
  question: {
    label?: string;
    rubrics: Rubric[];
  };
};

export function toEditorValue(
  item: QuestionManagementItem,
): QuestionEditorValue {
  return {
    id: item.id,
    label: item.question.label,
    rubrics: item.question.rubrics.map((rubric) => {
      if (rubric.type === "boolean") {
        return {
          previousId: rubric.id,
          id: rubric.id,
          description: rubric.description,
          label: rubric.label,
          type: "boolean",
          marks: rubric.marks,
          falseMarks: rubric.falseMarks,
        };
      }

      if (rubric.type === "ordinal") {
        return {
          previousId: rubric.id,
          id: rubric.id,
          description: rubric.description,
          label: rubric.label,
          type: "ordinal",
          marks: rubric.marks,
        };
      }

      return {
        previousId: rubric.id,
        id: rubric.id,
        description: rubric.description,
        label: rubric.label,
        type: "numerical",
        minScore: rubric.minScore,
        maxScore: rubric.maxScore,
        minMarks: rubric.minMarks,
        maxMarks: rubric.maxMarks,
        reversed: rubric.reversed,
      };
    }),
  };
}

export function createEmptyQuestionEditorValue(): QuestionEditorValue {
  return {
    id: "",
    label: "",
    rubrics: [],
  };
}

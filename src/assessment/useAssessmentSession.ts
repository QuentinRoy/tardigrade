"use client";

import { produce } from "immer";
import { startTransition, useOptimistic, useReducer } from "react";
import type { AssessmentRubricValue, Paper } from "../db/types";
import { type AssessedRubric, attachAssessment } from "./assessment";
import { getPaperNavigation } from "./paperNavigation";

export type SaveRubricResult<TError> =
  | { success: true }
  | { success: false; error: TError };

export type UseAssessmentSessionConfig<TError> = {
  initialRubrics: AssessedRubric[];
  papers: Paper[];
  currentPaperId: string;
  saveRubric: (
    rubric: AssessedRubric,
    assessment: AssessmentRubricValue,
  ) => Promise<SaveRubricResult<TError>>;
  onError: (error: TError) => void;
};

export type UseAssessmentSessionResult = {
  currentPaperIndex: number;
  currentPaper: Paper | undefined;
  previousPaper: Paper | undefined;
  nextPaper: Paper | undefined;
  optimisticRubrics: AssessedRubric[];
  pendingByIndex: Record<number, number>;
  grade: (index: number, assessment: AssessmentRubricValue) => void;
};

type State = {
  savedRubrics: AssessedRubric[];
  pendingByIndex: Record<number, number>;
};

type Action =
  | { type: "save-start"; index: number }
  | { type: "save-success"; index: number; assessment: AssessmentRubricValue }
  | { type: "save-failure"; index: number };

export function useAssessmentSession<TError>({
  initialRubrics,
  papers,
  currentPaperId,
  saveRubric,
  onError,
}: UseAssessmentSessionConfig<TError>): UseAssessmentSessionResult {
  const [{ savedRubrics, pendingByIndex }, dispatch] = useReducer(reducer, {
    savedRubrics: initialRubrics,
    pendingByIndex: {},
  });

  const [optimisticRubrics, addOptimisticUpdate] = useOptimistic(
    savedRubrics,
    (
      current,
      {
        index,
        assessment,
      }: { index: number; assessment: AssessmentRubricValue },
    ) =>
      current.map((rubric, i) =>
        i === index ? attachAssessment(rubric, assessment) : rubric,
      ),
  );

  const { currentPaperIndex, currentPaper, previousPaper, nextPaper } =
    getPaperNavigation(papers, currentPaperId);

  function grade(index: number, assessment: AssessmentRubricValue) {
    const rubric = savedRubrics[index];

    if (rubric == null || isSameAssessment(rubric, assessment)) {
      return;
    }

    dispatch({ type: "save-start", index });

    startTransition(async () => {
      addOptimisticUpdate({ index, assessment });

      const result = await saveRubric(rubric, assessment);

      if (result.success) {
        dispatch({ type: "save-success", index, assessment });
        return;
      }

      dispatch({ type: "save-failure", index });
      onError(result.error);
    });
  }

  return {
    currentPaperIndex,
    currentPaper,
    previousPaper,
    nextPaper,
    optimisticRubrics,
    pendingByIndex,
    grade,
  };
}

function reducer(state: State, action: Action): State {
  return produce(state, (draft) => {
    switch (action.type) {
      case "save-start": {
        draft.pendingByIndex[action.index] =
          (draft.pendingByIndex[action.index] ?? 0) + 1;
        break;
      }
      case "save-success": {
        draft.pendingByIndex[action.index] = Math.max(
          0,
          (draft.pendingByIndex[action.index] ?? 0) - 1,
        );
        if (draft.savedRubrics[action.index] != null) {
          draft.savedRubrics[action.index] = attachAssessment(
            draft.savedRubrics[action.index],
            action.assessment,
          );
        }
        break;
      }
      case "save-failure": {
        draft.pendingByIndex[action.index] = Math.max(
          0,
          (draft.pendingByIndex[action.index] ?? 0) - 1,
        );
        break;
      }
      default:
        break;
    }
  });
}

function isSameAssessment(
  rubric: AssessedRubric,
  right: AssessmentRubricValue,
): boolean {
  if (
    rubric.assessment == null ||
    right.rubricId !== rubric.id ||
    right.type !== rubric.type
  ) {
    return false;
  }

  if (right.type === "boolean") {
    const assessment =
      rubric.assessment as AssessedRubric<"boolean">["assessment"];
    return assessment?.passed === right.passed;
  }

  if (right.type === "ordinal") {
    const assessment =
      rubric.assessment as AssessedRubric<"ordinal">["assessment"];
    return assessment?.selectedLabel === right.selectedLabel;
  }

  const assessment =
    rubric.assessment as AssessedRubric<"numerical">["assessment"];
  return assessment?.score === right.score;
}

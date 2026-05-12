"use client";

import { produce } from "immer";
import { startTransition, useOptimistic, useReducer } from "react";
import type { Paper } from "../papers/loadPapers";
import { attachGrading, type GradedRubric, type Grading } from "./grading";
import { getPaperNavigation } from "./paperNavigation";

export type SaveRubricResult<TError> =
  | { success: true }
  | { success: false; error: TError };

export type UseGradingSessionConfig<TError> = {
  initialRubrics: GradedRubric[];
  papers: Paper[];
  currentPaperId: string;
  saveRubric: (
    rubric: GradedRubric,
    grading: Grading,
  ) => Promise<SaveRubricResult<TError>>;
  onError: (error: TError) => void;
};

export type UseGradingSessionResult = {
  currentPaperIndex: number;
  currentPaper: Paper | undefined;
  previousPaper: Paper | undefined;
  nextPaper: Paper | undefined;
  optimisticRubrics: GradedRubric[];
  pendingByIndex: Record<number, number>;
  grade: (index: number, grading: Grading) => void;
};

type State = {
  savedRubrics: GradedRubric[];
  pendingByIndex: Record<number, number>;
};

type Action =
  | { type: "save-start"; index: number }
  | { type: "save-success"; index: number; grading: Grading }
  | { type: "save-failure"; index: number };

export function useGradingSession<TError>({
  initialRubrics,
  papers,
  currentPaperId,
  saveRubric,
  onError,
}: UseGradingSessionConfig<TError>): UseGradingSessionResult {
  const [{ savedRubrics, pendingByIndex }, dispatch] = useReducer(reducer, {
    savedRubrics: initialRubrics,
    pendingByIndex: {},
  });

  const [optimisticRubrics, addOptimisticUpdate] = useOptimistic(
    savedRubrics,
    (current, { index, grading }: { index: number; grading: Grading }) =>
      current.map((rubric, i) =>
        i === index ? attachGrading(rubric, grading) : rubric,
      ),
  );

  const { currentPaperIndex, currentPaper, previousPaper, nextPaper } =
    getPaperNavigation(papers, currentPaperId);

  function grade(index: number, grading: Grading) {
    const rubric = savedRubrics[index];
    const currentGrading = optimisticRubrics[index]?.grading;

    if (rubric == null || currentGrading === grading) {
      return;
    }

    dispatch({ type: "save-start", index });

    startTransition(async () => {
      addOptimisticUpdate({ index, grading });

      const result = await saveRubric(rubric, grading);

      if (result.success) {
        dispatch({ type: "save-success", index, grading });
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
          draft.savedRubrics[action.index] = attachGrading(
            draft.savedRubrics[action.index],
            action.grading,
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

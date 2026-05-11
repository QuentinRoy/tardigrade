"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { produce } from "immer";
import NextLink from "next/link";
import {
  type ReactElement,
  startTransition,
  useMemo,
  useOptimistic,
  useReducer,
} from "react";
import type { Paper as GradingPaper } from "../papers/loadPapers";
import { getRubricMaxMarks } from "../rubrics/rubric";
import { useSaveErrors } from "../shared/SaveErrorsProvider";
import GradingProgressSummary from "./GradingProgressSummary";
import { attachGrading, type GradedRubric, type Grading } from "./grading";
import RubricGradeList from "./RubricGradeList";
import { saveRubricGrading } from "./saveRubricGrading";

type QuestionGradingSection = {
  questionId: string;
  questionLabel: string;
  rubrics: GradedRubric[];
};

type QuestionGradingUpdate = {
  questionId: string;
  index: number;
  grading: Grading;
};

type State = {
  savedQuestions: QuestionGradingSection[];
  pendingByQuestionId: Record<string, Record<number, number>>;
};

type Action =
  | {
      type: "save-start";
      questionId: string;
      index: number;
    }
  | {
      type: "save-success";
      questionId: string;
      index: number;
      grading: Grading;
    }
  | {
      type: "save-failure";
      questionId: string;
      index: number;
    };

type PaperOverviewGradingClientProps = {
  questions: QuestionGradingSection[];
  papers: GradingPaper[];
  currentPaperId: string;
};

export default function PaperOverviewGradingClient({
  questions: initialQuestions,
  papers,
  currentPaperId,
}: PaperOverviewGradingClientProps): ReactElement {
  const { addError } = useSaveErrors();

  const [{ savedQuestions, pendingByQuestionId }, dispatch] = useReducer(
    reducer,
    {
      savedQuestions: initialQuestions,
      pendingByQuestionId: {},
    },
  );

  const [optimisticQuestions, addOptimisticUpdate] = useOptimistic(
    savedQuestions,
    (current: QuestionGradingSection[], update: QuestionGradingUpdate) =>
      current.map((question) => {
        if (question.questionId !== update.questionId) {
          return question;
        }

        return {
          ...question,
          rubrics: question.rubrics.map((rubric, currentIndex) =>
            currentIndex === update.index
              ? attachGrading(rubric, update.grading)
              : rubric,
          ),
        };
      }),
  );

  const { currentPaperIndex, currentPaper, previousPaper, nextPaper } =
    useMemo(() => {
      const currentPaperIndex = papers.findIndex(
        (paper) => paper.id === currentPaperId,
      );
      const currentPaper =
        currentPaperIndex === -1 ? undefined : papers[currentPaperIndex];
      const previousPaper =
        currentPaperIndex > 0 ? papers[currentPaperIndex - 1] : undefined;
      const nextPaper =
        currentPaperIndex >= 0 && currentPaperIndex < papers.length - 1
          ? papers[currentPaperIndex + 1]
          : undefined;
      return { currentPaperIndex, currentPaper, previousPaper, nextPaper };
    }, [papers, currentPaperId]);

  const summary = useMemo(() => {
    let marks = 0;
    let maxMarks = 0;
    let completedRubrics = 0;
    let totalRubrics = 0;
    let completedQuestions = 0;

    optimisticQuestions.forEach((question) => {
      let questionRubricsLeft = 0;

      question.rubrics.forEach((rubric) => {
        const rubricMarks = getRubricMaxMarks(rubric);
        totalRubrics += 1;

        if (rubric.grading != null) {
          completedRubrics += 1;
          maxMarks += rubricMarks;

          if (rubric.type === "boolean") {
            if (rubric.grading === true) {
              marks += rubricMarks;
            }
          } else if (rubric.type === "ordinal") {
            marks += rubric.values[rubric.grading] ?? 0;
          } else {
            marks += rubric.grading;
          }
        } else {
          questionRubricsLeft += 1;
        }
      });

      if (question.rubrics.length > 0 && questionRubricsLeft === 0) {
        completedQuestions += 1;
      }
    });

    return {
      marks,
      maxMarks,
      completedRubrics,
      totalRubrics,
      completedQuestions,
      totalQuestions: optimisticQuestions.length,
    };
  }, [optimisticQuestions]);

  function handleGrade(
    questionId: string,
    questionLabel: string,
    index: number,
    grading: Grading,
  ) {
    const question = savedQuestions.find(
      (item) => item.questionId === questionId,
    );
    const rubric = question?.rubrics[index];
    const optimisticQuestion = optimisticQuestions.find(
      (item) => item.questionId === questionId,
    );
    const currentGrading = optimisticQuestion?.rubrics[index]?.grading;

    if (rubric == null || currentGrading === grading) {
      return;
    }

    dispatch({ type: "save-start", questionId, index });

    startTransition(async () => {
      addOptimisticUpdate({ questionId, index, grading });
      const result = await saveRubricGrading({
        paperId: currentPaperId,
        questionId,
        rubricId: rubric.id,
        grading,
      });

      if (result.success) {
        dispatch({ type: "save-success", questionId, index, grading });
      } else {
        dispatch({ type: "save-failure", questionId, index });
        addError({
          questionId,
          paperId: currentPaperId,
          questionLabel,
          paperLabel: currentPaper?.label,
          message: result.error,
        });
      }
    });
  }

  if (currentPaper == null) {
    return (
      <Typography variant="body1" sx={{ mb: 3 }}>
        No papers found in database.
      </Typography>
    );
  }

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          mb: 2,
          p: 2,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Current paper
        </Typography>
        <Typography variant="h6">{currentPaper.label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {currentPaper.id}
        </Typography>
      </Paper>

      <PaperNavigation
        questionCount={summary.totalQuestions}
        currentPaperId={currentPaperId}
        currentPaperIndex={currentPaperIndex}
        totalPapers={papers.length}
        previousPaperId={previousPaper?.id}
        nextPaperId={nextPaper?.id}
      />

      {optimisticQuestions.length === 0 ? (
        <Typography variant="body1" sx={{ mb: 4 }}>
          No questions found in database.
        </Typography>
      ) : (
        optimisticQuestions.map((question) => {
          const questionPendingByIndex =
            pendingByQuestionId[question.questionId] ?? {};
          const completedRubrics = question.rubrics.filter(
            (rubric) => rubric.grading != null,
          ).length;

          return (
            <Box key={question.questionId} sx={{ mb: 3 }}>
              <Box sx={{ mb: 1.5 }}>
                <Typography component="h2" variant="h5">
                  {question.questionLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {completedRubrics} / {question.rubrics.length} rubrics graded
                </Typography>
              </Box>

              {question.rubrics.map((rubric, index) => (
                <Paper
                  key={rubric.id}
                  variant="outlined"
                  sx={{ mb: 1.5, p: 2 }}
                >
                  <RubricGradeList
                    rubrics={[rubric]}
                    pendingByIndex={{ 0: questionPendingByIndex[index] ?? 0 }}
                    disabled={false}
                    onGrade={(_, grading) =>
                      handleGrade(
                        question.questionId,
                        question.questionLabel,
                        index,
                        grading,
                      )
                    }
                  />
                </Paper>
              ))}
            </Box>
          );
        })
      )}

      <GradingProgressSummary
        marks={summary.marks}
        maxMarks={summary.maxMarks}
        completedRubrics={summary.completedRubrics}
        totalRubrics={summary.totalRubrics}
      />

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        {summary.completedQuestions} / {summary.totalQuestions} questions fully
        graded
      </Typography>

      <PaperNavigation
        questionCount={summary.totalQuestions}
        currentPaperId={currentPaperId}
        currentPaperIndex={currentPaperIndex}
        totalPapers={papers.length}
        previousPaperId={previousPaper?.id}
        nextPaperId={nextPaper?.id}
      />
    </>
  );
}

function PaperNavigation({
  questionCount,
  currentPaperId,
  currentPaperIndex,
  totalPapers,
  previousPaperId,
  nextPaperId,
}: {
  questionCount: number;
  currentPaperId: string;
  currentPaperIndex: number;
  totalPapers: number;
  previousPaperId?: string;
  nextPaperId?: string;
}): ReactElement {
  return (
    <Box sx={{ mb: 4, display: "flex", gap: 1, flexWrap: "wrap" }}>
      <Button
        component={NextLink}
        href={`/grading/papers/${previousPaperId ?? currentPaperId}`}
        variant="outlined"
        disabled={previousPaperId == null}
      >
        Previous paper
      </Button>
      <Button
        component={NextLink}
        href={`/grading/papers/${nextPaperId ?? currentPaperId}`}
        variant="outlined"
        disabled={nextPaperId == null}
      >
        Next paper
      </Button>
      <Typography variant="body2" sx={{ alignSelf: "center", ml: 1 }}>
        {currentPaperIndex + 1} / {totalPapers} papers
      </Typography>
      <Typography variant="body2" sx={{ alignSelf: "center" }}>
        {questionCount} questions
      </Typography>
    </Box>
  );
}

function reducer(state: State, action: Action): State {
  return produce(state, (draft) => {
    const pendingForQuestion =
      draft.pendingByQuestionId[action.questionId] ??
      (draft.pendingByQuestionId[action.questionId] = {});

    switch (action.type) {
      case "save-start": {
        const current = pendingForQuestion[action.index] ?? 0;
        pendingForQuestion[action.index] = current + 1;
        break;
      }
      case "save-success": {
        pendingForQuestion[action.index] = Math.max(
          0,
          (pendingForQuestion[action.index] ?? 0) - 1,
        );

        const question = draft.savedQuestions.find(
          (item) => item.questionId === action.questionId,
        );
        if (question?.rubrics[action.index] != null) {
          question.rubrics[action.index] = attachGrading(
            question.rubrics[action.index],
            action.grading,
          );
        }
        break;
      }
      case "save-failure": {
        pendingForQuestion[action.index] = Math.max(
          0,
          (pendingForQuestion[action.index] ?? 0) - 1,
        );
        break;
      }
      default:
        break;
    }
  });
}

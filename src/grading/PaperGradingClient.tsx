"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import type { ReactElement } from "react";
import type { Paper } from "../papers/loadPapers";
import { type SaveError, useSaveErrors } from "../shared/SaveErrorsProvider";
import GradingProgressSummary from "./GradingProgressSummary";
import { type GradedRubric, type Grading } from "./grading";
import { summarizeRubrics } from "./gradingSummary";
import RubricGradeList from "./RubricGradeList";
import { saveRubricGrading } from "./saveRubricGrading";
import { useGradingSession } from "./useGradingSession";

type PaperGradingClientProps = {
  questionId: string;
  questionLabel?: string;
  rubrics: GradedRubric[];
  papers: Paper[];
  currentPaperId: string;
};

export default function PaperGradingClient({
  questionId,
  questionLabel,
  rubrics: initialRubrics,
  papers,
  currentPaperId,
}: PaperGradingClientProps): ReactElement {
  const { addError } = useSaveErrors();
  const currentPaperLabel = papers.find(
    (paper) => paper.id === currentPaperId,
  )?.label;

  const {
    currentPaperIndex,
    currentPaper,
    previousPaper,
    nextPaper,
    optimisticRubrics,
    pendingByIndex,
    grade,
  } = useGradingSession<Omit<SaveError, "id">>({
    initialRubrics,
    papers,
    currentPaperId,
    saveRubric: async (rubric: GradedRubric, grading: Grading) => {
      const result = await saveRubricGrading({
        paperId: currentPaperId,
        questionId,
        rubricId: rubric.id,
        grading,
      });
      if (result.success) {
        return { success: true };
      }
      return {
        success: false,
        error: {
          paperId: currentPaperId,
          paperLabel: currentPaperLabel,
          questionId,
          questionLabel,
          message: result.error,
        },
      };
    },
    onError: addError,
  });

  const { marks, maxMarks, completedRubrics, totalRubrics } =
    summarizeRubrics(optimisticRubrics);
  const isCompleted = totalRubrics > 0 && completedRubrics === totalRubrics;

  if (currentPaper == null) {
    return (
      <Typography variant="body1" sx={{ mb: 3 }}>
        No papers found in database.
      </Typography>
    );
  }

  return (
    <>
      <Box
        sx={{
          mb: 2,
          p: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Current paper
        </Typography>
        <Typography variant="h6">{currentPaper.label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {currentPaper.id}
        </Typography>
      </Box>

      <Box sx={{ mb: 4, display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button
          component={NextLink}
          href={`/grading/papers/${previousPaper?.id ?? currentPaperId}/questions/${questionId}`}
          variant="outlined"
          color={isCompleted ? "primary" : "secondary"}
          disabled={previousPaper == null}
        >
          Previous paper
        </Button>
        <Button
          component={NextLink}
          href={`/grading/papers/${nextPaper?.id ?? currentPaperId}/questions/${questionId}`}
          variant="outlined"
          color={isCompleted ? "primary" : "secondary"}
          disabled={nextPaper == null}
        >
          Next paper
        </Button>
        <Typography variant="body2" sx={{ alignSelf: "center", ml: 1 }}>
          {currentPaperIndex + 1} / {papers.length}
        </Typography>
      </Box>

      <RubricGradeList
        rubrics={optimisticRubrics}
        pendingByIndex={pendingByIndex}
        disabled={currentPaper == null}
        onGrade={(index, grading) => grade(index, grading)}
      />

      <GradingProgressSummary
        marks={marks}
        maxMarks={maxMarks}
        completedRubrics={completedRubrics}
        totalRubrics={totalRubrics}
      />
    </>
  );
}

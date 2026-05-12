"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import type { ReactElement } from "react";
import type { AssessmentRubricValue, Paper } from "../db/types";
import { type SaveError, useSaveErrors } from "../shared/SaveErrorsProvider";
import AssessmentProgressSummary from "./AssessmentProgressSummary";
import { type AssessedRubric } from "./assessment";
import { summarizeRubrics } from "./assessmentSummary";
import RubricGradeList from "./RubricGradeList";
import { saveAssessment } from "./saveAssessment";
import { useAssessmentSession } from "./useAssessmentSession";

type PaperAssessmentClientProps = {
  questionId: string;
  questionLabel?: string;
  rubrics: AssessedRubric[];
  papers: Paper[];
  currentPaperId: string;
};

export default function PaperAssessmentClient({
  questionId,
  questionLabel,
  rubrics: initialRubrics,
  papers,
  currentPaperId,
}: PaperAssessmentClientProps): ReactElement {
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
  } = useAssessmentSession<Omit<SaveError, "id">>({
    initialRubrics,
    papers,
    currentPaperId,
    saveRubric: async (
      _rubric: AssessedRubric,
      rubric: AssessmentRubricValue,
    ) => {
      const result = await saveAssessment({
        paperId: currentPaperId,
        questionId,
        rubric,
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
          href={`/assessments/papers/${previousPaper?.id ?? currentPaperId}/questions/${questionId}`}
          variant="outlined"
          color={isCompleted ? "primary" : "secondary"}
          disabled={previousPaper == null}
        >
          Previous paper
        </Button>
        <Button
          component={NextLink}
          href={`/assessments/papers/${nextPaper?.id ?? currentPaperId}/questions/${questionId}`}
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
        onGrade={(index, assessment) => grade(index, assessment)}
      />

      <AssessmentProgressSummary
        marks={marks}
        maxMarks={maxMarks}
        completedRubrics={completedRubrics}
        totalRubrics={totalRubrics}
      />
    </>
  );
}

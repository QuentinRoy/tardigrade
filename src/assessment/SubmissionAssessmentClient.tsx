"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import type { ReactElement } from "react";
import type { AssessmentRubricValue, Submission } from "../db/types";
import { type SaveError, useSaveErrors } from "../shared/SaveErrorsProvider";
import { getSubmissionLabel } from "../submissions/getSubmissionLabel";
import AssessmentProgressSummary from "./AssessmentProgressSummary";
import { type AssessedRubric } from "./assessment";
import { summarizeRubrics } from "./assessmentSummary";
import RubricGradeList from "./RubricGradeList";
import { saveAssessment } from "./saveAssessment";
import { useAssessmentSession } from "./useAssessmentSession";

type SubmissionAssessmentClientProps = {
  questionId: string;
  questionLabel?: string;
  rubrics: AssessedRubric[];
  submissions: Submission[];
  currentSubmissionId: string;
};

export default function SubmissionAssessmentClient({
  questionId,
  questionLabel,
  rubrics: initialRubrics,
  submissions,
  currentSubmissionId,
}: SubmissionAssessmentClientProps): ReactElement {
  const { addError } = useSaveErrors();
  const currentSubmission = submissions.find(
    (submission) => submission.id === currentSubmissionId,
  );
  const currentSubmissionLabel =
    currentSubmission != null
      ? getSubmissionLabel(currentSubmission)
      : undefined;

  const {
    currentSubmissionIndex,
    currentSubmission: sessionCurrentSubmission,
    previousSubmission,
    nextSubmission,
    optimisticRubrics,
    pendingByIndex,
    assess,
  } = useAssessmentSession<Omit<SaveError, "id">>({
    initialRubrics,
    submissions,
    currentSubmissionId,
    saveRubric: async (
      _rubric: AssessedRubric,
      rubric: AssessmentRubricValue,
    ) => {
      const result = await saveAssessment({
        submissionId: currentSubmissionId,
        questionId,
        rubric,
      });
      if (result.success) {
        return { success: true };
      }
      return {
        success: false,
        error: {
          submissionId: currentSubmissionId,
          submissionLabel: currentSubmissionLabel,
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

  if (sessionCurrentSubmission == null || currentSubmission == null) {
    return (
      <Typography variant="body1" sx={{ mb: 3 }}>
        No submissions found in database.
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
          Current submission
        </Typography>
        <Typography variant="h6">
          {getSubmissionLabel(currentSubmission)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {currentSubmission.id}
        </Typography>
      </Box>

      <Box sx={{ mb: 4, display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button
          component={NextLink}
          href={`/assessments/submissions/${previousSubmission?.id ?? currentSubmissionId}/questions/${questionId}`}
          variant="outlined"
          color={isCompleted ? "primary" : "secondary"}
          disabled={previousSubmission == null}
        >
          Previous submission
        </Button>
        <Button
          component={NextLink}
          href={`/assessments/submissions/${nextSubmission?.id ?? currentSubmissionId}/questions/${questionId}`}
          variant="outlined"
          color={isCompleted ? "primary" : "secondary"}
          disabled={nextSubmission == null}
        >
          Next submission
        </Button>
        <Typography variant="body2" sx={{ alignSelf: "center", ml: 1 }}>
          {currentSubmissionIndex + 1} / {submissions.length}
        </Typography>
      </Box>

      <RubricGradeList
        rubrics={optimisticRubrics}
        pendingByIndex={pendingByIndex}
        disabled={sessionCurrentSubmission == null}
        onAssess={(index, assessment) => assess(index, assessment)}
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

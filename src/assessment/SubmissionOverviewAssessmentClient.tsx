"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { AssessmentRubricValue, Submission } from "../db/types";
import { type SaveError, useSaveErrors } from "../shared/SaveErrorsProvider";
import { getSubmissionLabel } from "../submissions/getSubmissionLabel";
import AssessmentProgressSummary from "./AssessmentProgressSummary";
import { type AssessedRubric } from "./assessment";
import { summarizeRubrics } from "./assessmentSummary";
import RubricGradeList from "./RubricGradeList";
import { saveAssessment } from "./saveAssessment";
import { useAssessmentSession } from "./useAssessmentSession";

type QuestionAssessmentSection = {
  questionId: string;
  questionLabel: string;
  rubrics: AssessedRubric[];
};

type OptimisticQuestionSection = {
  questionId: string;
  questionLabel: string;
  rubrics: AssessedRubric[];
  flatIndices: Array<number | undefined>;
};

type SubmissionOverviewAssessmentClientProps = {
  questions: QuestionAssessmentSection[];
  submissions: Submission[];
  currentSubmissionId: string;
};

export default function SubmissionOverviewAssessmentClient({
  questions: initialQuestions,
  submissions,
  currentSubmissionId,
}: SubmissionOverviewAssessmentClientProps): ReactElement {
  const { addError } = useSaveErrors();
  const currentSubmission = submissions.find(
    (submission) => submission.id === currentSubmissionId,
  );
  const currentSubmissionLabel =
    currentSubmission != null
      ? getSubmissionLabel(currentSubmission)
      : undefined;

  const { initialRubrics, rubricInfoByRubricId } = useMemo(() => {
    const rubrics: AssessedRubric[] = [];
    const infoMap = new Map<
      string,
      { questionId: string; questionLabel: string }
    >();

    for (const question of initialQuestions) {
      for (const rubric of question.rubrics) {
        rubrics.push(rubric);
        infoMap.set(rubric.id, {
          questionId: question.questionId,
          questionLabel: question.questionLabel,
        });
      }
    }

    return { initialRubrics: rubrics, rubricInfoByRubricId: infoMap };
  }, [initialQuestions]);

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
      rubric: AssessedRubric,
      assessment: AssessmentRubricValue,
    ) => {
      const info = rubricInfoByRubricId.get(rubric.id);

      if (info == null) {
        return {
          success: false,
          error: {
            submissionId: currentSubmissionId,
            submissionLabel: currentSubmissionLabel,
            questionId: "unknown-question",
            questionLabel: "Unknown question",
            message: `Unknown rubric mapping for ${rubric.id}`,
          },
        };
      }

      const result = await saveAssessment({
        rubric: assessment,
        submissionId: currentSubmissionId,
        questionId: info.questionId,
      });

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: {
          submissionId: currentSubmissionId,
          submissionLabel: currentSubmissionLabel,
          questionId: info.questionId,
          questionLabel: info.questionLabel,
          message: result.error,
        },
      };
    },
    onError: addError,
  });

  const optimisticQuestions = useMemo<OptimisticQuestionSection[]>(() => {
    const rubricToFlatIndex = new Map<string, number>();

    for (let i = 0; i < optimisticRubrics.length; i++) {
      rubricToFlatIndex.set(optimisticRubrics[i].id, i);
    }

    return initialQuestions.map((question) => ({
      questionId: question.questionId,
      questionLabel: question.questionLabel,
      rubrics: question.rubrics.map((rubric) => {
        const flatIndex = rubricToFlatIndex.get(rubric.id);
        return flatIndex != null
          ? (optimisticRubrics[flatIndex] ?? rubric)
          : rubric;
      }),
      flatIndices: question.rubrics.map((rubric) =>
        rubricToFlatIndex.get(rubric.id),
      ),
    }));
  }, [initialQuestions, optimisticRubrics]);

  const summary = summarizeRubrics(optimisticRubrics);

  if (sessionCurrentSubmission == null || currentSubmission == null) {
    return (
      <Typography variant="body1" sx={{ mb: 3 }}>
        No submissions found in database.
      </Typography>
    );
  }

  return (
    <>
      <SubmissionNavigation
        currentSubmissionId={currentSubmissionId}
        currentSubmissionIndex={currentSubmissionIndex}
        totalSubmissions={submissions.length}
        previousSubmissionId={previousSubmission?.id}
        nextSubmissionId={nextSubmission?.id}
      />

      {optimisticQuestions.length === 0 ? (
        <Typography variant="body1" sx={{ mb: 4 }}>
          No questions found in database.
        </Typography>
      ) : (
        optimisticQuestions.map((question) => (
          <Box key={question.questionId} sx={{ mb: 4 }}>
            <Box sx={{ mb: 2 }}>
              <Typography component="h2" variant="h5">
                {question.questionLabel}
              </Typography>
            </Box>

            {question.rubrics.map((rubric, localIndex) => {
              const flatIndex = question.flatIndices[localIndex];
              return (
                <RubricGradeList
                  key={rubric.id}
                  rubrics={[rubric]}
                  pendingByIndex={{
                    0: flatIndex != null ? (pendingByIndex[flatIndex] ?? 0) : 0,
                  }}
                  disabled={false}
                  onAssess={(_, assessment) => {
                    if (flatIndex != null) {
                      assess(flatIndex, assessment);
                    }
                  }}
                />
              );
            })}
          </Box>
        ))
      )}

      <AssessmentProgressSummary
        marks={summary.marks}
        maxMarks={summary.maxMarks}
        completedRubrics={summary.completedRubrics}
        totalRubrics={summary.totalRubrics}
      />
    </>
  );
}

function SubmissionNavigation({
  currentSubmissionId,
  currentSubmissionIndex,
  totalSubmissions,
  previousSubmissionId,
  nextSubmissionId,
}: {
  currentSubmissionId: string;
  currentSubmissionIndex: number;
  totalSubmissions: number;
  previousSubmissionId?: string;
  nextSubmissionId?: string;
}): ReactElement {
  return (
    <Box sx={{ mb: 4, display: "flex", gap: 1, flexWrap: "wrap" }}>
      <Button
        component={NextLink}
        href={`/assessments/submissions/${previousSubmissionId ?? currentSubmissionId}`}
        variant="outlined"
        disabled={previousSubmissionId == null}
      >
        Previous submission
      </Button>
      <Button
        component={NextLink}
        href={`/assessments/submissions/${nextSubmissionId ?? currentSubmissionId}`}
        variant="outlined"
        disabled={nextSubmissionId == null}
      >
        Next submission
      </Button>
      <Typography variant="body2" sx={{ alignSelf: "center", ml: 1 }}>
        {currentSubmissionIndex + 1} / {totalSubmissions} submissions
      </Typography>
    </Box>
  );
}

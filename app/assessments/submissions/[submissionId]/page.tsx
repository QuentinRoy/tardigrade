import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { attachAssessment } from "@/assessment/assessment";
import SubmissionOverviewAssessmentClient from "@/assessment/SubmissionOverviewAssessmentClient";
import { loadAssessment } from "@/db/assessments";
import { loadQuestions } from "@/db/questions";
import { loadSubmissionOverviewProgress } from "@/db/submissionProgress";
import { loadSubmissions } from "@/db/submissions";
import MuiNextLink from "@/shared/MuiNextLink";
import { getSubmissionLabel } from "@/submissions/getSubmissionLabel";

type PageParams = {
  submissionId: string;
};

type SubmissionPageProps = {
  params: Promise<PageParams>;
};

export default function SubmissionPage({ params }: SubmissionPageProps) {
  return <SubmissionPageContent params={params} />;
}

async function SubmissionPageContent({ params }: SubmissionPageProps) {
  const { submissionId } = await params;

  const [submissions, questionGrid, progressBySubmissionId] = await Promise.all(
    [loadSubmissions(), loadQuestions(), loadSubmissionOverviewProgress()],
  );
  const currentSubmission = submissions.find((s) => s.id === submissionId);

  if (currentSubmission == null) {
    notFound();
  }

  const questions = Object.entries(questionGrid).map(
    ([questionId, question]) => ({
      questionId,
      questionLabel: question.label ?? questionId,
      rubrics: question.rubrics,
    }),
  );

  const assessments = await Promise.all(
    questions.map((question) =>
      loadAssessment(submissionId, question.questionId),
    ),
  );

  const gradedQuestions = questions.map((question, index) => ({
    questionId: question.questionId,
    questionLabel: question.questionLabel,
    rubrics: question.rubrics.map((rubric) =>
      attachAssessment(rubric, assessments[index]),
    ),
  }));

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box component="header" sx={{ pb: 2 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <MuiNextLink color="inherit" href="/assessments">
            Assessments
          </MuiNextLink>
          <Typography color="textPrimary">
            {getSubmissionLabel(currentSubmission)}
          </Typography>
        </Breadcrumbs>
        <Typography component="h1" variant="h4" gutterBottom sx={{ mt: 1 }}>
          {getSubmissionLabel(currentSubmission)}
        </Typography>
      </Box>

      <SubmissionOverviewAssessmentClient
        currentSubmissionId={submissionId}
        submissions={submissions}
        progressBySubmissionId={progressBySubmissionId}
        questions={gradedQuestions}
      />
    </Container>
  );
}

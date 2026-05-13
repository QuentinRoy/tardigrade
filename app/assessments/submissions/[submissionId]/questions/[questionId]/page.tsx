import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { attachAssessment } from "@/assessment/assessment";
import SubmissionAssessmentClient from "@/assessment/SubmissionAssessmentClient";
import { loadAssessment } from "@/db/assessments";
import { loadQuestion } from "@/db/questions";
import { loadSubmissionQuestionProgress } from "@/db/submissionProgress";
import { loadSubmissions } from "@/db/submissions";
import CodeSnippet from "@/shared/CodeSnippet";
import MuiNextLink from "@/shared/MuiNextLink";

type PageParams = {
  submissionId: string;
  questionId: string;
};

type QuestionSubmissionPageProps = {
  params: Promise<PageParams>;
};

export default function QuestionSubmissionPage({
  params,
}: QuestionSubmissionPageProps) {
  return <QuestionSubmissionPageContent params={params} />;
}

async function QuestionSubmissionPageContent({
  params,
}: QuestionSubmissionPageProps) {
  const { submissionId, questionId } = await params;

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <QuestionHeaderSection questionId={questionId} />
      <SubmissionRubricSection
        questionId={questionId}
        submissionId={submissionId}
      />
    </Container>
  );
}

async function QuestionHeaderSection({ questionId }: { questionId: string }) {
  "use cache";
  cacheTag("questions", `questions:${questionId}`);
  const question = await loadQuestion(questionId);

  if (question == null) {
    notFound();
  }

  return (
    <>
      <Box component="header" sx={{ pb: 2 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <MuiNextLink color="inherit" href="/assessments">
            Assessments
          </MuiNextLink>
          <Typography color="textPrimary">
            {question.label ?? questionId}
          </Typography>
        </Breadcrumbs>
      </Box>

      <Box component="section">
        <Typography component="h1" variant="h4" gutterBottom>
          {question.label ?? questionId}
        </Typography>

        {question.solution && (
          <Box sx={{ mb: 2 }}>
            <CodeSnippet>{question.solution}</CodeSnippet>
          </Box>
        )}
      </Box>
    </>
  );
}

async function SubmissionRubricSection({
  questionId,
  submissionId,
}: {
  questionId: string;
  submissionId: string;
}) {
  const [question, submissions, assessments, progressBySubmissionId] =
    await Promise.all([
      loadQuestion(questionId),
      loadSubmissions(),
      loadAssessment(submissionId, questionId),
      loadSubmissionQuestionProgress(questionId),
    ]);
  const hasSubmission = submissions.some(
    (submission) => submission.id === submissionId,
  );

  if (question == null || !hasSubmission) {
    notFound();
  }

  const rubricsWithAssessments = question.rubrics.map((rubric) =>
    attachAssessment(rubric, assessments),
  );

  return (
    <SubmissionAssessmentClient
      key={`${questionId}-${submissionId}`}
      questionId={questionId}
      questionLabel={question.label}
      rubrics={rubricsWithAssessments}
      submissions={submissions}
      progressBySubmissionId={progressBySubmissionId}
      currentSubmissionId={submissionId}
    />
  );
}

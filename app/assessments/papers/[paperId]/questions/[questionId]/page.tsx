import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { attachAssessment } from "@/assessment/assessment";
import PaperAssessmentClient from "@/assessment/PaperAssessmentClient";
import { loadAssessment } from "@/db/assessments";
import { loadPapers } from "@/db/papers";
import { loadQuestion } from "@/db/questions";
import CodeSnippet from "@/shared/CodeSnippet";
import MuiNextLink from "@/shared/MuiNextLink";

type PageParams = {
  paperId: string;
  questionId: string;
};

type QuestionPaperPageProps = {
  params: Promise<PageParams>;
};

export default function QuestionPaperPage({ params }: QuestionPaperPageProps) {
  return <QuestionPaperPageContent params={params} />;
}

async function QuestionPaperPageContent({ params }: QuestionPaperPageProps) {
  const { paperId, questionId } = await params;

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <QuestionHeaderSection questionId={questionId} />
      <PaperRubricSection questionId={questionId} paperId={paperId} />
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

async function PaperRubricSection({
  questionId,
  paperId,
}: {
  questionId: string;
  paperId: string;
}) {
  const [question, papers, assessments] = await Promise.all([
    loadQuestion(questionId),
    loadPapers(),
    loadAssessment(paperId, questionId),
  ]);
  const hasPaper = papers.some((paper) => paper.id === paperId);

  if (question == null || !hasPaper) {
    notFound();
  }

  const rubricsWithAssessments = question.rubrics.map((rubric) =>
    attachAssessment(rubric, assessments),
  );

  return (
    <PaperAssessmentClient
      key={`${questionId}-${paperId}`}
      questionId={questionId}
      questionLabel={question.label}
      rubrics={rubricsWithAssessments}
      papers={papers}
      currentPaperId={paperId}
    />
  );
}

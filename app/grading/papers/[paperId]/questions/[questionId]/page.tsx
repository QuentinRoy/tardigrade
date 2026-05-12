import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { attachGrading } from "../../../../../../src/grading/grading";
import { loadAssessment } from "../../../../../../src/grading/loadAssessment";
import PaperGradingClient from "../../../../../../src/grading/PaperGradingClient";
import loadPapers from "../../../../../../src/papers/loadPapers";
import { loadQuestion } from "../../../../../../src/questions/loadQuestions";
import CodeSnippet from "../../../../../../src/shared/CodeSnippet";
import MuiNextLink from "../../../../../../src/shared/MuiNextLink";

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
          <MuiNextLink color="inherit" href="/grading">
            Grading
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
  const [question, papers, gradings] = await Promise.all([
    loadQuestion(questionId),
    loadPapers(),
    loadAssessment(paperId, questionId),
  ]);
  const hasPaper = papers.some((paper) => paper.id === paperId);

  if (question == null || !hasPaper) {
    notFound();
  }

  const rubricsWithGradings = question.rubrics.map((rubric) =>
    attachGrading(rubric, gradings.get(rubric.id)),
  );

  return (
    <PaperGradingClient
      key={`${questionId}-${paperId}`}
      questionId={questionId}
      questionLabel={question.label}
      rubrics={rubricsWithGradings}
      papers={papers}
      currentPaperId={paperId}
    />
  );
}


import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { attachAssessment } from "@/assessment/assessment";
import { loadAssessment } from "@/db/assessments";
import { loadPapers } from "@/db/papers";
import { loadQuestions } from "@/db/questions";
import MuiNextLink from "@/shared/MuiNextLink";
import PaperOverviewAssessmentClient from "../../../../src/assessment/PaperOverviewAssessmentClient";

type PageParams = {
  paperId: string;
};

type PaperPageProps = {
  params: Promise<PageParams>;
};

export default function PaperPage({ params }: PaperPageProps) {
  return <PaperPageContent params={params} />;
}

async function PaperPageContent({ params }: PaperPageProps) {
  const { paperId } = await params;

  const [papers, questionGrid] = await Promise.all([
    loadPapers(),
    loadQuestions(),
  ]);
  const currentPaper = papers.find((paper) => paper.id === paperId);

  if (currentPaper == null) {
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
    questions.map((question) => loadAssessment(paperId, question.questionId)),
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
          <Typography color="textPrimary">{currentPaper.label}</Typography>
        </Breadcrumbs>
        <Typography component="h1" variant="h4" gutterBottom sx={{ mt: 1 }}>
          {currentPaper.label}
        </Typography>
      </Box>

      <PaperOverviewAssessmentClient
        currentPaperId={paperId}
        papers={papers}
        questions={gradedQuestions}
      />
    </Container>
  );
}

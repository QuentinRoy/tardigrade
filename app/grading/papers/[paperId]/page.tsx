import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import MuiSkeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { attachGrading } from "@/grading/grading";
import { loadAssessment } from "@/grading/loadAssessment";
import PaperOverviewGradingClient from "@/grading/PaperOverviewGradingClient";
import loadPapers from "@/papers/loadPapers";
import loadQuestions from "@/questions/loadQuestions";
import MuiNextLink from "@/shared/MuiNextLink";

type PageParams = {
  paperId: string;
};

type PaperPageProps = {
  params: Promise<PageParams>;
};

export default function PaperPage({ params }: PaperPageProps) {
  return (
    <Suspense fallback={<PageFallback />}>
      <PaperPageContent params={params} />
    </Suspense>
  );
}

async function PaperPageContent({ params }: PaperPageProps) {
  const { paperId } = await params;

  const [papers, questionGrid] = await Promise.all([loadPapers(), loadQuestions()]);
  const currentPaper = papers.find((paper) => paper.id === paperId);

  if (currentPaper == null) {
    notFound();
  }

  const questions = Object.entries(questionGrid).map(([questionId, question]) => ({
    questionId,
    questionLabel: question.label ?? questionId,
    rubrics: question.rubrics,
  }));

  const assessments = await Promise.all(
    questions.map((question) => loadAssessment(paperId, question.questionId)),
  );

  const gradedQuestions = questions.map((question, index) => ({
    questionId: question.questionId,
    questionLabel: question.questionLabel,
    rubrics: question.rubrics.map((rubric) =>
      attachGrading(rubric, assessments[index].get(rubric.id)),
    ),
  }));

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box component="header" sx={{ pb: 2 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <MuiNextLink color="inherit" href="/grading">
            Grading
          </MuiNextLink>
          <Typography color="textPrimary">{currentPaper.label}</Typography>
        </Breadcrumbs>
        <Typography component="h1" variant="h4" gutterBottom sx={{ mt: 1 }}>
          {currentPaper.label}
        </Typography>
      </Box>

      <PaperOverviewGradingClient
        currentPaperId={paperId}
        papers={papers}
        questions={gradedQuestions}
      />
    </Container>
  );
}

function PageFallback() {
  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box component="header" sx={{ pb: 2 }}>
        <MuiSkeleton width={180} height={24} sx={{ mb: 1 }} />
        <MuiSkeleton width="35%" height={54} sx={{ mb: 1 }} />
        <MuiSkeleton width="45%" height={24} />
      </Box>

      <Box
        sx={{
          mb: 3,
          p: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <MuiSkeleton width={100} height={18} />
        <MuiSkeleton width={180} height={38} />
        <MuiSkeleton width={120} height={18} />
      </Box>

      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          sx={{
            mb: 3,
            p: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <MuiSkeleton width="40%" height={36} sx={{ mb: 1 }} />
          <MuiSkeleton width={140} height={20} sx={{ mb: 2 }} />
          <MuiSkeleton width="100%" height={40} sx={{ mb: 1 }} />
          <MuiSkeleton width="100%" height={40} sx={{ mb: 1 }} />
          <MuiSkeleton width="100%" height={40} />
        </Box>
      ))}
    </Container>
  );
}
import { Button, Container, Typography } from "@mui/material";
import { Suspense } from "react";
import GlobalAssessmentSummary from "@/assessment/GlobalAssessmentSummary";
import { loadGlobalAssessmentProgress } from "@/db/assessmentsProgress";

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}

async function HomePageContent() {
  const progress = await loadGlobalAssessmentProgress();

  return (
    <Container component="main" maxWidth="md" sx={{ py: 5 }}>
      <Typography component="h1" variant="h2">
        Assessments
      </Typography>
      <Button href="/import" sx={{ my: 2 }} variant="outlined">
        Import rubric and student data
      </Button>
      <Button href="/assessments" sx={{ my: 2, ml: 1 }} variant="contained">
        Open assessments
      </Button>
      <GlobalAssessmentSummary progress={progress} />
    </Container>
  );
}

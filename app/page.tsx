import { Button, Container, Stack, Typography } from "@mui/material";
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
      <Stack sx={{ gap: 3 }}>
        <Typography component="h1" variant="h2">
          Dashboard
        </Typography>
        <GlobalAssessmentSummary progress={progress} />
        <div>
          <Button href="/assessments" variant="contained">
            Open assessments
          </Button>
        </div>
      </Stack>
    </Container>
  );
}

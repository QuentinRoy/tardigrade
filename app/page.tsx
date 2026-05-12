import { Box, Button, Container, Typography } from "@mui/material";
import { Suspense } from "react";
import GlobalAssessmentSummary from "@/assessment/GlobalAssessmentSummary";
import { loadGlobalAssessmentProgress } from "@/db/assessmentsProgress";
import ExportCsvMenu from "@/export/ExportCsvMenu";

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
      <Typography component="h1" variant="h2" sx={{ mb: 2 }}>
        Assessments
      </Typography>
      <Box sx={{ mb: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button href="/import" variant="outlined">
          Import rubric and student data
        </Button>
        <Button href="/assessments" variant="contained">
          Open assessments
        </Button>
        <ExportCsvMenu />
      </Box>
      <GlobalAssessmentSummary progress={progress} />
    </Container>
  );
}

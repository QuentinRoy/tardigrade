import { Button, Container, Typography } from "@mui/material";
import { Suspense } from "react";
import GlobalGradingSummary from "@/grading/GlobalGradingSummary";
import loadGlobalProgress from "@/grading/loadGlobalProgress";

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}

async function HomePageContent() {
  const progress = await loadGlobalProgress();

  return (
    <Container component="main" maxWidth="md" sx={{ py: 5 }}>
      <Typography component="h1" variant="h2">
        Grading
      </Typography>
      <Button href="/import" sx={{ my: 2 }} variant="outlined">
        Import rubric and student data
      </Button>
      <Button href="/grading" sx={{ my: 2, ml: 1 }} variant="contained">
        Open grading
      </Button>
      <GlobalGradingSummary progress={progress} />
    </Container>
  );
}

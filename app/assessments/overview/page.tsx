import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import RubricOverviewPage from "@/assessment/RubricOverviewPage";
import { loadRubricOverviewData } from "@/db/rubricOverview";
import MuiNextLink from "@/shared/MuiNextLink";

export default function AssessmentsOverviewPage(): ReactElement {
  return <AssessmentsOverviewPageContent />;
}

async function AssessmentsOverviewPageContent(): Promise<ReactElement> {
  const data = await loadRubricOverviewData();

  return (
    <Container component="main" maxWidth="lg" sx={{ py: 5 }}>
      <Box component="header" sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
          <MuiNextLink color="inherit" href="/assessments">
            Assessments
          </MuiNextLink>
          <Typography color="text.primary">Overview</Typography>
        </Breadcrumbs>
        <Typography component="h1" variant="h4">
          Rubric overview
        </Typography>
        <Typography color="text.secondary">
          Track rubric performance and completion without changing authored
          rubric order.
        </Typography>
      </Box>

      <RubricOverviewPage data={data} />
    </Container>
  );
}

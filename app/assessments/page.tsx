import {
  Box,
  Button,
  Container,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { cacheTag } from "next/cache";
import { loadQuestions } from "@/db/questions";
import { loadSubmissionOverviewProgress } from "@/db/submissionProgress";
import { loadSubmissions } from "@/db/submissions";
import { getSubmissionLabel } from "@/submissions/getSubmissionLabel";
import QuestionList from "../../src/questions/QuestionList";

export default function AssessmentPage() {
  return <AssessmentPageContent />;
}

async function AssessmentPageContent() {
  "use cache";
  cacheTag("assessments");

  const [grid, submissions, progressBySubmissionId] = await Promise.all([
    loadQuestions(),
    loadSubmissions(),
    loadSubmissionOverviewProgress(),
  ]);
  const firstSubmissionId = submissions[0]?.id;
  const questions = firstSubmissionId
    ? Object.entries(grid).map(([id, { label }]) => ({
        id,
        label: label == null ? id : label,
        href: `/assessments/submissions/${firstSubmissionId}/questions/${id}`,
      }))
    : [];

  return (
    <Container component="main" maxWidth="md" sx={{ py: 5 }}>
      <Typography component="h1" variant="h3" sx={{ mb: 3 }}>
        Assessments
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Button href="/assessments/overview" variant="outlined">
          Open rubric overview
        </Button>
      </Box>
      <Typography component="h2" variant="h5" sx={{ mb: 2 }}>
        Assess by submission
      </Typography>
      <List component="nav" aria-label="Submission list" sx={{ mb: 3 }}>
        {submissions.map((submission) => {
          const progress = progressBySubmissionId[submission.id];
          const completed = progress?.completed ?? 0;
          const total = progress?.total ?? 0;
          const percent = total > 0 ? (completed / total) * 100 : 0;
          return (
            <ListItemButton
              key={submission.id}
              href={`/assessments/submissions/${submission.id}`}
              sx={{ mb: 1, display: "flex", alignItems: "center" }}
            >
              <ListItemText primary={getSubmissionLabel(submission)} />
              <Box
                sx={{
                  ml: 2,
                  minWidth: 60,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  color={
                    completed === total && total > 0
                      ? "success.main"
                      : "text.secondary"
                  }
                  sx={{ fontWeight: 500 }}
                >
                  {completed} / {total}
                </Typography>
                <Box sx={{ width: 44 }}>
                  <LinearProgress
                    variant="determinate"
                    value={percent}
                    sx={{ height: 4, borderRadius: 2 }}
                    color={
                      completed === total && total > 0 ? "success" : "secondary"
                    }
                  />
                </Box>
              </Box>
            </ListItemButton>
          );
        })}
      </List>
      <Typography component="h2" variant="h5">
        Assess by question
      </Typography>
      {firstSubmissionId ? (
        <QuestionList questions={questions} />
      ) : (
        <Typography color="text.secondary">
          Add a submission first to start assessments by question.
        </Typography>
      )}
    </Container>
  );
}

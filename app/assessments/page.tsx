import {
  Button,
  Container,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { loadQuestions } from "@/db/questions";
import { loadSubmissions } from "@/db/submissions";
import { getSubmissionLabel } from "@/submissions/getSubmissionLabel";
import QuestionList from "../../src/questions/QuestionList";

export default function AssessmentPage() {
  return <AssessmentPageContent />;
}

async function AssessmentPageContent() {
  const [grid, submissions] = await Promise.all([
    loadQuestions(),
    loadSubmissions(),
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
      <Typography component="h1" variant="h3">
        Assessments
      </Typography>
      <Button href="/" sx={{ my: 2 }} variant="text">
        Back to overview
      </Button>
      <Typography component="h2" variant="h5" sx={{ mt: 2 }}>
        Assess by submission
      </Typography>
      <List component="nav" aria-label="Submission list" sx={{ mb: 3 }}>
        {submissions.map((submission) => (
          <ListItemButton
            key={submission.id}
            href={`/assessments/submissions/${submission.id}`}
          >
            <ListItemText
              primary={getSubmissionLabel(submission)}
              secondary={submission.id}
            />
          </ListItemButton>
        ))}
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

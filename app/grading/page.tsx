import {
  Button,
  Container,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import loadPapers from "../../src/papers/loadPapers";
import loadQuestions from "../../src/questions/loadQuestions";
import QuestionList from "../../src/questions/QuestionList";

export default function GradingPage() {
  return <GradingPageContent />;
}

async function GradingPageContent() {
  const [grid, papers] = await Promise.all([loadQuestions(), loadPapers()]);
  const firstPaperId = papers[0]?.id;
  const questions = firstPaperId
    ? Object.entries(grid).map(([id, { label }]) => ({
        id,
        label: label == null ? id : label,
        href: `/grading/papers/${firstPaperId}/questions/${id}`,
      }))
    : [];

  return (
    <Container component="main" maxWidth="md" sx={{ py: 5 }}>
      <Typography component="h1" variant="h3">
        Grading
      </Typography>
      <Button href="/" sx={{ my: 2 }} variant="text">
        Back to overview
      </Button>
      <Typography component="h2" variant="h5" sx={{ mt: 2 }}>
        Grade by paper
      </Typography>
      <List component="nav" aria-label="Paper list" sx={{ mb: 3 }}>
        {papers.map((paper) => (
          <ListItemButton key={paper.id} href={`/grading/papers/${paper.id}`}>
            <ListItemText primary={paper.label} secondary={paper.id} />
          </ListItemButton>
        ))}
      </List>
      <Typography component="h2" variant="h5">
        Grade by question
      </Typography>
      {firstPaperId ? (
        <QuestionList questions={questions} />
      ) : (
        <Typography color="text.secondary">
          Add a paper first to start grading by question.
        </Typography>
      )}
    </Container>
  );
}

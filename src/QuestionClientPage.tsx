"use client";

import CheckIcon from "@mui/icons-material/Check";
import CrossIcon from "@mui/icons-material/Clear";
import MuiAlert, { type AlertProps } from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Snackbar from "@mui/material/Snackbar";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { produce } from "immer";
import dynamic from "next/dynamic";
import NextLink from "next/link";
import React from "react";
import type { Paper } from "./loadPapers";
import type { Question, Rubric as QuestionRubric } from "./loadQuestions";

const CodeSnippet = dynamic(() => import("./CodeSnippet"), {
  ssr: false,
});

type Grading = "passed" | "failed";

type State = {
  rubrics: (QuestionRubric & { grading?: Grading })[];
  clipboardFeedback: {
    isShown: boolean;
    wasSuccessful: boolean;
    value?: number;
  };
};

type Action =
  | { type: "grade"; grading: Grading; itemNumber: number }
  | { type: "clipboard success"; value: number }
  | { type: "clipboard failed" }
  | { type: "hide clipboard" };

function reducer(state: State, action: Action) {
  return produce(state, (draftState) => {
    switch (action.type) {
      case "grade":
        if (action.itemNumber >= draftState.rubrics.length) {
          throw new Error(`Invalid item number: ${action.itemNumber}`);
        }
        draftState.rubrics[action.itemNumber].grading = action.grading;
        break;
      case "clipboard success":
        draftState.clipboardFeedback.isShown = true;
        draftState.clipboardFeedback.value = action.value;
        draftState.clipboardFeedback.wasSuccessful = true;
        break;
      case "clipboard failed":
        draftState.clipboardFeedback.isShown = true;
        draftState.clipboardFeedback.wasSuccessful = false;
        break;
      case "hide clipboard":
        draftState.clipboardFeedback.isShown = false;
        break;
    }
  });
}

type QuestionClientPageProps = {
  questionId: string;
  question: Question;
  papers: Paper[];
  currentPaperId: string;
};

export default function QuestionClientPage({
  questionId,
  question,
  papers,
  currentPaperId,
}: QuestionClientPageProps): React.ReactElement {
  const resultRef = React.useRef<HTMLSpanElement>(null);
  const [{ rubrics, clipboardFeedback }, dispatch] = React.useReducer(reducer, {
    rubrics: question.rubrics,
    clipboardFeedback: { isShown: false, wasSuccessful: true },
  });

  const currentPaperIndex = papers.findIndex(
    (paper) => paper.id === currentPaperId,
  );
  const currentPaper =
    currentPaperIndex === -1 ? undefined : papers[currentPaperIndex];
  const previousPaper =
    currentPaperIndex > 0 ? papers[currentPaperIndex - 1] : undefined;
  const nextPaper =
    currentPaperIndex >= 0 && currentPaperIndex < papers.length - 1
      ? papers[currentPaperIndex + 1]
      : undefined;

  let marks = 0;
  let maxMarks = 0;
  let totalRubricsLeft = 0;
  let isCompleted = true;

  rubrics.forEach(({ grading, marks: rubricMarks }) => {
    if (grading === "passed") {
      marks += rubricMarks;
    }

    if (grading != null) {
      maxMarks += rubricMarks;
    } else {
      totalRubricsLeft += 1;
      isCompleted = false;
    }
  });

  async function copyMark() {
    try {
      await navigator.clipboard.writeText(String(marks));
      dispatch({ type: "clipboard success", value: marks });
    } catch {
      dispatch({ type: "clipboard failed" });
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box component="header" sx={{ pb: 2 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={NextLink} color="inherit" href="/">
            Grading Grid
          </Link>
          <Typography color="textPrimary">
            {question.label ?? questionId}
          </Typography>
        </Breadcrumbs>
      </Box>

      <Box component="main">
        <Typography variant="h4" component="h1" gutterBottom>
          {question.label ?? questionId}
        </Typography>

        {currentPaper == null ? (
          <Typography variant="body1" sx={{ my: 3 }}>
            No papers found in data/students.csv.
          </Typography>
        ) : (
          <>
            <Box
              sx={{
                my: 2,
                p: 2,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Current paper
              </Typography>
              <Typography variant="h6">{currentPaper.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                {currentPaper.id}
              </Typography>
            </Box>

            <Box sx={{ my: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                component={NextLink}
                href={`/${questionId}/${previousPaper?.id ?? currentPaperId}`}
                variant="outlined"
                disabled={previousPaper == null}
              >
                Previous paper
              </Button>
              <Button
                component={NextLink}
                href={`/${questionId}/${nextPaper?.id ?? currentPaperId}`}
                variant="outlined"
                disabled={nextPaper == null}
              >
                Next paper
              </Button>
              <Typography variant="body2" sx={{ alignSelf: "center", ml: 1 }}>
                {currentPaperIndex + 1} / {papers.length}
              </Typography>
            </Box>
          </>
        )}

        {question.solution && (
          <Box sx={{ mb: 2 }}>
            <CodeSnippet>{question.solution}</CodeSnippet>
          </Box>
        )}

        <Grid container spacing={2} sx={{ my: 4, alignItems: "center" }}>
          {rubrics.map(({ label, marks: rubricMarks, grading }, index) => {
            return (
              <React.Fragment key={index}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <ToggleButtonGroup
                    value={grading ?? null}
                    exclusive
                    onChange={(_, value: Grading | null) => {
                      if (value != null) {
                        dispatch({
                          type: "grade",
                          itemNumber: index,
                          grading: value,
                        });
                      }
                    }}
                    aria-label={`Rubric ${index + 1} grading`}
                    disabled={currentPaper == null}
                  >
                    <ToggleButton
                      size="small"
                      value="passed"
                      aria-label="passed"
                    >
                      <CheckIcon
                        color={grading === "passed" ? "primary" : "inherit"}
                      />
                    </ToggleButton>
                    <ToggleButton
                      size="small"
                      value="failed"
                      aria-label="failed"
                    >
                      <CrossIcon
                        color={grading === "failed" ? "error" : "inherit"}
                      />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }}>{label}</Grid>
                <Grid size={{ xs: 12, sm: 1 }}>
                  <Typography variant="body2">({rubricMarks})</Typography>
                </Grid>
              </React.Fragment>
            );
          })}
        </Grid>

        <Box sx={{ my: 2 }}>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="subtitle1">
              <span ref={resultRef}>{marks}</span>&nbsp;/&nbsp;{maxMarks}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption">
              {isCompleted
                ? "(completed)"
                : `(${totalRubricsLeft} rubric${totalRubricsLeft !== 1 ? "s" : ""} left)`}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ my: 2 }}>
          <Button
            variant="contained"
            disabled={!isCompleted}
            onClick={copyMark}
          >
            Copy Mark
          </Button>
        </Box>
      </Box>

      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        open={clipboardFeedback.isShown}
        autoHideDuration={3000}
        onClose={() => {
          dispatch({ type: "hide clipboard" });
        }}
      >
        {clipboardFeedback.wasSuccessful ? (
          <Alert severity="success">
            {clipboardFeedback.value} copied to clipboard.
          </Alert>
        ) : (
          <Alert severity="error">Could not update clipboard.</Alert>
        )}
      </Snackbar>
    </Container>
  );
}

function Alert(props: AlertProps): React.ReactElement {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

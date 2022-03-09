import CheckIcon from "@mui/icons-material/Check";
import CrossIcon from "@mui/icons-material/Clear";
import MuiAlert, { AlertProps } from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Snackbar from "@mui/material/Snackbar";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import makeStyles from "@mui/styles/makeStyles";
import produce from "immer";
import { GetStaticPaths, GetStaticProps } from "next";
import React, { useRef } from "react";

import CodeSnippet from "../src/CodeSnippet";
import Link from "../src/Link";
import type {
  Question as QuestionProps,
  Rubric as QuestionRubric,
} from "../src/loadQuestions";
import loadQuestions from "../src/loadQuestions";

const useStyles = makeStyles((theme) => ({
  root: { padding: theme.spacing(5, 0) },
  header: { padding: theme.spacing(0, 0, 2, 0) },
  grid: { margin: theme.spacing(4, 0) },
  summary: { margin: theme.spacing(2, 0) },
  controls: { margin: theme.spacing(2, 0) },
  button: { margin: theme.spacing(0, 2) },
}));

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
  | { type: "clear" }
  | { type: "clipboard success"; value: number }
  | { type: "clipboard failed" }
  | { type: "hide clipboard" };

function reducer(state: State, action: Action) {
  return produce(state, (draftState) => {
    switch (action.type) {
      case "grade":
        if (action.itemNumber >= draftState.rubrics.length) {
          throw new Error(`Invalid item numer: ${action.itemNumber}`);
        }
        draftState.rubrics[action.itemNumber].grading = action.grading;
        break;
      case "clear":
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        draftState.rubrics = draftState.rubrics.map(({ grading, ...i }) => i);
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

export default function Question({
  label,
  rubrics: initRubrics,
  solution,
}: QuestionProps): React.ReactElement {
  const classes = useStyles();
  const resultRef = useRef<HTMLSpanElement>();
  const [{ rubrics, clipboardFeedback }, dispatch] = React.useReducer(reducer, {
    rubrics: initRubrics,
    clipboardFeedback: { isShown: false, wasSuccessful: true },
  });

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

  function copyMark() {
    try {
      let selection = window.getSelection();
      let range = document.createRange();
      range.selectNodeContents(resultRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("copy");
      selection.removeAllRanges();
      dispatch({ type: "clipboard success", value: marks });
    } catch (err) {
      dispatch({ type: "clipboard failed" });
    }
  }

  return (
    <Container maxWidth="md" className={classes.root}>
      <Box component="header" className={classes.header}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link color="inherit" href="/">
            Grading Grid
          </Link>
          <Typography color="textPrimary">{label}</Typography>
        </Breadcrumbs>
      </Box>
      <Box component="main">
        <Typography variant="h4" component="h1" gutterBottom>
          {label}
        </Typography>
        {solution && (
          <div>
            <CodeSnippet>{solution}</CodeSnippet>
          </div>
        )}
        <Grid
          container
          spacing={3}
          justifyContent="center"
          alignItems="center"
          className={classes.grid}
        >
          {rubrics.map(({ label, marks, grading }, i) => (
            <Rubric
              key={i}
              label={label}
              marks={marks}
              grading={grading}
              number={i}
              dispatch={dispatch}
            />
          ))}
        </Grid>

        <Box className={classes.summary}>
          <Box textAlign="center">
            <Typography variant="subtitle1">
              <span ref={resultRef}>{marks}</span>&nbsp;/&nbsp;{maxMarks}
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography variant="caption">
              {isCompleted
                ? "(completed)"
                : `(${totalRubricsLeft} rubric${
                    totalRubricsLeft !== 1 ? "s" : ""
                  } left)`}
            </Typography>
          </Box>
        </Box>
        <Box className={classes.controls}>
          <Button
            className={classes.button}
            variant="contained"
            disabled={!isCompleted}
            onClick={copyMark}
          >
            Copy Mark
          </Button>
          <Button
            disabled={totalRubricsLeft === rubrics.length}
            variant="contained"
            onClick={() => dispatch({ type: "clear" })}
          >
            Clear
          </Button>
        </Box>
      </Box>
      <Snackbar
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        open={clipboardFeedback.isShown}
        autoHideDuration={6000}
        onClose={() => {
          dispatch({ type: "hide clipboard" });
        }}
      >
        {clipboardFeedback.wasSuccessful ? (
          <Alert severity="success">
            {clipboardFeedback.value} copied in clipboard!
          </Alert>
        ) : (
          <Alert severity="error">Could not update clipboard.</Alert>
        )}
      </Snackbar>
    </Container>
  );
}

type GridItemProps = {
  label: string;
  marks: number;
  grading: Grading;
  number: number;
  dispatch: (action: Action) => void;
};
function Rubric({ label, marks, grading, number, dispatch }: GridItemProps) {
  return (
    <React.Fragment>
      <Grid item xs={2}>
        <ToggleButtonGroup
          value={grading}
          exclusive
          onChange={(evt, value) => {
            dispatch({ type: "grade", itemNumber: number, grading: value });
          }}
          aria-label="text alignment"
        >
          <ToggleButton size="small" value="passed" aria-label="passed">
            <CheckIcon color={grading === "passed" ? "primary" : undefined} />
          </ToggleButton>
          <ToggleButton size="small" value="failed" aria-label="failed">
            <CrossIcon color={grading === "failed" ? "error" : undefined} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Grid>
      <Grid item xs={9}>
        {label}
      </Grid>
      <Grid item xs={1}>
        <Typography variant="body2">({marks})</Typography>
      </Grid>
    </React.Fragment>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const grid = await loadQuestions();
  let paths = Object.keys(grid).map((questionId) => ({
    params: { questionId },
  }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  let grid = await loadQuestions();
  let question: QuestionProps = grid[params.questionId as string];
  return { props: question };
};

function Alert(props: AlertProps): React.ReactElement {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

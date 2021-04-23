import Box from "@material-ui/core/Box";
import Breadcrumbs from "@material-ui/core/Breadcrumbs";
import Button from "@material-ui/core/Button";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import Snackbar from "@material-ui/core/Snackbar";
import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import CheckIcon from "@material-ui/icons/Check";
import CrossIcon from "@material-ui/icons/Clear";
import MuiAlert, { AlertProps } from "@material-ui/lab/Alert";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import produce from "immer";
import { GetStaticPaths, GetStaticProps } from "next";
import React, { useRef } from "react";

import Link from "../../src/Link";
import type {
  GridItem as QuestionGridItem,
  Question as QuestionProps,
} from "../../src/loadQuestions";
import loadQuestions from "../../src/loadQuestions";

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
  items: (QuestionGridItem & { grading?: Grading })[];
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
        if (action.itemNumber >= draftState.items.length) {
          throw new Error(`Invalid item numer: ${action.itemNumber}`);
        }
        draftState.items[action.itemNumber].grading = action.grading;
        break;
      case "clear":
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        draftState.items = draftState.items.map(({ grading, ...i }) => i);
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
  grid,
}: QuestionProps): React.ReactElement {
  const classes = useStyles();
  const resultRef = useRef<HTMLSpanElement>();
  const [{ items, clipboardFeedback }, dispatch] = React.useReducer(reducer, {
    items: grid,
    clipboardFeedback: { isShown: false, wasSuccessful: true },
  });

  let marks = 0;
  let maxMarks = 0;
  let totalQuestionLeft = 0;
  let isCompleted = true;
  items.forEach(({ grading, mark }) => {
    if (grading === "passed") {
      marks += mark;
    }
    if (grading != null) {
      maxMarks += mark;
    } else {
      totalQuestionLeft += 1;
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
    <Container maxWidth="sm" className={classes.root}>
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
        <Grid
          container
          spacing={3}
          justify="center"
          alignItems="center"
          className={classes.grid}
        >
          {items.map(({ label, mark, grading }, i) => (
            <GridItem
              key={i}
              label={label}
              mark={mark}
              grading={grading}
              number={i}
              dispatch={dispatch}
            />
          ))}
        </Grid>

        <Box className={classes.summary}>
          <Box textAlign="center">
            <Typography variant="subtitle2">
              <span ref={resultRef}>{marks}</span>&nbsp;/&nbsp;{maxMarks}
            </Typography>
          </Box>
          <Box textAlign="center">
            {isCompleted
              ? "(completed)"
              : `(${totalQuestionLeft} questions left)`}
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
            disabled={totalQuestionLeft === items.length}
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
  mark: number;
  grading: Grading;
  number: number;
  dispatch: (action: Action) => void;
};
function GridItem({ label, mark, grading, number, dispatch }: GridItemProps) {
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
            <CheckIcon />
          </ToggleButton>
          <ToggleButton size="small" value="failed" aria-label="failed">
            <CrossIcon />
          </ToggleButton>
        </ToggleButtonGroup>
      </Grid>
      <Grid item xs={9}>
        {label}
      </Grid>
      <Grid item xs={1}>
        <Typography variant="body2">({mark})</Typography>
      </Grid>
    </React.Fragment>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const grid = await loadQuestions();
  let paths = Object.keys(grid).map((id) => ({ params: { id } }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  let grid = await loadQuestions();
  let question: QuestionProps = grid[params.id as string];
  return { props: question };
};

function Alert(props: AlertProps): React.ReactElement {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

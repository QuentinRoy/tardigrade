"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { type ReactElement } from "react";
import type { AssessedRubric } from "../assessment/assessment";
import type { AssessmentRubricValue } from "../db/types";
import BooleanGradeControl from "./BooleanGradeControl";
import NumericalGradeControl from "./NumericalGradeControl";
import OrdinalGradeControl from "./OrdinalGradeControl";
import { getRubricMaxMarks as computeMarks } from "./rubric";

type RubricGradeRowProps = {
  rubric: AssessedRubric;
  isPending: boolean;
  disabled: boolean;
  onGrade: (assessment: AssessmentRubricValue) => void;
};

export default function RubricGradeRow({
  rubric,
  isPending,
  disabled,
  onGrade,
}: RubricGradeRowProps): ReactElement {
  const { description, assessment, id, label, type } = rubric;
  const displayDescription = description ?? label ?? id;
  const rubricMarks = computeMarks(rubric);

  let control: ReactElement;

  if (type === "ordinal") {
    control = (
      <OrdinalGradeControl
        value={assessment?.selectedLabel}
        marks={rubric.marks}
        disabled={disabled}
        onGrade={(selectedLabel) =>
          onGrade({
            rubricId: id,
            type: "ordinal",
            selectedLabel,
          })
        }
      />
    );
  } else if (type === "numerical") {
    control = (
      <NumericalGradeControl
        value={assessment?.score}
        minScore={rubric.minScore}
        maxScore={rubric.maxScore}
        disabled={disabled}
        onGrade={(score) =>
          onGrade({
            rubricId: id,
            type: "numerical",
            score,
          })
        }
      />
    );
  } else {
    control = (
      <BooleanGradeControl
        value={assessment?.passed}
        disabled={disabled}
        onGrade={(passed) =>
          onGrade({
            rubricId: id,
            type: "boolean",
            passed,
          })
        }
      />
    );
  }

  return (
    <>
      <Grid size={{ xs: 12, sm: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {control}
          <Box
            sx={{
              width: 16,
              height: 16,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isPending ? <CircularProgress size={12} thickness={6} /> : null}
          </Box>
        </Box>
      </Grid>
      <Grid size={{ xs: 12, sm: 8 }}>{displayDescription}</Grid>
      <Grid size={{ xs: 12, sm: 1 }}>
        <Typography variant="body2">({rubricMarks})</Typography>
      </Grid>
    </>
  );
}

"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { type ReactElement } from "react";
import type { GradedRubric } from "../grading/grading";
import BooleanGradeControl from "./BooleanGradeControl";
import NumericalGradeControl from "./NumericalGradeControl";
import OrdinalGradeControl from "./OrdinalGradeControl";
import { getRubricMaxMarks as computeMarks } from "./rubric";

type RubricGradeRowProps = {
  rubric: GradedRubric;
  isPending: boolean;
  disabled: boolean;
  onGrade: (grading: boolean | number | string) => void;
};

export default function RubricGradeRow({
  rubric,
  isPending,
  disabled,
  onGrade,
}: RubricGradeRowProps): ReactElement {
  const { description, grading, id, label, type } = rubric;
  const displayDescription = description ?? label ?? id;
  const rubricMarks = computeMarks(rubric);

  let control: ReactElement;

  if (type === "ordinal") {
    control = (
      <OrdinalGradeControl
        grading={grading}
        marks={rubric.marks}
        disabled={disabled}
        onGrade={onGrade}
      />
    );
  } else if (type === "numerical") {
    control = (
      <NumericalGradeControl
        grading={grading}
        minScore={rubric.minScore}
        maxScore={rubric.maxScore}
        disabled={disabled}
        onGrade={onGrade}
      />
    );
  } else {
    control = (
      <BooleanGradeControl
        grading={grading}
        disabled={disabled}
        onGrade={onGrade}
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

"use client";

import CheckIcon from "@mui/icons-material/Check";
import CrossIcon from "@mui/icons-material/Clear";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { Fragment, type ReactElement } from "react";
import type { Rubric as QuestionRubric } from "./loadQuestions";

type Grading = "passed" | "failed";

type RubricItem = QuestionRubric & { grading?: Grading };

type RubricGradingSectionProps = {
  rubrics: RubricItem[];
  pendingByIndex: Record<number, number>;
  disabled: boolean;
  onGrade: (index: number, grading: Grading) => void;
};

export default function RubricGradingSection({
  rubrics,
  pendingByIndex,
  disabled,
  onGrade,
}: RubricGradingSectionProps): ReactElement {
  return (
    <Grid container spacing={2} sx={{ mb: 4, alignItems: "center" }}>
      {rubrics.map(({ label, marks: rubricMarks, grading }, index) => {
        const isPending = (pendingByIndex[index] ?? 0) > 0;
        return (
          <Fragment key={index}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ToggleButtonGroup
                  value={grading ?? null}
                  exclusive
                  onChange={(_, value: Grading | null) => {
                    if (value != null) {
                      onGrade(index, value);
                    }
                  }}
                  aria-label={`Rubric ${index + 1} grading`}
                  disabled={disabled}
                >
                  <ToggleButton
                    size="small"
                    value="passed"
                    aria-label="passed"
                    color="primary"
                  >
                    <CheckIcon
                      color={grading === "passed" ? "primary" : "inherit"}
                    />
                  </ToggleButton>
                  <ToggleButton
                    size="small"
                    value="failed"
                    color="error"
                    aria-label="failed"
                  >
                    <CrossIcon
                      color={grading === "failed" ? "error" : "inherit"}
                    />
                  </ToggleButton>
                </ToggleButtonGroup>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isPending ? (
                    <CircularProgress size={12} thickness={6} />
                  ) : null}
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>{label}</Grid>
            <Grid size={{ xs: 12, sm: 1 }}>
              <Typography variant="body2">({rubricMarks})</Typography>
            </Grid>
          </Fragment>
        );
      })}
    </Grid>
  );
}

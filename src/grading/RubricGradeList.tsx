"use client";

import Grid from "@mui/material/Grid";
import type { ReactElement } from "react";
import RubricGradeRow from "../rubrics/RubricGradeRow";
import type { GradedRubric, Grading } from "./grading";

type RubricGradingSectionProps = {
  rubrics: GradedRubric[];
  pendingByIndex: Record<number, number>;
  disabled: boolean;
  onGrade: (index: number, grading: Grading) => void;
};

export default function RubricGradeList({
  rubrics,
  pendingByIndex,
  disabled,
  onGrade,
}: RubricGradingSectionProps): ReactElement {
  const handleGrade = (index: number, value: Grading) => onGrade(index, value);

  return (
    <Grid container spacing={2} sx={{ mb: 2, alignItems: "center" }}>
      {rubrics.map((rubric, index) => {
        const isPending = (pendingByIndex[index] ?? 0) > 0;

        return (
          <RubricGradeRow
            key={rubric.id}
            rubric={rubric}
            isPending={isPending}
            disabled={disabled}
            onGrade={(value) => handleGrade(index, value)}
          />
        );
      })}
    </Grid>
  );
}

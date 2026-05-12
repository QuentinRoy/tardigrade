"use client";

import Grid from "@mui/material/Grid";
import type { ReactElement } from "react";
import type { AssessmentRubricValue } from "../db/types";
import RubricGradeRow from "../rubrics/RubricGradeRow";
import type { AssessedRubric } from "./assessment";

type RubricAssessmentSectionProps = {
  rubrics: AssessedRubric[];
  pendingByIndex: Record<number, number>;
  disabled: boolean;
  onGrade: (index: number, assessment: AssessmentRubricValue) => void;
};

export default function RubricGradeList({
  rubrics,
  pendingByIndex,
  disabled,
  onGrade,
}: RubricAssessmentSectionProps): ReactElement {
  const handleAssessment = (index: number, assessment: AssessmentRubricValue) =>
    onGrade(index, assessment);

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
            onGrade={(assessment) => handleAssessment(index, assessment)}
          />
        );
      })}
    </Grid>
  );
}

"use client";

import Grid from "@mui/material/Grid";
import type { ReactElement } from "react";
import type { AssessedRubric } from "@/rubrics/rubric";
import type { AssessmentRubricValue } from "../db/types";
import RubricGradeRow from "../rubrics/RubricGradeRow";

type RubricAssessmentSectionProps = {
  rubrics: AssessedRubric[];
  pendingByIndex: Record<number, number>;
  disabled: boolean;
  onAssess: (index: number, assessment: AssessmentRubricValue) => void;
};

export default function RubricGradeList({
  rubrics,
  pendingByIndex,
  disabled,
  onAssess,
}: RubricAssessmentSectionProps): ReactElement {
  const handleAssessment = (index: number, assessment: AssessmentRubricValue) =>
    onAssess(index, assessment);

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
            onAssess={(assessment) => handleAssessment(index, assessment)}
          />
        );
      })}
    </Grid>
  );
}

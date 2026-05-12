"use client";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { ReactElement } from "react";

type OrdinalGradeControlProps = {
  grading?: string;
  marks: Record<string, number>;
  disabled: boolean;
  onGrade: (grading: string) => void;
};

export default function OrdinalGradeControl({
  grading,
  marks,
  disabled,
  onGrade,
}: OrdinalGradeControlProps): ReactElement {
  return (
    <ToggleButtonGroup
      value={grading ?? null}
      orientation="vertical"
      exclusive
      onChange={(_, value: string | null) => {
        if (value != null) {
          onGrade(value);
        }
      }}
      aria-label="Ordinal rubric grading"
      disabled={disabled}
    >
      {Object.entries(marks).map(([valueLabel, valueScore]) => (
        <ToggleButton
          key={valueLabel}
          size="small"
          value={valueLabel}
          aria-label={valueLabel}
          color="primary"
        >
          {valueLabel} ({valueScore})
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

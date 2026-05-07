"use client";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { ReactElement } from "react";

type OrdinalRubricControlProps = {
  grading?: string;
  values: Record<string, number>;
  disabled: boolean;
  onGrade: (grading: string) => void;
};

export default function OrdinalRubricControl({
  grading,
  values,
  disabled,
  onGrade,
}: OrdinalRubricControlProps): ReactElement {
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
      {Object.entries(values).map(([valueLabel, valueScore]) => (
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

"use client";

import TextField from "@mui/material/TextField";
import { type ReactElement, useEffect, useState } from "react";

type NumericalGradeControlProps = {
  value?: number;
  minScore: number;
  maxScore: number;
  disabled: boolean;
  onGrade: (value: number) => void;
};

export default function NumericalGradeControl({
  value,
  minScore,
  maxScore,
  disabled,
  onGrade,
}: NumericalGradeControlProps): ReactElement {
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  useEffect(() => {
    setDraft(value != null ? String(value) : "");
  }, [value]);

  function submit() {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      return;
    }
    let parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed === value) {
      return;
    }
    if (parsed < minScore) parsed = minScore;
    else if (parsed > maxScore) parsed = maxScore;
    onGrade(parsed);
  }

  return (
    <TextField
      size="small"
      type="number"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={submit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      }}
      placeholder="Score"
      disabled={disabled}
      slotProps={{ htmlInput: { min: minScore, max: maxScore, step: "any" } }}
      sx={{ width: 96 }}
    />
  );
}

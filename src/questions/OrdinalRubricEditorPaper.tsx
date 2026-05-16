"use client";

import { TextField } from "@mui/material";
import { type ReactElement } from "react";
import type { QuestionRubricFieldErrors } from "./errors";
import RubricEditorPaper from "./RubricEditorPaper";
import type { RubricEditorValue } from "./types";

type OrdinalRubric = Extract<RubricEditorValue, { type: "ordinal" }>;

type OrdinalRubricEditorPaperProps = {
  rubric: OrdinalRubric;
  onChange: (rubric: RubricEditorValue) => void;
  onRemove: () => void;
  fieldErrors?: QuestionRubricFieldErrors;
};

function ordinalMarksToText(value: Record<string, number>): string {
  return Object.entries(value)
    .map(([label, marks]) => `${label}=${marks}`)
    .join("\n");
}

function parseOrdinalMarks(value: string): Record<string, number> {
  return Object.fromEntries(
    value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const [label, marks] = line.split("=");
        if (label == null) {
          return [];
        }
        const parsed = Number(marks);
        return [label.trim(), Number.isFinite(parsed) ? parsed : 0];
      })
      .filter((entry): entry is [string, number] => entry.length === 2),
  );
}

export default function OrdinalRubricEditorPaper({
  rubric,
  onChange,
  onRemove,
  fieldErrors,
}: OrdinalRubricEditorPaperProps): ReactElement {
  return (
    <RubricEditorPaper
      rubric={rubric}
      onChange={onChange}
      onRemove={onRemove}
      fieldErrors={fieldErrors}
    >
      <TextField
        label="Ordinal marks"
        helperText="One entry per line using label=marks"
        value={ordinalMarksToText(rubric.marks)}
        onChange={(event) =>
          onChange({ ...rubric, marks: parseOrdinalMarks(event.target.value) })
        }
        multiline
        minRows={4}
      />
    </RubricEditorPaper>
  );
}

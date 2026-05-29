"use client";

import { Stack } from "@mui/material";
import { type ReactElement } from "react";
import type { QuestionRubricFieldErrors } from "./errors";
import RubricEditorPaper, { NumberField } from "./RubricEditorPaper";
import type { RubricEditorValue } from "./types";

type BooleanRubric = Extract<RubricEditorValue, { type: "boolean" }>;

type BooleanRubricEditorPaperProps = {
	rubric: BooleanRubric;
	onChange: (rubric: RubricEditorValue) => void;
	onRemove: () => void;
	fieldErrors?: QuestionRubricFieldErrors;
};

export default function BooleanRubricEditorPaper({
	rubric,
	onChange,
	onRemove,
	fieldErrors,
}: BooleanRubricEditorPaperProps): ReactElement {
	return (
		<RubricEditorPaper
			rubric={rubric}
			onChange={onChange}
			onRemove={onRemove}
			fieldErrors={fieldErrors}
		>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<NumberField
					label="True marks"
					value={rubric.marks}
					onChange={(value) => onChange({ ...rubric, marks: value })}
				/>
				<NumberField
					label="False marks"
					value={rubric.falseMarks ?? 0}
					onChange={(value) => onChange({ ...rubric, falseMarks: value })}
				/>
			</Stack>
		</RubricEditorPaper>
	);
}

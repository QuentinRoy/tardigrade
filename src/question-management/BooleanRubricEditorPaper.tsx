"use client";

import { Group } from "@mantine/core";
import type { ReactElement } from "react";
import ScoreInput from "#design-system/ScoreInput.tsx";
import type { QuestionRubricFieldErrors } from "./errors.ts";
import RubricEditorPaper from "./RubricEditorPaper.tsx";
import type { RubricEditorValue } from "./types.ts";

type BooleanRubric = Extract<RubricEditorValue, { type: "boolean" }>;

type BooleanRubricEditorPaperProps = {
	rubric: BooleanRubric;
	onChange: (rubric: RubricEditorValue) => void;
	onRemove: () => void;
	fieldErrors?: QuestionRubricFieldErrors | undefined;
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
			<Group wrap="wrap">
				<ScoreInput
					label="True marks"
					defaultValue={rubric.marks}
					onChange={(value) => onChange({ ...rubric, marks: value })}
					error={fieldErrors?.marks}
				/>
				<ScoreInput
					label="False marks"
					defaultValue={rubric.falseMarks ?? 0}
					onChange={(value) => onChange({ ...rubric, falseMarks: value })}
					error={fieldErrors?.falseMarks}
				/>
			</Group>
		</RubricEditorPaper>
	);
}

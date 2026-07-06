"use client";

import { Group, Stack, Switch, Text } from "@mantine/core";
import type { ReactElement } from "react";
import ScoreInput from "#design-system/ScoreInput.tsx";
import type { QuestionRubricFieldErrors } from "./errors.ts";
import RubricEditorPaper from "./RubricEditorPaper.tsx";
import type { RubricEditorValue } from "./types.ts";

type NumericalRubric = Extract<RubricEditorValue, { type: "numerical" }>;

type NumericalRubricEditorPaperProps = {
	rubric: NumericalRubric;
	onChange: (rubric: RubricEditorValue) => void;
	onRemove: () => void;
	fieldErrors?: QuestionRubricFieldErrors | undefined;
};

export default function NumericalRubricEditorPaper({
	rubric,
	onChange,
	onRemove,
	fieldErrors,
}: NumericalRubricEditorPaperProps): ReactElement {
	return (
		<RubricEditorPaper
			rubric={rubric}
			onChange={onChange}
			onRemove={onRemove}
			fieldErrors={fieldErrors}
		>
			<Stack gap="xs">
				<Group wrap="wrap">
					<ScoreInput
						label="Min score"
						defaultValue={rubric.minScore}
						onChange={(value) => onChange({ ...rubric, minScore: value })}
						error={fieldErrors?.minScore}
					/>
					<ScoreInput
						label="Max score"
						defaultValue={rubric.maxScore}
						onChange={(value) => onChange({ ...rubric, maxScore: value })}
						error={fieldErrors?.maxScore}
					/>
				</Group>
				<Group wrap="wrap">
					<ScoreInput
						label="Min marks"
						defaultValue={rubric.minMarks}
						onChange={(value) => onChange({ ...rubric, minMarks: value })}
						error={fieldErrors?.minMarks}
					/>
					<ScoreInput
						label="Max marks"
						defaultValue={rubric.maxMarks}
						onChange={(value) => onChange({ ...rubric, maxMarks: value })}
						error={fieldErrors?.maxMarks}
					/>
				</Group>
				<Switch
					label={<Text size="sm">Reverse score-to-marks mapping</Text>}
					checked={rubric.reversed}
					onChange={(event) =>
						onChange({ ...rubric, reversed: event.currentTarget.checked })
					}
				/>
			</Stack>
		</RubricEditorPaper>
	);
}

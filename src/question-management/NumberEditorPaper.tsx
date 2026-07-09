"use client";

import { Group, Stack, Switch, Text } from "@mantine/core";
import type { ReactElement } from "react";
import ScoreInput from "#design-system/ScoreInput.tsx";
import CriterionEditorPaper from "./CriterionEditorPaper.tsx";
import type { QuestionCriterionFieldErrors } from "./errors.ts";
import type { CriterionEditorValue } from "./types.ts";

type NumberCriterion = Extract<CriterionEditorValue, { kind: "number" }>;

type NumberCriterionEditorPaperProps = {
	criterion: NumberCriterion;
	onChange: (criterion: CriterionEditorValue) => void;
	onRemove: () => void;
	fieldErrors?: QuestionCriterionFieldErrors | undefined;
};

export default function NumberCriterionEditorPaper({
	criterion,
	onChange,
	onRemove,
	fieldErrors,
}: NumberCriterionEditorPaperProps): ReactElement {
	return (
		<CriterionEditorPaper
			criterion={criterion}
			onChange={onChange}
			onRemove={onRemove}
			fieldErrors={fieldErrors}
		>
			<Stack gap="xs">
				<Group wrap="wrap">
					<ScoreInput
						label="Min score"
						defaultValue={criterion.minScore}
						onChange={(value) => onChange({ ...criterion, minScore: value })}
						error={fieldErrors?.minScore}
					/>
					<ScoreInput
						label="Max score"
						defaultValue={criterion.maxScore}
						onChange={(value) => onChange({ ...criterion, maxScore: value })}
						error={fieldErrors?.maxScore}
					/>
				</Group>
				<Group wrap="wrap">
					<ScoreInput
						label="Min marks"
						defaultValue={criterion.minMarks}
						onChange={(value) => onChange({ ...criterion, minMarks: value })}
						error={fieldErrors?.minMarks}
					/>
					<ScoreInput
						label="Max marks"
						defaultValue={criterion.maxMarks}
						onChange={(value) => onChange({ ...criterion, maxMarks: value })}
						error={fieldErrors?.maxMarks}
					/>
				</Group>
				<Switch
					label={<Text size="sm">Reverse score-to-marks mapping</Text>}
					checked={criterion.reversed}
					onChange={(event) =>
						onChange({ ...criterion, reversed: event.currentTarget.checked })
					}
				/>
			</Stack>
		</CriterionEditorPaper>
	);
}

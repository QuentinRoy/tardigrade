"use client";

import { Group, Stack, Switch, Text } from "@mantine/core";
import type { ReactElement } from "react";
import UncontrolledNumberInput from "#design-system/UncontrolledNumberInput.tsx";
import CriterionEditorPaper from "./CriterionEditorPaper.tsx";
import type { RubricCriterionFieldErrors } from "./errors.ts";
import type { CriterionEditorValue } from "./types.ts";

type NumberCriterion = Extract<CriterionEditorValue, { kind: "number" }>;

type NumberCriterionEditorPaperProps = {
	criterion: NumberCriterion;
	onChange: (criterion: CriterionEditorValue) => void;
	onRemove: () => void;
	fieldErrors?: RubricCriterionFieldErrors | undefined;
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
					<UncontrolledNumberInput
						label="Min value"
						defaultValue={criterion.minValue}
						onChange={(value) => onChange({ ...criterion, minValue: value })}
						error={fieldErrors?.minValue}
					/>
					<UncontrolledNumberInput
						label="Max value"
						defaultValue={criterion.maxValue}
						onChange={(value) => onChange({ ...criterion, maxValue: value })}
						error={fieldErrors?.maxValue}
					/>
				</Group>
				<Group wrap="wrap">
					<UncontrolledNumberInput
						label="Min marks"
						defaultValue={criterion.minMarks}
						onChange={(value) => onChange({ ...criterion, minMarks: value })}
						error={fieldErrors?.minMarks}
					/>
					<UncontrolledNumberInput
						label="Max marks"
						defaultValue={criterion.maxMarks}
						onChange={(value) => onChange({ ...criterion, maxMarks: value })}
						error={fieldErrors?.maxMarks}
					/>
				</Group>
				<Switch
					label={<Text size="sm">Reverse value-to-marks mapping</Text>}
					checked={criterion.reversed}
					onChange={(event) =>
						onChange({ ...criterion, reversed: event.currentTarget.checked })
					}
				/>
			</Stack>
		</CriterionEditorPaper>
	);
}

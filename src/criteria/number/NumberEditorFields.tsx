"use client";

import { Group, Stack, Switch, Text } from "@mantine/core";
import type { ReactElement } from "react";
import UncontrolledNumberInput from "#design-system/UncontrolledNumberInput.tsx";
import type { NumberCriterionDefinitionInput } from "./numberSchemas.ts";

// Kind-owned authoring inputs for a Number criterion. The rubric-management
// vertical keeps the surrounding CriterionEditorPaper chrome and the kind→fields
// dispatch; this fragment holds only the Number-specific inputs (ADR 0013).
//
// The error prop is deliberately narrow — only the fields this fragment renders.
// The vertical's wider flat `RubricCriterionFieldErrors` bag is structurally
// assignable to it, so no error type crosses the boundary.
export type NumberEditorFieldErrors = {
	minValue?: string | undefined;
	maxValue?: string | undefined;
	minMarks?: string | undefined;
	maxMarks?: string | undefined;
};

type NumberEditorFieldsProps = {
	criterion: NumberCriterionDefinitionInput;
	onChange: (criterion: NumberCriterionDefinitionInput) => void;
	fieldErrors?: NumberEditorFieldErrors | undefined;
};

export default function NumberEditorFields({
	criterion,
	onChange,
	fieldErrors,
}: NumberEditorFieldsProps): ReactElement {
	return (
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
	);
}

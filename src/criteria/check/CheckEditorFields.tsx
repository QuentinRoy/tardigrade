"use client";

import { Group } from "@mantine/core";
import type { ReactElement } from "react";
import UncontrolledNumberInput from "#design-system/UncontrolledNumberInput.tsx";
import type { CheckCriterionEditorValue } from "./checkSchemas.ts";

// Kind-owned authoring inputs for a Check criterion. The rubric-management
// vertical keeps the surrounding CriterionEditorPaper chrome and the kind→fields
// dispatch; this fragment holds only the Check-specific inputs (ADR 0013).
//
// The error prop is deliberately narrow — only the fields this fragment renders.
// The vertical's wider flat `RubricCriterionFieldErrors` bag is structurally
// assignable to it, so no error type crosses the boundary.
export type CheckEditorFieldErrors = {
	marks?: string | undefined;
	falseMarks?: string | undefined;
};

type CheckEditorFieldsProps = {
	criterion: CheckCriterionEditorValue;
	onChange: (criterion: CheckCriterionEditorValue) => void;
	fieldErrors?: CheckEditorFieldErrors | undefined;
};

export default function CheckEditorFields({
	criterion,
	onChange,
	fieldErrors,
}: CheckEditorFieldsProps): ReactElement {
	return (
		<Group wrap="wrap">
			<UncontrolledNumberInput
				label="Yes marks"
				defaultValue={criterion.marks}
				onChange={(value) => onChange({ ...criterion, marks: value })}
				error={fieldErrors?.marks}
			/>
			<UncontrolledNumberInput
				label="No marks"
				defaultValue={criterion.falseMarks ?? 0}
				onChange={(value) => onChange({ ...criterion, falseMarks: value })}
				error={fieldErrors?.falseMarks}
			/>
		</Group>
	);
}

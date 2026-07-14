"use client";

import { Group } from "@mantine/core";
import type { ReactElement } from "react";
import UncontrolledNumberInput from "#design-system/UncontrolledNumberInput.tsx";
import CriterionEditorPaper from "./CriterionEditorPaper.tsx";
import type { RubricCriterionFieldErrors } from "./errors.ts";
import type { CriterionEditorValue } from "./types.ts";

type CheckCriterion = Extract<CriterionEditorValue, { kind: "check" }>;

type CheckCriterionEditorPaperProps = {
	criterion: CheckCriterion;
	onChange: (criterion: CriterionEditorValue) => void;
	onRemove: () => void;
	fieldErrors?: RubricCriterionFieldErrors | undefined;
};

export default function CheckCriterionEditorPaper({
	criterion,
	onChange,
	onRemove,
	fieldErrors,
}: CheckCriterionEditorPaperProps): ReactElement {
	return (
		<CriterionEditorPaper
			criterion={criterion}
			onChange={onChange}
			onRemove={onRemove}
			fieldErrors={fieldErrors}
		>
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
		</CriterionEditorPaper>
	);
}

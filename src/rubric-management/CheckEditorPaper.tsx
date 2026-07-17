"use client";

import type { ReactElement } from "react";
import CheckEditorFields from "#criteria/check/CheckEditorFields.tsx";
import type { CriterionDefinitionInput } from "#criteria/types.ts";
import CriterionEditorPaper from "./CriterionEditorPaper.tsx";
import type { RubricCriterionFieldErrors } from "./errors.ts";

type CheckCriterion = Extract<CriterionDefinitionInput, { kind: "check" }>;

type CheckCriterionEditorPaperProps = {
	criterion: CheckCriterion;
	onChange: (criterion: CriterionDefinitionInput) => void;
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
			<CheckEditorFields
				criterion={criterion}
				onChange={onChange}
				fieldErrors={fieldErrors}
			/>
		</CriterionEditorPaper>
	);
}

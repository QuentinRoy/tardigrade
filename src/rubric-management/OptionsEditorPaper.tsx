"use client";

import type { ReactElement } from "react";
import OptionsEditorFields from "#criteria/options/OptionsEditorFields.tsx";
import type { CriterionDefinitionInput } from "#criteria/types.ts";
import CriterionEditorPaper from "./CriterionEditorPaper.tsx";
import type { RubricCriterionFieldErrors } from "./errors.ts";

type OptionsCriterion = Extract<CriterionDefinitionInput, { kind: "options" }>;

type OptionsCriterionEditorPaperProps = {
	criterion: OptionsCriterion;
	onChange: (criterion: CriterionDefinitionInput) => void;
	onRemove: () => void;
	fieldErrors?: RubricCriterionFieldErrors | undefined;
};

export default function OptionsCriterionEditorPaper({
	criterion,
	onChange,
	onRemove,
	fieldErrors,
}: OptionsCriterionEditorPaperProps): ReactElement {
	return (
		<CriterionEditorPaper
			criterion={criterion}
			onChange={onChange}
			onRemove={onRemove}
			fieldErrors={fieldErrors}
		>
			<OptionsEditorFields
				criterion={criterion}
				onChange={onChange}
				fieldErrors={fieldErrors}
			/>
		</CriterionEditorPaper>
	);
}

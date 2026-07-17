"use client";

import type { ReactElement } from "react";
import OptionsEditorFields from "#criteria/options/OptionsEditorFields.tsx";
import CriterionEditorPaper from "./CriterionEditorPaper.tsx";
import type { RubricCriterionFieldErrors } from "./errors.ts";
import type { CriterionEditorValue } from "./types.ts";

type OptionsCriterion = Extract<CriterionEditorValue, { kind: "options" }>;

type OptionsCriterionEditorPaperProps = {
	criterion: OptionsCriterion;
	onChange: (criterion: CriterionEditorValue) => void;
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

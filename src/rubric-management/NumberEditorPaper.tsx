"use client";

import type { ReactElement } from "react";
import NumberEditorFields from "#criteria/number/NumberEditorFields.tsx";
import type { CriterionDefinitionInput } from "#criteria/types.ts";
import CriterionEditorPaper from "./CriterionEditorPaper.tsx";
import type { RubricCriterionFieldErrors } from "./errors.ts";

type NumberCriterion = Extract<CriterionDefinitionInput, { kind: "number" }>;

type NumberCriterionEditorPaperProps = {
	criterion: NumberCriterion;
	onChange: (criterion: CriterionDefinitionInput) => void;
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
			<NumberEditorFields
				criterion={criterion}
				onChange={onChange}
				fieldErrors={fieldErrors}
			/>
		</CriterionEditorPaper>
	);
}

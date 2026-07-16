"use client";

import type { ReactElement } from "react";
import NumberEditorFields from "#criteria/number/NumberEditorFields.tsx";
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
			<NumberEditorFields
				criterion={criterion}
				onChange={onChange}
				fieldErrors={fieldErrors}
			/>
		</CriterionEditorPaper>
	);
}

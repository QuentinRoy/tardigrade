"use client";

import type { ReactElement } from "react";
import CheckEditorFields from "#criteria/check/CheckEditorFields.tsx";
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
			<CheckEditorFields
				criterion={criterion}
				onChange={onChange}
				fieldErrors={fieldErrors}
			/>
		</CriterionEditorPaper>
	);
}

"use client";

import { Textarea } from "@mantine/core";
import type { ReactElement } from "react";
import type { OptionsCriterionEditorValue } from "./optionsSchemas.ts";

// Kind-owned authoring inputs for an Options criterion. The rubric-management
// vertical keeps the surrounding CriterionEditorPaper chrome and the kind→fields
// dispatch; this fragment holds only the Options-specific inputs (ADR 0013).
//
// The error prop is deliberately narrow — only the fields this fragment renders.
// The vertical's wider flat `RubricCriterionFieldErrors` bag is structurally
// assignable to it, so no error type crosses the boundary.
export type OptionsEditorFieldErrors = { marks?: string | undefined };

type OptionsEditorFieldsProps = {
	criterion: OptionsCriterionEditorValue;
	onChange: (criterion: OptionsCriterionEditorValue) => void;
	fieldErrors?: OptionsEditorFieldErrors | undefined;
};

function optionsMarksToText(value: Record<string, number>): string {
	return Object.entries(value)
		.map(([label, marks]) => `${label}=${marks}`)
		.join("\n");
}

function parseOptionsMarks(value: string): Record<string, number> {
	return Object.fromEntries(
		value
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.map((line) => {
				const [label, marks] = line.split("=");
				if (label == null) {
					return [];
				}
				const parsed = Number(marks);
				return [label.trim(), Number.isFinite(parsed) ? parsed : 0];
			})
			.filter((entry): entry is [string, number] => entry.length === 2),
	);
}

export default function OptionsEditorFields({
	criterion,
	onChange,
	fieldErrors,
}: OptionsEditorFieldsProps): ReactElement {
	return (
		<Textarea
			label="Options marks"
			description={
				fieldErrors?.marks == null
					? "One entry per line using label=marks"
					: undefined
			}
			error={fieldErrors?.marks}
			value={optionsMarksToText(criterion.marks)}
			onChange={(event) =>
				onChange({
					...criterion,
					marks: parseOptionsMarks(event.currentTarget.value),
				})
			}
			minRows={4}
			autosize
		/>
	);
}

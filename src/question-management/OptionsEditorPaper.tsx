"use client";

import { Textarea } from "@mantine/core";
import type { ReactElement } from "react";
import CriterionEditorPaper from "./CriterionEditorPaper.tsx";
import type { QuestionCriterionFieldErrors } from "./errors.ts";
import type { CriterionEditorValue } from "./types.ts";

type OptionsCriterion = Extract<CriterionEditorValue, { kind: "options" }>;

type OptionsCriterionEditorPaperProps = {
	criterion: OptionsCriterion;
	onChange: (criterion: CriterionEditorValue) => void;
	onRemove: () => void;
	fieldErrors?: QuestionCriterionFieldErrors | undefined;
};

function ordinalMarksToText(value: Record<string, number>): string {
	return Object.entries(value)
		.map(([label, marks]) => `${label}=${marks}`)
		.join("\n");
}

function parseOrdinalMarks(value: string): Record<string, number> {
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
			<Textarea
				label="Ordinal marks"
				description={
					fieldErrors?.marks == null
						? "One entry per line using label=marks"
						: undefined
				}
				error={fieldErrors?.marks}
				value={ordinalMarksToText(criterion.marks)}
				onChange={(event) =>
					onChange({
						...criterion,
						marks: parseOrdinalMarks(event.currentTarget.value),
					})
				}
				minRows={4}
				autosize
			/>
		</CriterionEditorPaper>
	);
}
